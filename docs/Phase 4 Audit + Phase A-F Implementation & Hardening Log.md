# SAHAYAK — Full Codebase Audit, Pause/Resume Engine & UI Hardening (Phases A–F)

## Executive Summary

This document provides a comprehensive audit and implementation log across the SAHAYAK stack (FastAPI/LangGraph backend, React/TanStack frontend, and Supabase Edge Functions/Postgres). It addresses the core bugs identified in the prompt:

1. **The Central Bug**: Agent runs dead-ending in `ACTION REQUIRED` without ability to pause/resume upon document upload.
2. **The Summary Screen Bug**: Completed runs failing to show the final application draft and next steps.
3. **Mock Data Contamination**: Fake fallback citizens (`Rahul Sharma`), demo schemes masquerading as live catalog data, hardcoded applicant attributes, and incorrect Gemini model defaults.
4. **Lifecycle & Timeout Failures**: Arbitrary 45-second client-side timeouts, placeholder run ID race conditions, and silent WebSocket disconnects.
5. **UI & Thinking Stream**: Ungoverned journey timeline height, missing Perplexity-style auto-scroll, missing step audit evidence, and missing inline uploader.
6. **Cost & Token Optimization**: Unbatched text rule LLM evaluations, un-cached intent classifications, and unbounded retries.

---

## Phase-by-Phase Changes & Verification

### Phase A: Eradicate Mock Data Masquerading as Live Data

- **`backend/app.py`**:
  - Removed the fabricated citizen profile fallback (`Rahul Sharma`, OBC, Lucknow).
  - When a profile cannot be fetched or is missing, the backend immediately halts the run with status `ERROR` and writes a system audit event informing the user to complete their profile.
- **`backend/agent_graph.py`**:
  - `application_agent_node`: Removed hardcoded `15-08-2004` and `XXXX-XXXX-4321`. Dynamically pulls citizen DOB and account metadata from profile and verified document records, marking any missing fields explicitly as `needs_review` with an honest review flag.
- **`backend/document_extractor.py`**:
  - Fixed `GEMINI_MODEL` default from nonexistent `"gemini-3.6-flash"` to `"gemini-2.0-flash"`.
- **`src/lib/services.ts`**:
  - `findRelevantSchemes`: Returns an empty array rather than silently injecting `LOCAL_DEMO_SCHEMES_DB` when connected to Supabase.
  - `checkEligibility`: Returns unverified criteria with retry guidance when rule fetch fails, rather than fabricating a "verified" pass.
  - `prepareApplication`: Throws a `ServiceResult.err` when profile lookup fails rather than returning fake draft `SAH-2026-004281`.
- **`src/routes/__root.tsx`**:
  - Added a persistent `DEMO MODE — Running with local mock database (Supabase not configured)` header badge visible only when `!isSupabaseConfigured`.

---

### Phase B: Run Lifecycle Reliability

- **`src/hooks/use-agent-run.ts`**:
  - **Removed Blind 45s Timeout**: Eliminated the hardcoded 45s timer.
  - **Connection Watchdog (12s)**: Shows `"Connecting to your AI workforce..."` if initial events are delayed without marking the run in `ERROR`.
  - **Graceful 90s Idle Detector**: If the backend stalls for 90s with zero events and no status change, provides an interactive "Backend taking longer than expected. Refresh or wait" banner instead of force-aborting.
  - **Eliminated Placeholder ID Race**: `startRun()` sets `isSubmitting = true` and only sets `runId` once the server responds with the actual UUID.
  - **Network Failure Handling**: Network errors reject immediately and set status to `ERROR` with retry affordance.
  - **REST Polling Fallback**: Automatically polls `agent_events` and `agent_runs` every 2.5s whenever the Supabase Realtime channel reports `CHANNEL_ERROR` or `TIMED_OUT`.

---

### Phase C: True Pause & Resume for Missing Documents

- **Database Schema (`supabase/migrations/20260912000000_pending_requirements.sql`)**:
  - Added `pending_requirements jsonb` and `selected_scheme_id uuid` to `agent_runs`.
