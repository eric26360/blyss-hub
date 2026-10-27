-- Weekly plans: before each week starts, strategists write what they'll
-- complete, what they'll focus on, and a plan for Monday–Friday.
-- Owners get a notification on Monday evening (6 PM New York time) listing
-- who hasn't written theirs.
--
-- Run once in the Supabase SQL editor. It's one transaction: if anything
-- fails, nothing is changed.

begin;

-- ───────────── Scheduler (pg_cron) ─────────────
-- Turned on first so the file stops straight away if it isn't available.

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
exception when others then
  raise exception 'Could not turn on the pg_cron scheduler (%). In Supabase, open Database → Extensions, enable "pg_cron", then run this file again.', sqlerrm;
end $$;

grant usage on schema cron to postgres;

-- ───────────── Who has to write a plan ─────────────

alter table public.profiles add column requires_weekly_plan boolean not null default false;

update public.profiles set requires_weekly_plan = true where role = 'strategist';

-- New strategists need a weekly plan by default; owners can switch it per person.
create function public.default_weekly_plan_flag() returns trigger
language plpgsql as $$
begin
  if new.role = 'strategist' then
    new.requires_weekly_plan := true;
  end if;
  return new;
end $$;

create trigger profiles_default_weekly_plan
  before insert on public.profiles
  for each row execute function public.default_weekly_plan_flag();

-- Employees may edit their own profile (name, timezone), but not switch off
-- their own check-in or weekly-plan requirement. Only owners (or the server) can.
create function public.protect_profile_requirements() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner() then
    new.requires_checkins := old.requires_checkins;
    new.requires_weekly_plan := old.requires_weekly_plan;
  end if;
  return new;
end $$;

create trigger profiles_protect_requirements
  before update on public.profiles
  for each row execute function public.protect_profile_requirements();

-- ───────────── Plans ─────────────

create table public.weekly_plans (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1), -- always a Monday
  goals text not null default '',  -- what they'll complete this week
  focus text not null default '',  -- what they'll focus on
  monday text not null default '',
  tuesday text not null default '',
  wednesday text not null default '',
  thursday text not null default '',
  friday text not null default '',
  submitted_at timestamptz not null default now(),
  on_time boolean not null default false, -- written before Monday 00:00 in their timezone
  updated_at timestamptz,
  unique (profile_id, week_start)
);

-- Every edit keeps the previous version.
create table public.weekly_plan_edits (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.weekly_plans (id) on delete cascade,
  previous jsonb not null,
  edited_at timestamptz not null default now()
);

create index on public.weekly_plan_edits (plan_id);

-- The employee's local "now", for deciding on-time and locked weeks.
create function public.local_now_for(p_profile uuid) returns timestamp
language sql stable security definer set search_path = public as $$
  select now() at time zone coalesce((select timezone from profiles where id = p_profile), 'America/New_York');
$$;

-- On submit: the database sets the time and decides on-time; ended weeks can't be added.
create function public.weekly_plan_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := local_now_for(new.profile_id);
begin
  if local_now::date >= new.week_start + 7 then
    raise exception 'That week has already ended, so its plan can no longer be written.';
  end if;
  new.submitted_at := now();
  new.updated_at := null;
  new.on_time := local_now < new.week_start::timestamp;
  return new;
end $$;

create trigger weekly_plan_insert
  before insert on public.weekly_plans
  for each row execute function public.weekly_plan_before_insert();

-- On edit: lock ended weeks, keep the previous version, and keep the
-- submission facts (who, which week, when, on time) unchanged.
create function public.weekly_plan_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if local_now_for(old.profile_id)::date >= old.week_start + 7 then
    raise exception 'That week has ended, so its plan is locked.';
  end if;
  new.profile_id := old.profile_id;
  new.week_start := old.week_start;
  new.submitted_at := old.submitted_at;
  new.on_time := old.on_time;
  if (old.goals, old.focus, old.monday, old.tuesday, old.wednesday, old.thursday, old.friday)
     is distinct from
     (new.goals, new.focus, new.monday, new.tuesday, new.wednesday, new.thursday, new.friday) then
    insert into weekly_plan_edits (plan_id, previous)
    values (old.id, jsonb_build_object(
      'goals', old.goals, 'focus', old.focus,
      'monday', old.monday, 'tuesday', old.tuesday, 'wednesday', old.wednesday,
      'thursday', old.thursday, 'friday', old.friday,
      'saved_at', coalesce(old.updated_at, old.submitted_at)
    ));
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end $$;

