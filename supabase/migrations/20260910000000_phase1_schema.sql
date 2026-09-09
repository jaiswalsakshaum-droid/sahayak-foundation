-- ==============================================================================
-- Sahayak — Phase 1 Database Schema & Row Level Security (RLS)
-- Team DietCode · Build with Bharat 2.0
-- ==============================================================================

-- Enable UUID generation extension if not already enabled
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Profiles (extends auth.users)
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  age int,
  location text,
  occupation text,
  annual_income numeric,
  phone text,
  role text not null default 'citizen' check (role in ('citizen', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 2. Schemes Catalog & Requirements
-- ------------------------------------------------------------------------------
create table if not exists public.schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  jurisdiction text not null check (jurisdiction in ('Central', 'State')),
  benefit text,
  description text,
  official_source text,
  eligibility_status text not null default 'Active' check (eligibility_status in ('Active', 'Draft', 'Archived')),
  last_verified timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  criterion_name text not null,
  requirement text not null,
  rule_type text not null check (rule_type in ('numeric', 'boolean', 'enum', 'text')),
  evidence_source text,
  created_at timestamptz not null default now()
);

create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  document_type text not null,
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. Citizen Documents & Storage Metadata
-- ------------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null,
  file_path text,                      -- Storage object path
  file_name text,
  file_size int,
  mime_type text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'needs_review', 'rejected', 'missing')),
  confidence numeric,
  extracted_fields jsonb default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. Applications & Linked Documents
-- ------------------------------------------------------------------------------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  scheme_id uuid not null references public.schemes(id),
  status text not null default 'draft'
    check (status in ('draft', 'awaiting_approval', 'submitted', 'under_review', 'approved', 'rejected')),
  applicant_info jsonb default '{}'::jsonb,
  tracking_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_documents (
  application_id uuid references public.applications(id) on delete cascade,
  document_id uuid references public.documents(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'needs_review')),
  primary key (application_id, document_id)
);

-- ------------------------------------------------------------------------------
-- 5. Agent Orchestration, Runs & Audit
-- ------------------------------------------------------------------------------
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  input_query text,
  status text not null default 'PROCESSING'
    check (status in ('ONLINE', 'PROCESSING', 'WAITING', 'ACTION REQUIRED', 'COMPLETED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_name text not null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.agent_runs(id) on delete set null,
  agent_name text not null,
  action text not null,
  evidence text,
  result text,
  created_at timestamptz not null default now()
);

create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  shared_data text[],
  purpose text,
  approved_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info' check (type in ('info', 'warning', 'critical', 'success')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 6. Helper Functions & Triggers
-- ------------------------------------------------------------------------------

-- Function to check if the current user has the admin role
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- Auto-create profile on auth.users signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Citizen User'),
    coalesce(new.raw_user_meta_data->>'phone', new.phone)
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 7. Row Level Security (RLS)
-- ------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.schemes enable row level security;
alter table public.eligibility_rules enable row level security;
alter table public.document_requirements enable row level security;
alter table public.documents enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.consent_records enable row level security;
alter table public.notifications enable row level security;

-- Profiles Policies
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "profiles_insert_own_or_admin" on public.profiles
  for insert with check (id = auth.uid() or public.is_admin());

-- Schemes, Rules & Requirements (Publicly readable, Admin manageable)
create policy "schemes_public_select" on public.schemes
  for select using (true);

create policy "schemes_admin_all" on public.schemes
  for all using (public.is_admin());

create policy "eligibility_rules_public_select" on public.eligibility_rules
  for select using (true);

create policy "eligibility_rules_admin_all" on public.eligibility_rules
  for all using (public.is_admin());

create policy "document_requirements_public_select" on public.document_requirements
  for select using (true);

create policy "document_requirements_admin_all" on public.document_requirements
  for all using (public.is_admin());

-- Citizen Document Policies
create policy "documents_citizen_or_admin" on public.documents
  for all using (citizen_id = auth.uid() or public.is_admin());

-- Applications Policies
create policy "applications_citizen_or_admin" on public.applications
  for all using (citizen_id = auth.uid() or public.is_admin());

create policy "app_docs_citizen_or_admin" on public.application_documents
  for all using (
    exists (
      select 1 from public.applications a
      where a.id = application_id and (a.citizen_id = auth.uid() or public.is_admin())
    )
  );

-- Agent Orchestration Policies
create policy "agent_runs_citizen_or_admin" on public.agent_runs
  for all using (citizen_id = auth.uid() or public.is_admin());

create policy "agent_events_via_run" on public.agent_events
  for select using (
    exists (
      select 1 from public.agent_runs r
      where r.id = run_id and (r.citizen_id = auth.uid() or public.is_admin())
    )
  );

create policy "agent_events_insert_all" on public.agent_events
  for insert with check (
    exists (
      select 1 from public.agent_runs r
      where r.id = run_id and (r.citizen_id = auth.uid() or public.is_admin())
    )
  );

create policy "audit_logs_via_run_or_admin" on public.audit_logs
  for select using (
    public.is_admin() or
    exists (
      select 1 from public.agent_runs r
      where r.id = run_id and r.citizen_id = auth.uid()
    )
  );

create policy "audit_logs_insert_admin_or_system" on public.audit_logs
  for insert with check (true);

-- Consent & Notifications
create policy "consent_citizen_or_admin" on public.consent_records
  for all using (citizen_id = auth.uid() or public.is_admin());

create policy "notifications_citizen_or_admin" on public.notifications
  for all using (citizen_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. Supabase Storage Policies (documents bucket)
-- ------------------------------------------------------------------------------

-- Create the storage bucket if storage schema is available
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

create policy "documents_citizen_upload" on storage.objects
  for insert with check (
    bucket_id = 'documents' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "documents_citizen_read" on storage.objects
  for select using (
    bucket_id = 'documents' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );

create policy "documents_citizen_delete" on storage.objects
  for delete using (
    bucket_id = 'documents' and
    (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin())
  );
