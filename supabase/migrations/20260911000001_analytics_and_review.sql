-- Migration: Analytics, Source Run Traceability, Admin Review & Tracker Run Type
-- Task 3, Task 4, Task 5

-- 1. Applications extensions for audit traceability and admin review
alter table public.applications
  add column if not exists source_run_id uuid references public.agent_runs(id) on delete set null;

alter table public.applications
  add column if not exists admin_notes text;

-- 2. Agent runs extensions for tracker sweep segregation
alter table public.agent_runs
  add column if not exists run_type text default 'citizen_interaction'
  check (run_type in ('citizen_interaction', 'tracker_sweep'));

-- 3. Analytics RPC Functions (Admin-only security definer)

create or replace function public.get_applications_by_stage()
returns table(name text, count bigint) as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Admin role required for analytics';
  end if;

  return query
    select
      a.status::text as name,
      count(*)::bigint as count
    from public.applications a
    group by a.status;
end;
$$ language plpgsql security definer;

create or replace function public.get_document_volume_by_day(days int default 7)
returns table(name text, count bigint) as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Admin role required for analytics';
  end if;

  return query
    select
      to_char(date_trunc('day', d.uploaded_at), 'YYYY-MM-DD') as name,
      count(*)::bigint as count
    from public.documents d
    where d.uploaded_at >= (now() - (days || ' days')::interval)
    group by date_trunc('day', d.uploaded_at)
    order by date_trunc('day', d.uploaded_at) asc;
end;
$$ language plpgsql security definer;

create or replace function public.get_agent_task_distribution()
returns table(name text, value bigint) as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Admin role required for analytics';
  end if;

  return query
    select
      e.agent_name::text as name,
      count(*)::bigint as value
    from public.agent_events e
    group by e.agent_name
    order by value desc;
end;
$$ language plpgsql security definer;

create or replace function public.get_completion_rate_by_month(months int default 6)
returns table(name text, rate numeric) as $$
begin
  if not public.is_admin() then
    raise exception 'Access denied: Admin role required for analytics';
  end if;

  return query
    select
      to_char(date_trunc('month', a.created_at), 'Mon YYYY') as name,
      round(
        (count(*) filter (where a.status = 'approved')::numeric / nullif(count(*), 0)::numeric) * 100,
        1
      ) as rate
    from public.applications a
    where a.created_at >= (now() - (months || ' months')::interval)
    group by date_trunc('month', a.created_at)
    order by date_trunc('month', a.created_at) asc;
end;
$$ language plpgsql security definer;
