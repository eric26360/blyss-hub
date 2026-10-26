-- Phase 2 fixes for check-ins.

-- 1. Editing a check-in failed: the edit-history trigger ran as the employee,
--    and employees aren't allowed to write to checkin_edits directly.
--    Run it with the database's own rights instead.
create or replace function public.record_checkin_edit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.answers is distinct from new.answers or old.creative_count is distinct from new.creative_count then
    insert into public.checkin_edits (checkin_id, previous_answers, previous_creative_count)
    values (old.id, old.answers, old.creative_count);
    new.updated_at := now();
  end if;
  new.submitted_at := old.submitted_at;
  new.on_time := old.on_time;
  new.profile_id := old.profile_id;
  new.kind := old.kind;
  new.day := old.day;
  return new;
end $$;

-- 2. Decide "on time" in the database, not the browser: compare the submission
--    time against the owner's deadline in the employee's own timezone.
create or replace function public.set_checkin_on_time() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text;
  deadline time;
  local_now timestamp;
begin
  select timezone into tz from profiles where id = new.profile_id;
  select (value ->> new.kind::text)::time into deadline from settings where key = 'checkin_deadlines';
  deadline := coalesce(deadline, case when new.kind = 'morning' then time '09:30' else time '18:00' end);
  local_now := now() at time zone coalesce(tz, 'America/New_York');
  new.submitted_at := now();
  new.updated_at := null;
  new.on_time := local_now::date < new.day
    or (local_now::date = new.day and local_now::time < deadline + interval '1 minute');
  return new;
end $$;

drop trigger if exists checkin_on_time on public.checkins;
create trigger checkin_on_time
  before insert on public.checkins
  for each row execute function public.set_checkin_on_time();
