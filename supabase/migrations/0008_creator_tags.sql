-- Casting tags for UGC creators: ethnicity, age group, style, and any groups
-- the team adds later.
-- Runs as one transaction: if anything fails, nothing is applied.

begin;

-- ───────────── Groups and tags ─────────────

-- A group is one question about a creator (e.g. "Age group"). Single-choice groups
-- allow one answer per creator; multi-choice groups (e.g. "Style") allow several.
create table public.creator_tag_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  single_choice boolean not null default false,
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index creator_tag_groups_name on public.creator_tag_groups (lower(trim(name)));

create table public.creator_tags (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.creator_tag_groups (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index creator_tags_name on public.creator_tags (group_id, lower(trim(name)));

-- ───────────── Which creator has which tag ─────────────

create table public.creator_tag_assignments (
  creator_id uuid not null references public.ugc_creators (id) on delete cascade,
  tag_id uuid not null references public.creator_tags (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (creator_id, tag_id)
);

create index on public.creator_tag_assignments (tag_id);

-- Who assigned it is recorded by the database. In a single-choice group the new
-- tag replaces the creator's previous one (Black → White, 30–39 → 40–49).
-- Runs with database rights so it can remove the old tag; the insert itself is
-- still checked by the policies below.
create function public.creator_tag_assignment_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g creator_tag_groups%rowtype;
  t creator_tags%rowtype;
begin
  select * into t from creator_tags where id = new.tag_id;
  select * into g from creator_tag_groups where id = t.group_id;
  if t.archived or g.archived then
    raise exception 'The tag "%" is archived. Unarchive it before using it.', t.name;
  end if;

  new.assigned_by := auth.uid();
  new.assigned_at := now();

  if g.single_choice then
    -- One change at a time per creator, so two people can't both win.
    perform 1 from ugc_creators where id = new.creator_id for update;
    delete from creator_tag_assignments a
    using creator_tags x
    where a.creator_id = new.creator_id
      and a.tag_id = x.id
      and x.group_id = g.id
      and a.tag_id <> new.tag_id;
  end if;
  return new;
end $$;

create trigger creator_tag_assignment_before
  before insert on public.creator_tag_assignments
  for each row execute function public.creator_tag_assignment_before();

-- A group can only be switched to single-choice when nobody has two of its tags.
create function public.creator_tag_group_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.single_choice and not old.single_choice and exists (
    select 1
    from creator_tag_assignments a
    join creator_tags t on t.id = a.tag_id
    where t.group_id = new.id
    group by a.creator_id
    having count(*) > 1
  ) then
    raise exception 'Some creators have more than one "%" tag. Remove the extras before making it one-choice.', new.name;
  end if;
  return new;
end $$;

create trigger creator_tag_group_before
  before update on public.creator_tag_groups
  for each row execute function public.creator_tag_group_before();

-- A tag can't move to a different group (it would break single-choice groups).
create function public.creator_tag_before() returns trigger
language plpgsql as $$
begin
  if new.group_id <> old.group_id then
    raise exception 'A tag can''t be moved to another group. Create a new tag instead.';
  end if;
  return new;
end $$;

create trigger creator_tag_before
  before update on public.creator_tags
  for each row execute function public.creator_tag_before();

-- ───────────── Starting tags ─────────────

with g as (
  insert into public.creator_tag_groups (name, single_choice, sort_order) values
    ('Ethnicity', true, 1),
    ('Age group', true, 2),
    ('Style', false, 3)
  returning id, name
)
insert into public.creator_tags (group_id, name, sort_order)
select g.id, t.name, t.sort_order
from g
join (values
  ('Ethnicity', 'Black', 1),
  ('Ethnicity', 'White', 2),
  ('Ethnicity', 'Hispanic / Latina', 3),
  ('Ethnicity', 'Asian', 4),
  ('Ethnicity', 'Mixed', 5),
  ('Ethnicity', 'Other', 6),
  ('Age group', '20–29', 1),
  ('Age group', '30–39', 2),
  ('Age group', '40–49', 3),
  ('Age group', '50–59', 4),
  ('Age group', '60+', 5),
  ('Style', 'Energetic', 1),
  ('Style', 'Calm', 2),
  ('Style', 'Funny', 3),
  ('Style', 'Relatable', 4),
  ('Style', 'Polished', 5),
  ('Style', 'Mom', 6),
  ('Style', 'Pet owner', 7)
) as t (group_name, name, sort_order) on t.group_name = g.name;

-- ───────────── Row-level security ─────────────

alter table public.creator_tag_groups enable row level security;
alter table public.creator_tags enable row level security;
alter table public.creator_tag_assignments enable row level security;

-- Everyone who can see creators can see tags (owners, strategists, UGC managers).
create policy "ugc team reads tag groups" on public.creator_tag_groups for select to authenticated using (has_ugc_access());
create policy "ugc team reads tags" on public.creator_tags for select to authenticated using (has_ugc_access());
create policy "ugc team reads tag assignments" on public.creator_tag_assignments for select to authenticated using (has_ugc_access());

-- Owners and UGC managers add, rename and archive groups and tags. Nobody deletes
-- them here (archive instead), so past tagging isn't lost by accident.
create policy "owners and ugc managers add tag groups" on public.creator_tag_groups for insert to authenticated
  with check (my_role() in ('owner', 'ugc_manager'));
create policy "owners and ugc managers edit tag groups" on public.creator_tag_groups for update to authenticated
  using (my_role() in ('owner', 'ugc_manager'))
  with check (my_role() in ('owner', 'ugc_manager'));
create policy "owners and ugc managers add tags" on public.creator_tags for insert to authenticated
  with check (my_role() in ('owner', 'ugc_manager'));
create policy "owners and ugc managers edit tags" on public.creator_tags for update to authenticated
  using (my_role() in ('owner', 'ugc_manager'))
  with check (my_role() in ('owner', 'ugc_manager'));

-- Owners and UGC managers tag any creator; strategists tag creators assigned to them.
create policy "tag creators" on public.creator_tag_assignments for insert to authenticated
  with check (
    my_role() in ('owner', 'ugc_manager')
    or (my_role() = 'strategist' and exists (
      select 1 from ugc_creators c where c.id = creator_id and c.assigned_strategist_id = auth.uid()
    ))
  );
create policy "untag creators" on public.creator_tag_assignments for delete to authenticated
  using (
    my_role() in ('owner', 'ugc_manager')
    or (my_role() = 'strategist' and exists (
      select 1 from ugc_creators c where c.id = creator_id and c.assigned_strategist_id = auth.uid()
    ))
  );

commit;
