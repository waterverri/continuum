-- Create custom types
create type public.project_role as enum ('owner', 'editor', 'viewer');

-- Create Profiles table to store public user data
create table public.profiles (
  user_id uuid not null primary key,
  display_name text,
  avatar_url text,
  constraint fk_user foreign key(user_id) references auth.users(id) on delete cascade
);
-- Add comments to profiles table
comment on table public.profiles is 'Public profile information for each user.';

-- Create Projects table
create table public.projects (
  id uuid not null primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
comment on table public.projects is 'Represents a single writing project or story bible.';

-- Create Project Members table for Role-Based Access Control
create table public.project_members (
  project_id uuid not null,
  user_id uuid not null,
  role public.project_role not null default 'viewer',
  primary key (project_id, user_id),
  constraint fk_project foreign key(project_id) references public.projects(id) on delete cascade,
  constraint fk_user foreign key(user_id) references auth.users(id) on delete cascade
);
comment on table public.project_members is 'Links users to projects and defines their role.';

-- Create Documents table
create table public.documents (
    id uuid not null primary key default gen_random_uuid(),
    project_id uuid not null,
    group_id uuid,
    document_type text,
    content text,
    created_at timestamptz not null default now(),
    constraint fk_project foreign key(project_id) references public.projects(id) on delete cascade
);
comment on table public.documents is 'Stores discrete text units like scenes, bios, or lore.';

-- Create Events table
create table public.events (
    id uuid not null primary key default gen_random_uuid(),
    project_id uuid not null,
    name text not null,
    description text,
    time_start bigint,
    time_end bigint,
    created_at timestamptz not null default now(),
    constraint fk_project foreign key(project_id) references public.projects(id) on delete cascade
);
comment on table public.events is 'Stores time-based occurrences with a user-defined numerical timeline.';

-- Create Tags table
create table public.tags (
    id uuid not null primary key default gen_random_uuid(),
    project_id uuid not null,
    document_id uuid,
    event_id uuid,
    key text not null,
    value text,
    constraint fk_project foreign key(project_id) references public.projects(id) on delete cascade,
    constraint fk_document foreign key(document_id) references public.documents(id) on delete cascade,
    constraint fk_event foreign key(event_id) references public.events(id) on delete cascade,
    constraint check_tag_target check (
        (document_id is not null and event_id is null) or 
        (document_id is null and event_id is not null)
    )
);
comment on table public.tags is 'A flexible, user-defined key-value store to link metadata to documents and events.';

-- Create Presets table
create table public.presets (
    id uuid not null primary key default gen_random_uuid(),
    project_id uuid not null,
    name text not null,
    rules jsonb,
    created_at timestamptz not null default now(),
    constraint fk_project foreign key(project_id) references public.projects(id) on delete cascade
);
comment on table public.presets is 'Stores the complex filtering rules for each generated context URL.';


-- Function to create a public profile for a new user
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id);
  return new;
end;
$$;

-- Trigger to execute the function when a new user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to grant project ownership to the creator
create function public.assign_project_owner()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.project_members (project_id, user_id, role)
    values (new.id, auth.uid(), 'owner');
    return new;
end;
$$;

-- Trigger to assign owner role when a project is created
create trigger on_project_created
    after insert on public.projects
    for each row execute procedure public.assign_project_owner();
