-- Phase 3: UGC creators, ratings, notes, favorites, monthly budgets, expenses.
-- Runs as one transaction: if anything fails, nothing is applied.

begin;

-- ───────────── Who can use the UGC section ─────────────

-- Owners, strategists and UGC managers. Video editors have no UGC access.
create function public.has_ugc_access() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and active and role in ('owner', 'strategist', 'ugc_manager')
  );
$$;

create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active;
$$;

-- In-app notification for every active owner.
create function public.notify_owners(p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into notifications (recipient_id, title, body, link)
  select id, p_title, p_body, p_link from profiles where role = 'owner' and active;
$$;

create function public.display_name(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(full_name, ''), email) from profiles where id = p_id;
$$;

-- ───────────── Creators ─────────────

create type public.creator_status as enum (
  'prospect', 'contacted', 'negotiating', 'active', 'awaiting_content',
  'completed', 'previously_worked_with', 'do_not_work_with'
);

create table public.ugc_creators (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  photo_url text,
  email text,
  phone text,
  instagram text,
  tiktok text,
  other_socials text,            -- free text, one link per line
  country text,
  location text,
  standard_rate numeric(10, 2) check (standard_rate >= 0),    -- per video
  negotiated_rate numeric(10, 2) check (negotiated_rate >= 0), -- per video
  package_rate numeric(10, 2) check (package_rate >= 0),
  package_details text,          -- e.g. "5 videos + 3 hooks"
  whitelisting_rate numeric(10, 2) check (whitelisting_rate >= 0),
  usage_rights text,             -- e.g. "12 months paid usage"
  assigned_strategist_id uuid references public.profiles (id) on delete set null,
  assigned_ugc_manager_id uuid references public.profiles (id) on delete set null,
  status public.creator_status not null default 'prospect',
  internal_notes text,
  is_top boolean not null default false, -- curated "Top UGC Creators" list
  top_reason text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.ugc_creators (status);
create index on public.ugc_creators (assigned_strategist_id);

create table public.creator_rate_history (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.ugc_creators (id) on delete cascade,
  standard_rate numeric(10, 2),
  negotiated_rate numeric(10, 2),
  package_rate numeric(10, 2),
  whitelisting_rate numeric(10, 2),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);

-- Only owners and UGC managers curate the Top list.
create function public.ugc_creator_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  -- auth.uid() is null for trusted server jobs and the SQL editor.
  if auth.uid() is not null and my_role() is distinct from 'owner' and my_role() is distinct from 'ugc_manager' then
    new.is_top := case when tg_op = 'UPDATE' then old.is_top else false end;
    new.top_reason := case when tg_op = 'UPDATE' then old.top_reason else null end;
  end if;
  return new;
end $$;

-- Rate history and activity feed (after the row exists).
create function public.ugc_creator_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or old.standard_rate is distinct from new.standard_rate
     or old.negotiated_rate is distinct from new.negotiated_rate
     or old.package_rate is distinct from new.package_rate
     or old.whitelisting_rate is distinct from new.whitelisting_rate then
    insert into creator_rate_history (creator_id, standard_rate, negotiated_rate, package_rate, whitelisting_rate, changed_by)
    values (new.id, new.standard_rate, new.negotiated_rate, new.package_rate, new.whitelisting_rate, auth.uid());
  end if;

  if tg_op = 'INSERT' then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc', 'added a new creator: ' || new.full_name, 'creator', new.id::text, '/creators/' || new.id);
  elsif old.status is distinct from new.status then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc',
      'moved ' || new.full_name || ' to ' || initcap(replace(new.status::text, '_', ' ')),
      'creator', new.id::text, '/creators/' || new.id);
  end if;
  return null;
end $$;

create trigger ugc_creator_before
  before insert or update on public.ugc_creators
  for each row execute function public.ugc_creator_before();

create trigger ugc_creator_after
  after insert or update on public.ugc_creators
  for each row execute function public.ugc_creator_after();

-- ───────────── Ratings, notes, favorites ─────────────

create table public.creator_ratings (
  creator_id uuid not null references public.ugc_creators (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  video_quality smallint check (video_quality between 1 and 5),
  on_camera smallint check (on_camera between 1 and 5),
  reliability smallint check (reliability between 1 and 5),
  communication smallint check (communication between 1 and 5),
  pricing smallint check (pricing between 1 and 5),
  creative_performance smallint check (creative_performance between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (creator_id, rater_id)
);

create table public.creator_notes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.ugc_creators (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create table public.creator_favorites (
  profile_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  creator_id uuid not null references public.ugc_creators (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, creator_id)
);

-- ───────────── Budgets & expenses ─────────────

create table public.ugc_budgets (
  id uuid primary key default gen_random_uuid(),
  strategist_id uuid not null references public.profiles (id) on delete cascade,
  month date not null check (extract(day from month) = 1), -- first day of the month
  amount numeric(12, 2) not null check (amount >= 0),
  set_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  unique (strategist_id, month)
);

create type public.expense_status as enum ('committed', 'paid', 'cancelled');
create type public.approval_status as enum ('not_needed', 'pending', 'approved', 'rejected');

-- Booking a creator = a 'committed' expense. Paying it flips the same row to
-- 'paid', so an amount is never counted twice.
create table public.ugc_expenses (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.ugc_creators (id) on delete restrict,
  strategist_id uuid not null references public.profiles (id) on delete restrict, -- whose budget
  ugc_manager_id uuid references public.profiles (id) on delete set null,
  project text not null check (length(trim(project)) > 0),
  video_count int not null default 1 check (video_count >= 0),
  videos_delivered int not null default 0 check (videos_delivered >= 0),
  amount numeric(12, 2) not null check (amount >= 0), -- agreed price
  status public.expense_status not null default 'committed',
  approval public.approval_status not null default 'not_needed',
  expense_date date not null default current_date,
  budget_month date not null, -- set from expense_date by trigger
  paid_at timestamptz,
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.ugc_expenses (strategist_id, budget_month);
create index on public.ugc_expenses (creator_id);

-- Does this expense count against the budget?
create function public.expense_counts(s public.expense_status, a public.approval_status) returns boolean
language sql immutable as $$
  select s in ('committed', 'paid') and a in ('not_needed', 'approved');
$$;

-- Committed + paid for a strategist's month, ignoring one expense (the one being saved).
create function public.budget_used(p_strategist uuid, p_month date, p_exclude uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount), 0) from ugc_expenses
  where strategist_id = p_strategist and budget_month = p_month
    and id is distinct from p_exclude and expense_counts(status, approval);
$$;

create function public.budget_amount(p_strategist uuid, p_month date) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select amount from ugc_budgets where strategist_id = p_strategist and month = p_month), 0);
$$;

-- Validates every save: works out the month, enforces approval rules,
-- and sends anything that would go over budget to the owner for approval.
create function public.ugc_expense_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  -- auth.uid() is null for trusted server jobs and the SQL editor.
  by_owner boolean := auth.uid() is null or is_owner();
  budget numeric;
  used numeric;
  over boolean;
begin
  new.budget_month := date_trunc('month', new.expense_date)::date;

  if tg_op = 'UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
    -- Only owners decide approvals.
    if not by_owner then
      new.approval := old.approval;
    end if;
  elsif not by_owner then
    new.approval := 'not_needed';
  end if;

  if new.status = 'paid' and (tg_op = 'INSERT' or old.status <> 'paid') then
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.status <> 'paid' then
    new.paid_at := null;
  end if;

  -- Re-check the budget whenever the counted amount could grow.
  if not by_owner and new.status in ('committed', 'paid') and new.approval <> 'rejected' and (
       tg_op = 'INSERT'
       or new.amount > old.amount
       or new.strategist_id <> old.strategist_id
       or new.budget_month <> old.budget_month
       or old.status = 'cancelled'
     ) then
    budget := budget_amount(new.strategist_id, new.budget_month);
    used := budget_used(new.strategist_id, new.budget_month, new.id);
    over := used + new.amount > budget;
    if over and new.approval <> 'pending' then
      new.approval := 'pending';
      perform notify_owners(
        'UGC budget approval needed',
        coalesce(display_name(coalesce(auth.uid(), new.created_by)), 'Someone') || ' wants to book $' || to_char(new.amount, 'FM999,999,990.00')
          || ' for ' || display_name(new.strategist_id) || ', which goes over their '
          || to_char(new.budget_month, 'FMMonth YYYY') || ' budget ($'
          || to_char(greatest(budget - used, 0), 'FM999,999,990.00') || ' available).',
        '/budgets?month=' || to_char(new.budget_month, 'YYYY-MM')
      );
    elsif not over and new.approval = 'pending' then
      new.approval := 'not_needed';
    end if;
  end if;

  if new.status = 'paid' and new.approval in ('pending', 'rejected') then
    raise exception 'This expense needs owner approval before it can be marked paid.';
  end if;

  return new;
end $$;

-- After a save: 80% / 100% alerts, approval result for the strategist, activity feed.
create function public.ugc_expense_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  budget numeric;
  after_used numeric;
  before_used numeric;
  delta numeric := 0;
  creator text;
begin
  select full_name into creator from ugc_creators where id = new.creator_id;

  if expense_counts(new.status, new.approval) then
    delta := new.amount;
  end if;
  if tg_op = 'UPDATE' and expense_counts(old.status, old.approval)
     and old.strategist_id = new.strategist_id and old.budget_month = new.budget_month then
    delta := delta - old.amount;
  end if;

  budget := budget_amount(new.strategist_id, new.budget_month);
  after_used := budget_used(new.strategist_id, new.budget_month, null);
  before_used := after_used - delta;

  if budget > 0 and delta > 0 then
    if before_used < budget and after_used >= budget then
      perform notify_owners(
        display_name(new.strategist_id) || ' has used 100% of their UGC budget',
        to_char(new.budget_month, 'FMMonth YYYY') || ': $' || to_char(after_used, 'FM999,999,990.00')
          || ' of $' || to_char(budget, 'FM999,999,990.00') || '.',
        '/budgets?month=' || to_char(new.budget_month, 'YYYY-MM'));
    elsif before_used < budget * 0.8 and after_used >= budget * 0.8 then
      perform notify_owners(
        display_name(new.strategist_id) || ' has used 80% of their UGC budget',
        to_char(new.budget_month, 'FMMonth YYYY') || ': $' || to_char(after_used, 'FM999,999,990.00')
          || ' of $' || to_char(budget, 'FM999,999,990.00') || '.',
        '/budgets?month=' || to_char(new.budget_month, 'YYYY-MM'));
    end if;
  end if;

  if tg_op = 'UPDATE' and old.approval = 'pending' and new.approval in ('approved', 'rejected') then
    insert into notifications (recipient_id, title, body, link)
    values (new.strategist_id,
      'UGC expense ' || new.approval::text,
      '$' || to_char(new.amount, 'FM999,999,990.00') || ' for ' || creator || ' (' || new.project || ')',
      '/budgets?month=' || to_char(new.budget_month, 'YYYY-MM'));
  end if;

  if tg_op = 'INSERT' then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc', 'booked ' || creator || ' for ' || new.project, 'creator', new.creator_id::text, '/creators/' || new.creator_id);
  elsif new.status = 'paid' and old.status <> 'paid' then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc', 'marked ' || creator || ' (' || new.project || ') as paid', 'creator', new.creator_id::text, '/creators/' || new.creator_id);
  elsif new.videos_delivered > old.videos_delivered then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc',
      'logged ' || (new.videos_delivered - old.videos_delivered) || ' video(s) delivered by ' || creator,
      'creator', new.creator_id::text, '/creators/' || new.creator_id);
  end if;
  return null;
end $$;

create trigger ugc_expense_before
  before insert or update on public.ugc_expenses
  for each row execute function public.ugc_expense_before();

create trigger ugc_expense_after
  after insert or update on public.ugc_expenses
  for each row execute function public.ugc_expense_after();

-- Records who set the budget and when.
create function public.ugc_budget_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.set_by := auth.uid();
  return new;
end $$;

create trigger ugc_budget_changed
  before insert or update on public.ugc_budgets
  for each row execute function public.ugc_budget_changed();

-- ───────────── Summaries ─────────────

-- Per-creator totals across everyone's expenses (not limited by row security,
-- so a strategist sees a creator's full lifetime spend). Video editors get no rows.
create view public.creator_stats as
select
  c.id as creator_id,
  coalesce(sum(e.amount) filter (where e.status = 'paid'), 0) as total_paid,
  coalesce(sum(e.amount) filter (where e.status = 'committed' and e.approval in ('not_needed', 'approved')), 0) as total_committed,
  coalesce(sum(e.video_count) filter (where e.status <> 'cancelled'), 0)::int as videos_ordered,
  coalesce(sum(e.videos_delivered) filter (where e.status <> 'cancelled'), 0)::int as videos_delivered,
  count(e.id) filter (where e.status <> 'cancelled')::int as collaborations,
  (select round(avg(r.score), 2) from (
     select unnest(array[video_quality, on_camera, reliability, communication, pricing, creative_performance])::numeric as score
     from creator_ratings where creator_id = c.id
   ) r) as avg_rating,
  (select count(*) from creator_ratings where creator_id = c.id)::int as rating_count
from public.ugc_creators c
left join public.ugc_expenses e on e.creator_id = c.id
where public.has_ugc_access()
group by c.id;

-- Budget, committed, paid, awaiting approval and available per strategist per month.
-- Follows row security: strategists only get their own rows.
create view public.ugc_budget_summary with (security_invoker = true) as
with keys as (
  select strategist_id, month from public.ugc_budgets
  union
  select strategist_id, budget_month from public.ugc_expenses
)
select
  k.strategist_id,
  k.month,
  coalesce(b.amount, 0) as budget,
  coalesce(sum(e.amount) filter (where e.status = 'paid'), 0) as paid,
  coalesce(sum(e.amount) filter (where e.status = 'committed' and e.approval in ('not_needed', 'approved')), 0) as committed,
  coalesce(sum(e.amount) filter (where e.approval = 'pending' and e.status <> 'cancelled'), 0) as awaiting_approval,
  coalesce(b.amount, 0)
    - coalesce(sum(e.amount) filter (where public.expense_counts(e.status, e.approval)), 0) as available
from keys k
left join public.ugc_budgets b on b.strategist_id = k.strategist_id and b.month = k.month
left join public.ugc_expenses e on e.strategist_id = k.strategist_id and e.budget_month = k.month
group by k.strategist_id, k.month, b.amount;

grant select on public.creator_stats, public.ugc_budget_summary to authenticated;

-- ───────────── Row-level security ─────────────

alter table public.ugc_creators enable row level security;
alter table public.creator_rate_history enable row level security;
alter table public.creator_ratings enable row level security;
alter table public.creator_notes enable row level security;
alter table public.creator_favorites enable row level security;
alter table public.ugc_budgets enable row level security;
alter table public.ugc_expenses enable row level security;

-- Creators: everyone with UGC access can browse. Owners and UGC managers manage all;
-- strategists add and edit creators assigned to them.
create policy "ugc team reads creators" on public.ugc_creators for select to authenticated using (has_ugc_access());
create policy "owners and ugc managers add creators" on public.ugc_creators for insert to authenticated
  with check (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and assigned_strategist_id = auth.uid()));
