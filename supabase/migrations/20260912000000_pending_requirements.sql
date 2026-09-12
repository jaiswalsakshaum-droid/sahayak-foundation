-- Migration: Add pending_requirements and selected_scheme_id to agent_runs for pause & resume lifecycle
alter table public.agent_runs
  add column if not exists pending_requirements jsonb default '[]'::jsonb,
  add column if not exists selected_scheme_id uuid references public.schemes(id) on delete set null;