create trigger weekly_plan_update
  before update on public.weekly_plans
  for each row execute function public.weekly_plan_before_update();

-- Activity feed entry when a plan is first submitted.
create function public.weekly_plan_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into activity_events (actor_id, action, subject_type, subject_id, link)
  values (
    new.profile_id,
    'submitted their weekly plan for the week of ' || to_char(new.week_start, 'Mon FMDD'),
    'weekly_plan',
    new.id::text,
    '/team-weekly-plans?week=' || new.week_start
  );
  return new;
end $$;

create trigger weekly_plan_activity
  after insert on public.weekly_plans
  for each row execute function public.weekly_plan_after_insert();

alter table public.weekly_plans enable row level security;
alter table public.weekly_plan_edits enable row level security;

create policy "see own or owner sees all weekly plans" on public.weekly_plans for select to authenticated
  using (profile_id = auth.uid() or is_owner());
create policy "write own weekly plan" on public.weekly_plans for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and requires_weekly_plan and active)
  );
create policy "edit own weekly plan" on public.weekly_plans for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "see edits of visible weekly plans" on public.weekly_plan_edits for select to authenticated
  using (exists (select 1 from weekly_plans p where p.id = plan_id and (p.profile_id = auth.uid() or is_owner())));

-- ───────────── Monday-evening reminder for owners ─────────────

-- One row per week once the reminder has gone out, so it's only sent once.
create table public.weekly_plan_reminders (
  week_start date primary key,
  sent_at timestamptz not null default now(),
  summary text not null
);

alter table public.weekly_plan_reminders enable row level security;
create policy "owners see reminder log" on public.weekly_plan_reminders for select to authenticated using (is_owner());

-- Sends the reminder if it's Monday 6 PM or later in New York and it hasn't
-- gone out yet this week. `as_of` and `force` exist for testing:
--   select send_weekly_plan_reminder(force => true);  -- send now (still once per week)
create function public.send_weekly_plan_reminder(as_of timestamptz default now(), force boolean default false)
returns text
language plpgsql security definer set search_path = public as $$
declare
  local_at timestamp := as_of at time zone 'America/New_York';
  week date := local_at::date - (extract(isodow from local_at)::int - 1);
  expected int;
  submitted int;
  missing text;
  late text;
  title text;
  body text;
begin
  if not force and (extract(isodow from local_at) <> 1 or local_at::time < time '18:00') then
    return 'Not Monday 6 PM yet (New York time); nothing sent.';
  end if;

  if exists (select 1 from weekly_plan_reminders where week_start = week) then
    return 'Already sent for the week of ' || week || '.';
  end if;

  select count(*),
         count(wp.id),
         string_agg(p.full_name, ', ' order by p.full_name) filter (where wp.id is null),
         string_agg(p.full_name, ', ' order by p.full_name) filter (where wp.id is not null and not wp.on_time)
    into expected, submitted, missing, late
    from profiles p
    left join weekly_plans wp on wp.profile_id = p.id and wp.week_start = week
   where p.requires_weekly_plan and p.active
     and p.created_at < (week + 1)::timestamp at time zone 'America/New_York';

  title := 'Weekly plans: ' || submitted || ' of ' || expected || ' submitted';
  body := case
    when expected = 0 then 'Nobody is set up to write a weekly plan.'
    when missing is null then 'Everyone has written their plan for this week.'
    else 'Missing: ' || missing || '.'
  end || coalesce(' Written late: ' || late || '.', '');

  insert into weekly_plan_reminders (week_start, summary) values (week, title || ' — ' || body);

  insert into notifications (recipient_id, title, body, link)
  select id, title, body, '/team-weekly-plans?week=' || week
    from profiles
   where role = 'owner' and active;

  return title || ' — ' || body;
end $$;

-- Only the database itself (the scheduler, or the SQL editor) can send it.
revoke execute on function public.send_weekly_plan_reminder(timestamptz, boolean) from public, anon, authenticated;

-- Runs at 5 past every hour on Mondays and Tuesdays (UTC). The function only
-- acts once Monday 6 PM New York time has passed, and only once per week.
select cron.schedule('weekly-plan-reminder', '5 * * * 1,2', $$select public.send_weekly_plan_reminder()$$);

commit;