create policy "edit creators" on public.ugc_creators for update to authenticated
  using (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and assigned_strategist_id = auth.uid()))
  with check (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and assigned_strategist_id = auth.uid()));
create policy "owners delete creators" on public.ugc_creators for delete to authenticated using (is_owner());

create policy "ugc team reads rate history" on public.creator_rate_history for select to authenticated using (has_ugc_access());

create policy "ugc team reads ratings" on public.creator_ratings for select to authenticated using (has_ugc_access());
create policy "rate as yourself" on public.creator_ratings for insert to authenticated with check (has_ugc_access() and rater_id = auth.uid());
create policy "change your rating" on public.creator_ratings for update to authenticated
  using (rater_id = auth.uid()) with check (has_ugc_access() and rater_id = auth.uid());
create policy "remove your rating" on public.creator_ratings for delete to authenticated using (rater_id = auth.uid());

create policy "ugc team reads notes" on public.creator_notes for select to authenticated using (has_ugc_access());
create policy "write notes as yourself" on public.creator_notes for insert to authenticated with check (has_ugc_access() and author_id = auth.uid());
create policy "delete own notes, owners any" on public.creator_notes for delete to authenticated using (author_id = auth.uid() or is_owner());

create policy "own favorites" on public.creator_favorites for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and has_ugc_access());

-- Budgets: only owners set them. Strategists see their own; UGC managers see all.
create policy "read budgets" on public.ugc_budgets for select to authenticated
  using (my_role() in ('owner', 'ugc_manager') or strategist_id = auth.uid());
create policy "owners set budgets" on public.ugc_budgets for all to authenticated using (is_owner()) with check (is_owner());

-- Expenses: owners and UGC managers handle everyone's; strategists only their own budget.
create policy "read expenses" on public.ugc_expenses for select to authenticated
  using (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and strategist_id = auth.uid()));
create policy "record expenses" on public.ugc_expenses for insert to authenticated
  with check (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and strategist_id = auth.uid()));
create policy "update expenses" on public.ugc_expenses for update to authenticated
  using (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and strategist_id = auth.uid()))
  with check (my_role() in ('owner', 'ugc_manager') or (my_role() = 'strategist' and strategist_id = auth.uid()));
create policy "owners delete expenses" on public.ugc_expenses for delete to authenticated using (is_owner());

commit;
