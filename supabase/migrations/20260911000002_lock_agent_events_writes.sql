-- Migration: Lock agent_events writes to service_role only
-- Task 8: Agent-event write security (RLS fix)

-- Drop the overly permissive insert policy that allowed any authenticated citizen to write events
drop policy if exists "agent_events_insert_all" on public.agent_events;

-- Only the backend service role may write agent_events.
-- Citizens and admins may only read via existing "agent_events_via_run" select policy.
create policy "agent_events_insert_service_role_only" on public.agent_events
  for insert with check (auth.jwt()->>'role' = 'service_role');
