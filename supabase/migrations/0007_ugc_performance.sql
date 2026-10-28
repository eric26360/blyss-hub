-- UGC performance: whitelisted vs paid ad classification, product seeding,
-- and Trybe creators.
-- Runs as one transaction: if anything fails, nothing is applied.

begin;

-- ───────────── Whitelisted vs paid ─────────────

-- Ad names don't say whether an ad ran whitelisted (from the creator's handle)
-- or as a regular paid ad. The site guesses a default; a row here overrides it.
create type public.ad_type as enum ('whitelisted', 'paid');

create table public.ad_classifications (
  ad_name text primary key check (length(trim(ad_name)) > 0),
  ad_type public.ad_type not null,
  set_by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create function public.ad_classification_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.set_by := auth.uid();
  end if;
  return new;
end $$;

create trigger ad_classification_before
  before insert or update on public.ad_classifications
  for each row execute function public.ad_classification_before();

-- ───────────── Product seeding ─────────────

create type public.seeding_status as enum ('shipped', 'delivered', 'posted', 'no_post');

create table public.seeding_sends (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.ugc_creators (id) on delete set null,
  creator_handle text,           -- for creators who aren't in the directory (yet)
  product text not null check (length(trim(product)) > 0),
  scent text,
  quantity int not null default 1 check (quantity > 0),
  product_cost numeric(10, 2) not null default 0 check (product_cost >= 0),
  shipping_cost numeric(10, 2) not null default 0 check (shipping_cost >= 0),
  shipped_on date not null default current_date,
  status public.seeding_status not null default 'shipped',
  post_url text,
  posted_on date,
  platform text,                 -- Instagram, TikTok, YouTube, …
  views int check (views >= 0),
  likes int check (likes >= 0),
  comments int check (comments >= 0),
  shares int check (shares >= 0),
  discount_code text,
  code_orders int check (code_orders >= 0),
  code_revenue numeric(12, 2) check (code_revenue >= 0),
  notes text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creator_id is not null or length(trim(coalesce(creator_handle, ''))) > 0)
);

create index on public.seeding_sends (shipped_on);
create index on public.seeding_sends (creator_id);

create function public.seeding_send_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- auth.uid() is null for trusted server jobs and the SQL editor.
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.creator_handle := nullif(trim(leading '@' from trim(coalesce(new.creator_handle, ''))), '');
  if new.status = 'posted' and new.posted_on is null then
    new.posted_on := current_date;
  end if;
  return new;
end $$;

create function public.seeding_send_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := coalesce(
    (select full_name from ugc_creators where id = new.creator_id),
    '@' || new.creator_handle
  );
begin
  if tg_op = 'INSERT' then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc', 'sent ' || new.product || ' to ' || who, 'seeding', new.id::text, '/ugc/seeding');
  elsif new.status = 'posted' and old.status is distinct from 'posted' then
    insert into activity_events (actor_id, source, action, subject_type, subject_id, link)
    values (auth.uid(), 'ugc', 'marked ' || who || '''s seeding post as live', 'seeding', new.id::text, '/ugc/seeding');
  end if;
  return null;
end $$;

create trigger seeding_send_before
  before insert or update on public.seeding_sends
  for each row execute function public.seeding_send_before();

create trigger seeding_send_after
  after insert or update on public.seeding_sends
  for each row execute function public.seeding_send_after();

-- ───────────── Trybe creators ─────────────

alter table public.ugc_creators
  add column is_trybe boolean not null default false,
  add column trybe_joined_on date,
  add column trybe_notes text;

create function public.ugc_creator_trybe() returns trigger
language plpgsql as $$
begin
  if new.is_trybe and new.trybe_joined_on is null then
    new.trybe_joined_on := current_date;
  end if;
  return new;
end $$;

create trigger ugc_creator_trybe
  before insert or update on public.ugc_creators
  for each row execute function public.ugc_creator_trybe();

-- ───────────── Row-level security ─────────────

alter table public.ad_classifications enable row level security;
alter table public.seeding_sends enable row level security;

create policy "ugc team reads ad types" on public.ad_classifications for select to authenticated using (has_ugc_access());
create policy "owners and ugc managers set ad types" on public.ad_classifications for all to authenticated
  using (my_role() in ('owner', 'ugc_manager'))
  with check (my_role() in ('owner', 'ugc_manager'));

-- Everyone in UGC can log sends. Owners and UGC managers edit any; strategists edit their own.
create policy "ugc team reads seeding" on public.seeding_sends for select to authenticated using (has_ugc_access());
create policy "ugc team logs seeding" on public.seeding_sends for insert to authenticated with check (has_ugc_access());
create policy "edit seeding" on public.seeding_sends for update to authenticated
  using (my_role() in ('owner', 'ugc_manager') or (has_ugc_access() and created_by = auth.uid()))
  with check (my_role() in ('owner', 'ugc_manager') or (has_ugc_access() and created_by = auth.uid()));
create policy "delete seeding" on public.seeding_sends for delete to authenticated
  using (my_role() in ('owner', 'ugc_manager') or (has_ugc_access() and created_by = auth.uid()));

commit;
