-- Tasks: things owners assign to people, and things people write for
-- themselves, for a day or for a week. ClickUp tasks are shown next to these
-- on the Tasks page but live in ClickUp, not here.
--
-- Run once in the Supabase SQL editor. It's one transaction: if anything
-- fails, nothing is changed.

begin;

create type public.task_source as enum ('assigned', 'self');
create type public.task_scope as enum ('day', 'week');
create type public.task_status as enum ('todo', 'done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  notes text,
  assignee_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  -- 'assigned' = an owner gave it to someone else; 'self' = the person wrote it.
  source public.task_source not null default 'self',
  scope public.task_scope not null default 'day',
  due_date date,   -- for day tasks
  week_start date, -- for week tasks (always a Monday)
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint task_has_date check (
    (scope = 'day' and due_date is not null and week_start is null)
    or (scope = 'week' and week_start is not null and due_date is null)
  ),
  constraint week_starts_monday check (week_start is null or extract(isodow from week_start) = 1)
);

create index on public.tasks (assignee_id, status);
create index on public.tasks (due_date);
create index on public.tasks (week_start);

-- ───────────── Rules the browser can't get around ─────────────

-- On create: who made it and whether it's assigned or self-written are
-- decided here, not by the browser.
create function public.prepare_new_task() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  new.source := case when new.assignee_id = new.created_by then 'self' else 'assigned' end;
  new.completed_at := case when new.status = 'done' then now() else null end;
  new.created_at := now();
  new.updated_at := null;
  return new;
end $$;

create trigger task_before_insert
  before insert on public.tasks
  for each row execute function public.prepare_new_task();

-- On edit: employees can tick off any of their own tasks, but can only change
-- the wording/dates of tasks they wrote themselves. Nobody but an owner can
-- move a task to someone else.
create function public.guard_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner() then
    new.assignee_id := old.assignee_id;
    new.created_by := old.created_by;
    new.source := old.source;
    if old.source = 'assigned' then
      new.title := old.title;
      new.notes := old.notes;
      new.scope := old.scope;
      new.due_date := old.due_date;
      new.week_start := old.week_start;
    end if;
  else
    new.created_by := old.created_by;
    new.source := case when new.assignee_id = new.created_by then 'self' else 'assigned' end;
  end if;

  if new.status is distinct from old.status then
    new.completed_at := case when new.status = 'done' then now() else null end;
  else
    new.completed_at := old.completed_at;
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end $$;

create trigger task_before_update
  before update on public.tasks
  for each row execute function public.guard_task_update();

-- Activity feed + a notification for the person when an owner assigns them
-- something. Runs with database rights so the employee's own permissions
-- don't block it.
create function public.task_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  assigner text;
begin
  if tg_op = 'INSERT' then
    if new.source = 'assigned' then
      select coalesce(nullif(full_name, ''), email) into assigner from profiles where id = new.created_by;
      insert into activity_events (actor_id, action, subject_type, subject_id, link)
      values (new.created_by, 'assigned a task: ' || new.title, 'task', new.id::text, '/tasks');
      insert into notifications (recipient_id, title, body, link)
      values (
        new.assignee_id,
        'New task from ' || coalesce(assigner, 'an owner'),
        new.title || case
          when new.scope = 'day' then ' — due ' || to_char(new.due_date, 'Dy Mon DD')
          else ' — week of ' || to_char(new.week_start, 'Mon DD')
        end,
        '/tasks'
      );
    else
      insert into activity_events (actor_id, action, subject_type, subject_id, link)
      values (new.created_by, 'added a task: ' || new.title, 'task', new.id::text, '/tasks');
    end if;
  elsif tg_op = 'UPDATE' and new.assignee_id <> old.assignee_id and new.source = 'assigned' then
    select coalesce(nullif(full_name, ''), email) into assigner from profiles where id = auth.uid();
    insert into notifications (recipient_id, title, body, link)
    values (new.assignee_id, 'Task handed to you by ' || coalesce(assigner, 'an owner'), new.title, '/tasks');
  elsif tg_op = 'UPDATE' and new.status = 'done' and old.status <> 'done' then
    insert into activity_events (actor_id, action, subject_type, subject_id, link)
    values (coalesce(auth.uid(), new.assignee_id), 'completed a task: ' || new.title, 'task', new.id::text, '/tasks');
  end if;
  return null;
end $$;

create trigger task_after_change
  after insert or update on public.tasks
  for each row execute function public.task_activity();

-- ───────────── Who can see and change what ─────────────

alter table public.tasks enable row level security;

create policy "owners see all tasks, others their own" on public.tasks for select to authenticated
  using (is_owner() or assignee_id = auth.uid());

create policy "owners add tasks for anyone" on public.tasks for insert to authenticated
  with check (is_owner());

create policy "add own tasks" on public.tasks for insert to authenticated
  with check (assignee_id = auth.uid());

create policy "owners edit all tasks" on public.tasks for update to authenticated
  using (is_owner()) with check (is_owner());

create policy "update own tasks" on public.tasks for update to authenticated
  using (assignee_id = auth.uid()) with check (assignee_id = auth.uid());

create policy "owners delete any task" on public.tasks for delete to authenticated
  using (is_owner());

create policy "delete own self-written tasks" on public.tasks for delete to authenticated
  using (assignee_id = auth.uid() and source = 'self');

commit;
