-- Owner Calendar: a private task calendar for the owners (Eric and Kaelam).
-- Nobody else can see or change anything here, and nothing from it goes to
-- the team-wide activity feed.
--
-- Run once in the Supabase SQL editor. It's one transaction: if anything
-- fails, nothing is changed.

begin;

-- ───────────── Categories ("what it's for") ─────────────

create table public.owner_task_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  color text, -- optional hex colour, e.g. #7c3aed
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index owner_task_categories_name_key on public.owner_task_categories (lower(trim(name)));

insert into public.owner_task_categories (name, sort_order) values
  ('R&D', 1),
  ('Creative', 2),
  ('Legal', 3),
  ('Employment', 4);

-- ───────────── Tasks ─────────────

create type public.owner_task_status as enum ('todo', 'done');

create table public.owner_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  notes text,
  category_id uuid references public.owner_task_categories (id) on delete set null,
  due_date date not null,
  due_time time,
  created_by uuid references public.profiles (id) on delete set null,
  -- Which owner it's for; empty means both.
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.owner_task_status not null default 'todo',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index on public.owner_tasks (due_date);
create index on public.owner_tasks (status);

-- The database fills in who created it and when it was finished, and makes
-- sure a task is only ever "for" an owner.
create function public.owner_task_rules() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null
     and not exists (select 1 from profiles where id = new.assignee_id and role = 'owner') then
    raise exception 'Owner tasks can only be for an owner';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  if new.status = 'done' then
    new.completed_at := case when tg_op = 'UPDATE' and old.status = 'done' then old.completed_at else now() end;
  else
    new.completed_at := null;
  end if;
  return new;
end $$;

create trigger owner_task_rules
  before insert or update on public.owner_tasks
  for each row execute function public.owner_task_rules();

-- ───────────── Owners only ─────────────

alter table public.owner_task_categories enable row level security;
alter table public.owner_tasks enable row level security;

create policy "owners manage categories" on public.owner_task_categories
  for all to authenticated using (is_owner()) with check (is_owner());

create policy "owners manage owner tasks" on public.owner_tasks
  for all to authenticated using (is_owner()) with check (is_owner());

commit;