- **State Definition (`backend/state.py`)**:
  - Added `pending_requirements: Optional[List[Dict[str, Any]]]` to `SahayakState`.
- **Backend Graph (`backend/agent_graph.py`)**:
  - `document_agent_node`: When mandatory documents are missing, sets state `status = "ACTION REQUIRED"`, populates `pending_requirements`, and routes to `END` rather than looping in-process.
  - Exported `sahayak_resumed_workflow` sub-graph (`eligibility_agent -> document_agent -> application_agent -> END`) to resume existing runs without re-running citizen and scheme agents.
- **Backend API (`backend/app.py`)**:
  - Added `POST /run/{run_id}/resume`: Authenticated via `X-Sahayak-Internal-Secret`. Reconstructs `SahayakState` from database records, re-evaluates eligibility against newly uploaded documents, and advances to application drafting.
  - Updated `run_document_extraction_task`: Once a document is verified, scans for any `agent_runs` in `ACTION REQUIRED` for that citizen and automatically fires background resume.
- **Frontend Chat (`src/routes/assistant.tsx`)**:
  - Added an inline **Action Required: Document Missing** card in chat.
  - Users can drag & drop or select the missing document directly in chat.
  - Upon upload and verification, shows a live `"Extracting & re-checking..."` indicator and transitions back to live orchestration when the resumed run streams new events.

---

### Phase D: Application Ready Final Summary

- **`src/routes/assistant.tsx`**:
  - Listens to `latestData.application_draft` from `agent_events`.
  - When `status === "COMPLETED"`, renders an **Application Ready & Verified** summary card displaying:
    - Official Draft Tracking ID.
    - Verified Target Scheme Name.
    - Key Applicant Information table with status badges (`Verified from Profile / Docs` vs `Review Required`).
    - Direct CTAs: **"Review & Submit Application"** (navigates to `/applications/$id`) and **"Track in Dashboard"** (navigates to `/dashboard`).

---

### Phase E: Perplexity-Style Research & Timeline UX

- **`src/routes/assistant.tsx`**:
  - Wrapped journey timeline in a fixed-height scroll container: `h-[650px] max-h-[75vh] overflow-y-auto`.
  - Smart auto-scroll: Scrolls to bottom on new events only when the user is within 80px of bottom.
  - **"Jump to latest" pill button**: Appears with an indicator when the user scrolls up and new agent activity arrives.
  - **Collapsible Step Findings**: Each step renders an expandable panel containing structured findings (intent analysis, candidate schemes, criterion breakdowns).
  - **Criterion Audit Evidence**: Displays backend-computed rule evidence in an expandable "Show evidence" toggle.
  - **Contextual Loading Copy**: Dynamic header copy driven by `activeAgentIndex` (e.g., "Scheme Agent is searching...", "Eligibility Agent is checking criteria...").
  - **Skeleton Loaders**: Added Skeleton loading cards while waiting for initial scheme discovery.

---

### Phase F: Cost & Reliability Hardening

- **`backend/agent_graph.py`**:
  - **Batched Text Rule Evaluation**: Implemented `evaluate_text_rules_batched()` which batches all qualitative text criteria for a scheme into a single Groq JSON call rather than 1 call per criterion.
  - **Intent Classification LRU Cache**: Added `_INTENT_CACHE` in `citizen_agent_node` to avoid duplicate LLM calls on repeated or identical queries.
  - **Tier-Specific Retries**: Reduced `MODEL_FAST` max retries to 1.
- **`backend/app.py`**:
  - Updated `/health` endpoint with `internal_secret_configured` and `gemini_configured` booleans.
- **`src/lib/services.ts`**:
  - Direct local backend execution is strictly guarded by `import.meta.env.DEV` to prevent embedding dev secrets in production bundles.

---

## Verification Summary

- **Frontend Build**: Verified via `npm run build` — compiled cleanly with zero errors across all SSR routes.
- **Backend Import & Compilation**: Verified via `backend/.venv/bin/python` — all modules (`app`, `agent_graph`, `document_extractor`, `state`) load with zero syntax or import errors.
