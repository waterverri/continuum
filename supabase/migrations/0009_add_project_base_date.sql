-- Add base_date column to projects table for timeline T0 reference
alter table public.projects add column base_date date not null default current_date;

comment on column public.projects.base_date is 'Date that corresponds to T0 in the project timeline. All event times are calculated relative to this date.';