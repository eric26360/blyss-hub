-- Phase 1: accounts, roles, settings, check-ins, activity feed.

-- ───────────── Roles & profiles ─────────────

create type public.user_role as enum ('owner', 'strategist', 'ugc_manager', 'video_editor');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.user_role not null default 'strategist',
  department text not null default 'Creative',
  timezone text not null default 'America/New_York',
  weekly_creative_target int not null default 10,
  requires_checkins boolean not null default true,
  -- Per-person overrides on top of the role, e.g. {"edit_budgets": true}
  permission_overrides jsonb not null default '{}'::jsonb,
  clickup_user_id text unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Every new login gets a profile automatically.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'strategist')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'owner' and active);
$$;

-- ───────────── Owner-configurable settings ─────────────

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

insert into public.settings (key, value) values
  ('winning_rules', '{"minSpend": 10000, "maxCac": 70, "minNewVisitorPct": 50}'),
  ('checkin_deadlines', '{"morning": "09:30", "evening": "18:00"}'),
  ('working_days', '[1, 2, 3, 4, 5]'),
  ('leaderboard', '{"rankBy": "winning_ads", "weights": {"winning_ads": 0.4, "win_rate": 0.2, "spend": 0.2, "production": 0.2}}');

create table public.days_off (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  reason text,
  approved boolean not null default false,
  unique (profile_id, day)
);

-- ───────────── Check-ins ─────────────

create type public.checkin_kind as enum ('morning', 'evening');

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.checkin_kind not null,
  day date not null,
  -- Question answers keyed by question id, e.g. {"priorities": "...", "blockers": "..."}
  answers jsonb not null,
  -- Morning: planned creatives/briefs. Evening: completed (self-reported).
  creative_count int,
  submitted_at timestamptz not null default now(),
  on_time boolean not null,
  updated_at timestamptz,
  unique (profile_id, kind, day)
);

-- Every edit keeps the previous answers.
create table public.checkin_edits (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  previous_answers jsonb not null,
  previous_creative_count int,
  edited_at timestamptz not null default now()
);

create function public.record_checkin_edit() returns trigger
language plpgsql as $$
begin
  if old.answers is distinct from new.answers or old.creative_count is distinct from new.creative_count then
    insert into public.checkin_edits (checkin_id, previous_answers, previous_creative_count)
    values (old.id, old.answers, old.creative_count);
    new.updated_at := now();
  end if;
  new.submitted_at := old.submitted_at;
  new.on_time := old.on_time;
  return new;
end $$;

create trigger checkin_edited
  before update on public.checkins
  for each row execute function public.record_checkin_edit();

-- ───────────── Activity feed ─────────────

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  source text not null default 'website', -- website | clickup | northbeam | ugc | calendar
  action text not null,                   -- e.g. "submitted their morning check-in"
  subject_type text,                      -- task | creator | ad | idea | event | checkin
  subject_id text,
  link text,
  created_at timestamptz not null default now()
);

create index on public.activity_events (created_at desc);

-- ───────────── Notifications ─────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ───────────── Row-level security ─────────────

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.days_off enable row level security;
alter table public.checkins enable row level security;
alter table public.checkin_edits enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;

-- Everyone logged in can see the team list (needed for leaderboard, assignments).
create policy "team can read profiles" on public.profiles for select to authenticated using (true);
create policy "owner manages profiles" on public.profiles for all to authenticated using (is_owner()) with check (is_owner());
create policy "update own name and timezone" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from profiles where id = auth.uid())
    and permission_overrides = (select permission_overrides from profiles where id = auth.uid())
    and active = (select active from profiles where id = auth.uid())
  );

create policy "team can read settings" on public.settings for select to authenticated using (true);
create policy "owner edits settings" on public.settings for all to authenticated using (is_owner()) with check (is_owner());

create policy "see own or owner sees all days off" on public.days_off for select to authenticated using (profile_id = auth.uid() or is_owner());
create policy "request own day off" on public.days_off for insert to authenticated with check (profile_id = auth.uid() and approved = false);
create policy "owner manages days off" on public.days_off for all to authenticated using (is_owner()) with check (is_owner());

create policy "see own or owner sees all checkins" on public.checkins for select to authenticated using (profile_id = auth.uid() or is_owner());
create policy "submit own checkin" on public.checkins for insert to authenticated with check (profile_id = auth.uid());
create policy "edit own checkin" on public.checkins for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "see edits of visible checkins" on public.checkin_edits for select to authenticated
  using (exists (select 1 from checkins c where c.id = checkin_id and (c.profile_id = auth.uid() or is_owner())));

create policy "team reads activity" on public.activity_events for select to authenticated using (true);
create policy "log own activity" on public.activity_events for insert to authenticated with check (actor_id = auth.uid());

create policy "read own notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "mark own notifications read" on public.notifications for update to authenticated using (recipient_id = auth.uid());

-- Live updates for the activity feed and notifications.
alter publication supabase_realtime add table public.activity_events, public.notifications;
