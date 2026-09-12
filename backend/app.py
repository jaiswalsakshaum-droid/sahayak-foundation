import os
import sys
import time
import json
import uuid
import re
import httpx
import logging
from pathlib import Path
from typing import Dict, Any, Optional

# Ensure local backend directory is on sys.path for direct flat imports
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from supabase import create_client, Client

try:
    from agent_graph import (
        sahayak_agent_workflow,
        sahayak_resumed_workflow,
        write_agent_event,
        tracker_agent_node,
    )
    from document_extractor import extract_document_data
except ImportError:
    from backend.agent_graph import (
        sahayak_agent_workflow,
        sahayak_resumed_workflow,
        write_agent_event,
        tracker_agent_node,
    )
    from backend.document_extractor import extract_document_data

load_dotenv()
logger = logging.getLogger("sahayak.api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Sahayak AI Workforce Microservice",
    description="LangGraph Multi-Agent Backend with Groq Vision & Intelligence for Civic Scheme Navigation",
    version="3.0.0",
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_SECRET = os.getenv("INTERNAL_SHARED_SECRET", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

groq_client = None
if GROQ_API_KEY:
    try:
        from groq import Groq
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as ge:
        logger.warning(f"Could not initialize Groq client: {ge}")

supabase_admin: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.warning(f"Could not connect to Supabase from FastAPI: {e}")

# ==============================================================================
# Security Dependency
# ==============================================================================

def verify_internal_secret(
    x_sahayak_internal_secret: Optional[str] = Header(None, alias="X-Sahayak-Internal-Secret")
):
    """
    Strictly enforces internal secret authentication.
    Rejects any unauthenticated or mismatching requests with HTTP 403 Forbidden.
    """
    if not INTERNAL_SECRET:
        logger.error("CRITICAL: INTERNAL_SHARED_SECRET is not configured in server environment!")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: missing internal shared secret",
        )
    if not x_sahayak_internal_secret or x_sahayak_internal_secret != INTERNAL_SECRET:
        logger.warning("Unauthorized API access attempt with invalid secret header.")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid or missing X-Sahayak-Internal-Secret header",
        )
    return True

# ==============================================================================
# Schemas
# ==============================================================================

class RunRequest(BaseModel):
    run_id: str = Field(description="Unique agent_run UUID")
    citizen_id: str = Field(description="Citizen profile UUID")
    query: str = Field(description="Natural language query from citizen")

class ExtractDocumentRequest(BaseModel):
    document_id: str = Field(description="UUID of document to extract")

class TrackRequest(BaseModel):
    citizen_id: str
    application_id: str
    tracking_id: str
    scheme_name: str

class ResumeRequest(BaseModel):
    force_complete: Optional[bool] = Field(default=False, description="Proceed to draft generation even with missing docs")

# ==============================================================================
# Background Runners
# ==============================================================================

async def run_langgraph_task(run_id: str, citizen_id: str, query: str):
    """Executes the LangGraph agent graph in background without blocking response."""
    import time
    logger.info(f"Starting background LangGraph run for run_id={run_id}")
    
    citizen_profile = {}

    if supabase_admin and citizen_id:
        try:
            res = supabase_admin.table("profiles").select("*").eq("id", citizen_id).maybe_single().execute()
            if res.data:
                citizen_profile = res.data
            else:
                logger.error(f"Profile not found for citizen_id={citizen_id}")
                write_agent_event(run_id, "System", "Citizen profile not found. Please complete your profile before evaluating schemes.", event_code="PROFILE_MISSING")
                if supabase_admin:
                    supabase_admin.table("agent_runs").update({
                        "status": "FAILED",
                        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }).eq("id", run_id).execute()
                return
        except Exception as e:
            logger.error(f"Could not load citizen profile for citizen_id={citizen_id}: {e}")
            write_agent_event(run_id, "System", f"Error loading citizen profile: {str(e)[:100]}", event_code="PROFILE_ERROR")
            if supabase_admin:
                supabase_admin.table("agent_runs").update({
                    "status": "FAILED",
                    "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }).eq("id", run_id).execute()
            return

    initial_state = {
        "run_id": run_id,
        "citizen_id": citizen_id,
        "query": query,
        "citizen_profile": citizen_profile,
        "intent": None,
        "candidate_schemes": None,
        "selected_scheme_id": None,
        "eligibility_result": None,
        "missing_documents": None,
        "pending_requirements": None,
        "application_draft": None,
        "next_action": None,
        "retry_count": 0,
        "error": None,
    }

    try:
        sahayak_agent_workflow.invoke(initial_state)
        logger.info(f"LangGraph execution finished successfully for run_id={run_id}")
    except Exception as e:
        logger.error(f"Error executing LangGraph for run_id={run_id}: {e}")
        write_agent_event(run_id, "System", f"Workflow execution issue: {str(e)[:120]}", event_code="WORKFLOW_ERROR")
        if supabase_admin and run_id:
            try:
                supabase_admin.table("agent_runs").update({
                    "status": "FAILED",
                    "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }).eq("id", run_id).execute()
            except Exception as ue:
                logger.error(f"Error updating agent_run error status: {ue}")

async def run_resumed_langgraph_task(run_id: str, force_complete: bool = False):
    """Resumes an existing paused agent_run after required documents have been uploaded or user forces continue."""
    import time
    logger.info(f"Resuming background LangGraph run for run_id={run_id} (force_complete={force_complete})")
    if not supabase_admin:
        logger.error("Supabase client not configured for resume task")
        return

    try:
        # 1. Fetch agent_runs record
        run_res = supabase_admin.table("agent_runs").select("*").eq("id", run_id).maybe_single().execute()
        run_data = run_res.data
        if not run_data:
            logger.error(f"Cannot resume: agent_run {run_id} not found")
            return

        citizen_id = run_data.get("citizen_id", "")
        selected_scheme_id = run_data.get("selected_scheme_id")

        # If selected_scheme_id was not on run row, fallback to finding it in agent_events
        if not selected_scheme_id:
            events_res = supabase_admin.table("agent_events").select("details").eq("run_id", run_id).execute()
            for ev in events_res.data or []:
                details = ev.get("details") or {}
                if "selected_scheme_id" in details and details["selected_scheme_id"]:
                    selected_scheme_id = details["selected_scheme_id"]
                    break

        if not selected_scheme_id:
            selected_scheme_id = "a0000000-0000-0000-0000-000000000001"

        # 2. Fetch citizen profile
        prof_res = supabase_admin.table("profiles").select("*").eq("id", citizen_id).maybe_single().execute()
        citizen_profile = prof_res.data or {}

        # 3. Flip status back to PROCESSING
        try:
            supabase_admin.table("agent_runs").update({
                "status": "PROCESSING",
            }).eq("id", run_id).execute()
        except Exception:
            pass

        write_agent_event(
            run_id,
            "System",
            "Resuming AI workforce: re-evaluating civic criteria with updated records...",
            event_code="WORKFLOW_RESUMED",
        )

        resumed_state = {
            "run_id": run_id,
            "citizen_id": citizen_id,
            "query": run_data.get("input_query", ""),
            "citizen_profile": citizen_profile,
            "intent": None,
            "candidate_schemes": None,
            "selected_scheme_id": selected_scheme_id,
            "eligibility_result": None,
            "missing_documents": None,
            "pending_requirements": None,
            "application_draft": None,
            "next_action": None,
            "retry_count": 1,
            "error": None,
        }

        if force_complete:
            write_agent_event(
                run_id,
                "Application Agent",
                "Proceeding with available documents. Assembling application draft with review flags...",
                {"thought": "Citizen chose to continue. Missing items will be tagged for manual review."}
            )
            from agent_graph import application_agent_node, tracker_agent_node
            app_res = application_agent_node(resumed_state)
            resumed_state.update(app_res)
            tracker_agent_node(resumed_state)
            
            if supabase_admin and run_id:
                try:
                    supabase_admin.table("agent_runs").update({
                        "status": "COMPLETED",
                        "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    }).eq("id", run_id).execute()
                    logger.info(f"Updated agent_run {run_id} to COMPLETED after force resume.")
                except Exception as ue:
                    logger.error(f"Error updating agent_run completed status on resume: {ue}")
        else:
            final_res = sahayak_resumed_workflow.invoke(resumed_state)
            if supabase_admin and run_id:
                missing = resumed_state.get("missing_documents")
                if not missing or len(missing) == 0 or resumed_state.get("application_draft"):
                    try:
                        supabase_admin.table("agent_runs").update({
                            "status": "COMPLETED",
                            "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        }).eq("id", run_id).execute()
                    except Exception as ue:
                        logger.error(f"Error updating agent_run completed status: {ue}")

        logger.info(f"Resumed LangGraph execution finished for run_id={run_id}")
    except Exception as e:
        logger.error(f"Error resuming LangGraph for run_id={run_id}: {e}")
        write_agent_event(run_id, "System", f"Resume workflow issue: {str(e)[:120]}", event_code="WORKFLOW_ERROR")
        if supabase_admin and run_id:
            try:
                supabase_admin.table("agent_runs").update({
                    "status": "FAILED",
                    "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }).eq("id", run_id).execute()
            except Exception as ue:
                logger.error(f"Error updating agent_run error status on resume: {ue}")

async def run_document_extraction_task(document_id: str):
    """Executes document intelligence extraction in the background and auto-resumes paused runs if applicable."""
    logger.info(f"Starting document extraction for document_id={document_id}")
    try:
        # Find citizen_id and active run_id if any
        if supabase_admin:
            d_res = supabase_admin.table("documents").select("citizen_id, document_type").eq("id", document_id).maybe_single().execute()
            if d_res.data:
                c_id = d_res.data.get("citizen_id")
                # Look for matching active/paused run
                r_res = supabase_admin.table("agent_runs").select("id").eq("citizen_id", c_id).in_("status", ["PROCESSING", "ACTION REQUIRED"]).order("started_at", desc=True).limit(1).execute()
                active_run_id = r_res.data[0]["id"] if (r_res.data and len(r_res.data) > 0) else None
                if active_run_id:
                    write_agent_event(
                        active_run_id,
                        "Document Agent",
                        f"Vision AI (Gemini 3.6 Flash) is analyzing uploaded {d_res.data.get('document_type', 'document')}...",
                        {"thought": "Processing multimodal OCR and extracting official civic fields."}
                    )

        extracted = extract_document_data(document_id)
        
        # Check if citizen has a paused agent_run that can be auto-resumed
        if supabase_admin and extracted and extracted.get("document_type"):
            doc_res = supabase_admin.table("documents").select("citizen_id, status, document_type").eq("id", document_id).maybe_single().execute()
            if doc_res.data and doc_res.data.get("status") in ["verified", "needs_review"]:
                c_id = doc_res.data.get("citizen_id")
                verified_type = doc_res.data.get("document_type", "").lower()
                
                # Find runs in ACTION REQUIRED or ACTION_REQUIRED for this citizen
                paused_runs = supabase_admin.table("agent_runs").select("id").eq("citizen_id", c_id).in_("status", ["ACTION REQUIRED", "ACTION_REQUIRED"]).execute()
                for pr in paused_runs.data or []:
                    logger.info(f"Auto-triggering resume for paused agent_run={pr['id']} after extraction of {verified_type}")
                    write_agent_event(
                        pr["id"],
                        "Document Agent",
                        f"Document verified ({doc_res.data.get('document_type')}). Auto-resuming workforce verification...",
                        {"thought": "Uploaded document verified on file. Re-evaluating criteria."}
                    )
                    await run_resumed_langgraph_task(pr["id"], force_complete=False)
                    break
    except Exception as e:
        logger.error(f"Error in document extraction for {document_id}: {e}")

# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/health")
def health_check():
    """Health check for pre-warming Render container before demo slots."""
    return {
        "status": "healthy",
        "service": "sahayak-langgraph-backend",
        "version": "3.1.0",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "supabase_configured": bool(supabase_admin is not None),
        "internal_secret_configured": bool(INTERNAL_SECRET),
        "gemini_configured": bool(os.getenv("GOOGLE_API_KEY")),
    }

@app.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def start_orchestration(
    req: RunRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_internal_secret),
):
    """Triggers multi-agent orchestration for a citizen query."""
    background_tasks.add_task(run_langgraph_task, req.run_id, req.citizen_id, req.query)
    return {
        "status": "accepted",
        "run_id": req.run_id,
        "message": "Orchestration started in background.",
    }

@app.post("/run/{run_id}/resume", status_code=status.HTTP_202_ACCEPTED)
async def resume_orchestration(
    run_id: str,
    background_tasks: BackgroundTasks,
    req: Optional[ResumeRequest] = None,
    _: bool = Depends(verify_internal_secret),
):
    """Resumes a paused multi-agent orchestration run after missing document upload or force complete."""
    force = req.force_complete if req else False
    background_tasks.add_task(run_resumed_langgraph_task, run_id, force)
    return {
        "status": "accepted",
        "run_id": run_id,
        "message": "Resumed orchestration started in background.",
    }

@app.post("/extract-document", status_code=status.HTTP_202_ACCEPTED)
async def extract_document(
    req: ExtractDocumentRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_internal_secret),
):
    """Triggers Gemini Vision / OCR Document Intelligence extraction on an uploaded file."""
    background_tasks.add_task(run_document_extraction_task, req.document_id)
    return {
        "status": "accepted",
        "document_id": req.document_id,
        "message": "Document intelligence extraction initiated.",
    }

class TrackerRunRequest(BaseModel):
    citizen_id: Optional[str] = Field(default=None, description="Optional citizen UUID to scope sweep")
    run_id: Optional[str] = Field(default=None, description="Optional agent run UUID for audit trail")

@app.post("/tracker/run", status_code=status.HTTP_200_OK)
def run_tracker_sweep(
    req: TrackerRunRequest,
    _: bool = Depends(verify_internal_secret),
):
    """
    Executes a Tracker Agent sweep to monitor submitted applications,
    calculate SLA timelines, write agent events, and notify citizens.
    """
    import time
    run_id = req.run_id
    if not run_id and supabase_admin and req.citizen_id:
        try:
            ins = supabase_admin.table("agent_runs").insert({
                "citizen_id": req.citizen_id,
                "input_query": "tracker-sweep",
                "status": "PROCESSING",
                "run_type": "tracker_sweep",
            }).execute()
            if ins.data:
                run_id = ins.data[0]["id"]
        except Exception as e:
            logger.warning(f"Error creating agent_run for tracker sweep: {e}")

    state_payload = {
        "run_id": run_id or "",
        "citizen_id": req.citizen_id or "",
        "query": "tracker-sweep",
        "citizen_profile": {},
        "retry_count": 0,
    }
    result = tracker_agent_node(state_payload)

    if run_id and supabase_admin:
        try:
            supabase_admin.table("agent_runs").update({
                "status": "COMPLETED",
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).eq("id", run_id).execute()
        except Exception as e:
            logger.warning(f"Error completing tracker agent_run: {e}")

    return {
        "status": "success",
        "run_id": run_id,
        "message": "Tracker sweep executed successfully.",
        "result": result,
    }


class FollowUpChatRequest(BaseModel):
    run_id: Optional[str] = None
    citizen_id: Optional[str] = None
    message: str = Field(description="Citizen question or clarification")
    context: Optional[Dict[str, Any]] = None

@app.post("/chat/followup", status_code=status.HTTP_200_OK)
def handle_followup_chat(
    req: FollowUpChatRequest,
    _: bool = Depends(verify_internal_secret),
):
    """
    Answers citizen follow-up questions regarding evaluated schemes,
    eligibility, application status, or requirements using Groq/Gemini.
    """
    context_str = ""
    if req.context:
        scheme_name = req.context.get("scheme_name", "Welfare Scheme")
        benefit = req.context.get("benefit", "")
        missing_docs = req.context.get("missing_documents", [])
        context_str = f"Target Scheme: {scheme_name}\nBenefit: {benefit}\nMissing Documents: {missing_docs}\n"

    system_prompt = (
        "You are Sahayak AI, an empathetic, highly knowledgeable civic guide assisting Indian citizens. "
        "Answer the citizen's question concisely in 2-3 clear sentences with exact, actionable advice. "
        "Keep language simple, welcoming, and empowering."
    )
    user_prompt = f"{context_str}Citizen Question: {req.message}"

    answer = "Sahayak AI: We have noted your inquiry. You can review and edit all application fields before final submission."

    # Try Groq first for sub-second response
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            model_name = os.getenv("MODEL_FAST", "openai/gpt-oss-20b")
            resp = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=250,
                temperature=0.2,
            )
            ans = resp.choices[0].message.content
            if ans and len(ans.strip()) > 5:
                answer = ans.strip()
        except Exception as e:
            logger.warning(f"Groq followup chat failed: {e}")
            if GOOGLE_API_KEY:
                try:
                    from google import genai
                    ai_client = genai.Client(api_key=GOOGLE_API_KEY)
                    gemini_resp = ai_client.models.generate_content(
                        model=os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
                        contents=f"{system_prompt}\n\n{user_prompt}",
                    )
                    if gemini_resp and gemini_resp.text:
                        answer = gemini_resp.text.strip()
                except Exception as ge:
                    logger.warning(f"Gemini followup chat fallback failed: {ge}")

    # Log event if run_id provided
    if req.run_id and supabase_admin:
        try:
            write_agent_event(
                req.run_id,
                "Citizen Assistant",
                answer,
                {"citizen_question": req.message, "thought": "Answered citizen follow-up inquiry."}
            )
        except Exception:
            pass

    return {
        "status": "success",
        "answer": answer,
    }


class UpdateDraftRequest(BaseModel):
    applicant_info: Dict[str, Any]

@app.post("/applications/{tracking_id}/update", status_code=status.HTTP_200_OK)
def update_application_draft(
    tracking_id: str,
    req: UpdateDraftRequest,
    _: bool = Depends(verify_internal_secret),
):
    """Updates applicant attributes for an existing application draft."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        res = supabase_admin.table("applications").update({
            "applicant_info": req.applicant_info,
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }).eq("tracking_id", tracking_id).execute()

        return {
            "status": "success",
            "tracking_id": tracking_id,
            "message": "Application draft attributes updated successfully.",
            "data": res.data,
        }
    except Exception as e:
        logger.error(f"Error updating draft {tracking_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class SubmitApplicationRequest(BaseModel):
    citizen_id: str
    consent_recorded: bool = True
    scheme_id: Optional[str] = None
    applicant_info: Optional[Dict[str, Any]] = None

@app.post("/applications/{tracking_id}/submit", status_code=status.HTTP_200_OK)
def submit_application(
    tracking_id: str,
    req: SubmitApplicationRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_internal_secret),
):
    """Submits an application draft and triggers real-time tracking."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        # Try updating by tracking_id first
        res = supabase_admin.table("applications").update({
            "status": "submitted",
            "updated_at": now_str,
        }).eq("tracking_id", tracking_id).execute()

        # If not found by tracking_id, try by primary key id
        if not res.data:
            res = supabase_admin.table("applications").update({
                "status": "submitted",
                "updated_at": now_str,
            }).eq("id", tracking_id).execute()

        # If still not found and citizen_id is present, insert new application record
        if not res.data and req.citizen_id:
            scheme_id = req.scheme_id or "a0000000-0000-0000-0000-000000000001"
            res = supabase_admin.table("applications").insert({
                "citizen_id": req.citizen_id,
                "scheme_id": scheme_id,
                "tracking_id": tracking_id,
                "status": "submitted",
                "applicant_info": req.applicant_info or {},
                "updated_at": now_str,
            }).execute()

        # Add notification for citizen
        try:
            supabase_admin.table("notifications").insert({
                "citizen_id": req.citizen_id,
                "title": "Application Submitted Successfully",
                "body": f"Your application (#{tracking_id}) has been submitted and assigned for departmental verification.",
                "type": "application_update",
                "is_read": False,
            }).execute()
        except Exception as ne:
            logger.warning(f"Could not create notification: {ne}")

        # Trigger tracker sweep in background
        background_tasks.add_task(
            run_tracker_sweep,
            TrackerRunRequest(citizen_id=req.citizen_id)
        )

        return {
            "status": "success",
            "tracking_id": tracking_id,
            "submitted_at": now_str,
            "message": "Application submitted successfully.",
            "data": res.data if hasattr(res, 'data') else [],
        }
    except Exception as e:
        logger.error(f"Error submitting application {tracking_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class DiscoverSchemeRequest(BaseModel):
    query: str
    category: Optional[str] = "General"


@app.get("/schemes", status_code=status.HTTP_200_OK)
def get_all_schemes():
    """Returns all verified active schemes with rules and document requirements."""
    if not supabase_admin:
        return {"schemes": []}
    try:
        res = (
            supabase_admin.table("schemes")
            .select("*, eligibility_rules(*), document_requirements(*)")
            .eq("eligibility_status", "Active")
            .order("name")
            .execute()
        )
        return {"schemes": res.data or []}
    except Exception as e:
        logger.error(f"Error fetching schemes: {e}")
        return {"schemes": []}


def web_search_civic_portals(query: str):
    """Search official Indian government domains and myScheme portal for live verification."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    results = []
    try:
        from bs4 import BeautifulSoup
        with httpx.Client(follow_redirects=True, timeout=8.0) as client:
            search_query = f"{query} Indian government scheme site:gov.in OR site:myscheme.gov.in"
            r = client.post("https://html.duckduckgo.com/html/", data={"q": search_query}, headers=headers)
            soup = BeautifulSoup(r.text, "html.parser")
            for res in soup.select(".result"):
                title_el = res.select_one(".result__title")
                snippet_el = res.select_one(".result__snippet")
                link_el = res.select_one(".result__url")
                if title_el and snippet_el:
                    results.append({
                        "title": title_el.get_text(strip=True),
                        "snippet": snippet_el.get_text(strip=True),
                        "url": link_el.get_text(strip=True) if link_el else ""
                    })
    except Exception as e:
        logger.warning(f"Web search error for '{query}': {e}")
    return results[:6]


@app.post("/schemes/discover", status_code=status.HTTP_200_OK)
def discover_scheme(req: DiscoverSchemeRequest):
    """Dynamic scheme discovery: fast DB keyword match -> DB semantic match -> Live Google/Web search on official portals with DB persistence."""
    query = req.query.strip()
    if not query:
        return {"found": False, "schemes": []}

    all_s = []
    if supabase_admin:
        try:
            q = supabase_admin.table("schemes").select("*, eligibility_rules(*), document_requirements(*)").eq("eligibility_status", "Active")
            if req.category and req.category != "General" and req.category != "All":
                q = q.eq("category", req.category)
            all_s = q.execute().data or []
        except Exception as e:
            logger.warning(f"Error loading scheme catalog: {e}")

    # 1. Fast keyword matching across name, category, description, benefit, rules, documents
    STOP_WORDS = {
        "free", "for", "the", "and", "from", "with", "this", "that", "what", "need",
        "give", "want", "help", "some", "scam", "any", "all", "get", "how", "can",
        "are", "you", "scheme", "schemes", "yojana", "govt", "government", "apply",
        "india", "bharat", "pradhan", "mantri", "state", "central", "plan"
    }
    q_clean = query.lower()
    q_words = [w for w in re.findall(r'[a-zA-Z]{3,}', q_clean) if w not in STOP_WORDS]
    scored = []
    if q_words and all_s:
        for s in all_s:
            s_name = s.get("name", "").lower()
            s_cat = s.get("category", "").lower()
            s_desc = s.get("description", "").lower()
            s_benefit = s.get("benefit", "").lower()
            s_rules = " ".join([r.get("requirement", "").lower() + " " + r.get("criterion_name", "").lower() for r in s.get("eligibility_rules", [])])
            s_docs = " ".join([d.get("document_type", "").lower() for d in s.get("document_requirements", [])])

            name_match = sum(1 for w in q_words if w in s_name)
            cat_match = sum(1 for w in q_words if w in s_cat)
            content_match = sum(1 for w in q_words if w in s_desc or w in s_benefit or w in s_rules or w in s_docs)

            score = (name_match * 6) + (cat_match * 4) + (content_match * 2)
            if score >= 4:
                scored.append((score, s))

    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        return {
            "found": True,
            "source": "database_keyword",
            "schemes": [m[1] for m in scored]
        }

    # 2. Semantic Intent Matching across Existing Database Schemes
    if groq_client and all_s:
        try:
            catalog_summary = "\n".join([
                f"- ID: {s['id']} | Name: {s['name']} | Category: {s['category']} | Benefit: {s.get('benefit', '')[:80]}"
                for s in all_s
            ])

            semantic_prompt = f"""You are Sahayak's Official Indian Civic & Welfare Intelligence Engine.
A citizen is searching for government welfare schemes with the query: '{query}'.

Existing Database Schemes:
{catalog_summary}

Tasks:
1. Identify if any schemes in the database match the citizen's need or intent (e.g. 'college fund' -> PM Vidya Lakshmi or Post-Matric Scholarship; 'hospital money' -> Ayushman Bharat).
2. If genuine official Indian government welfare schemes exist in the DB that address this need, return their IDs in `matched_scheme_ids`.
3. If NO schemes in the DB match, return `matched_scheme_ids: []`.

Return JSON strictly in this format:
{{
  "matched_scheme_ids": ["<id1>", "<id2>"]
}}"""
            model_to_use = os.getenv("MODEL_FAST", "openai/gpt-oss-20b")
            resp = groq_client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": "You are an expert civic intelligence AI. Output only JSON."},
                    {"role": "user", "content": semantic_prompt}
                ],
                response_format={"type": "json_object"}
            )
            raw_text = resp.choices[0].message.content or "{}"
            data = json.loads(raw_text)
            matched_ids = data.get("matched_scheme_ids", [])
            if matched_ids:
                matched_map = {s["id"]: s for s in all_s}
                matched_schemes = [matched_map[sid] for sid in matched_ids if sid in matched_map]
                if matched_schemes:
                    return {
                        "found": True,
                        "source": "database_semantic",
                        "schemes": matched_schemes
                    }
        except Exception as se:
            logger.warning(f"Semantic DB matching error: {se}")

    # 3. Live Web Search on Official Government Sources & myScheme
    logger.info(f"Searching official government portals & Google for: '{query}'")
    web_results = web_search_civic_portals(query)
    web_context = "\n".join([
        f"- Title: {r['title']}\n  Snippet: {r['snippet']}\n  Source: {r['url']}"
        for r in web_results
    ]) if web_results else "No direct web snippets retrieved."

    if groq_client:
        try:
            live_extraction_prompt = f"""You are Sahayak's Official Indian Government Civic Verification Agent.
Citizen Search Query: '{query}'

Live Web Search Results from Official Government Sources:
{web_context}

Tasks:
1. Determine if this refers to an actual, official Central or State Government welfare scheme in India (verified from live web sources or official civic knowledge).
2. If YES (genuine official scheme):
   Extract and structure the scheme into valid JSON:
   {{
     "found": true,
     "name": "Full Official Scheme Name",
     "category": "Agriculture" | "Education" | "Healthcare" | "Housing" | "Women & Child" | "Employment & Pension" | "Business & Loans" | "Skill & Employment",
     "jurisdiction": "Central" | "State",
     "benefit": "Quantified benefit details",
     "description": "1-2 sentence description of objectives and support provided.",
     "official_source": "Official URL or Ministry name",
     "rules": [
       {{"criterion_name": "Criterion Name", "requirement": "Detailed requirement", "rule_type": "text" | "numeric" | "boolean", "evidence_source": "Document name"}}
     ],
     "documents": ["Mandatory Document 1", "Mandatory Document 2"]
   }}
3. If NO (spam, fake, scam, private product, non-existent, or impossible request like 'alien spaceships', 'free 100 crore lottery'):
   Return:
   {{
     "found": false,
     "reason": "No official government scheme found matching your query on official portals or Google."
   }}
"""
            model_to_use = os.getenv("MODEL_FAST", "openai/gpt-oss-20b")
            resp = groq_client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": "You are a civic knowledge verification AI. Output only JSON."},
                    {"role": "user", "content": live_extraction_prompt}
                ],
                response_format={"type": "json_object"}
            )
            raw_text = resp.choices[0].message.content or "{}"
            data = json.loads(raw_text)

            if data.get("found") and data.get("name"):
                new_id = str(uuid.uuid4())
                scheme_row = {
                    "id": new_id,
                    "name": data["name"],
                    "category": data.get("category", "General"),
                    "jurisdiction": data.get("jurisdiction", "Central"),
                    "benefit": data.get("benefit", "Government Welfare Support"),
                    "description": data.get("description", ""),
                    "official_source": data.get("official_source", "myScheme Portal / National Govt Repository"),
                    "eligibility_status": "Active",
                    "last_verified": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
                rules_rows = []
                doc_rows = []
                if supabase_admin:
                    try:
                        supabase_admin.table("schemes").insert(scheme_row).execute()
                        rules_rows = [
                            {
                                "scheme_id": new_id,
                                "criterion_name": r.get("criterion_name", "Eligibility"),
                                "requirement": r.get("requirement", "Verification required"),
                                "rule_type": r.get("rule_type", "text") if r.get("rule_type") in ["numeric", "boolean", "text"] else "text",
                                "evidence_source": r.get("evidence_source", "Identity Document")
                            }
                            for r in data.get("rules", [])
                        ]
                        if rules_rows:
                            supabase_admin.table("eligibility_rules").insert(rules_rows).execute()

                        doc_rows = [
                            {
                                "scheme_id": new_id,
                                "document_type": d,
                                "is_mandatory": True
                            }
                            for d in data.get("documents", [])
                        ]
                        if doc_rows:
                            supabase_admin.table("document_requirements").insert(doc_rows).execute()
                    except Exception as ins_err:
                        logger.warning(f"Could not persist discovered scheme: {ins_err}")

                scheme_row["eligibility_rules"] = rules_rows or data.get("rules", [])
                scheme_row["document_requirements"] = doc_rows or [{"document_type": d} for d in data.get("documents", [])]

                return {
                    "found": True,
                    "source": "live_web_discovery",
                    "schemes": [scheme_row]
                }
        except Exception as le:
            logger.error(f"Live web verification error: {le}")

    return {
        "found": False,
        "source": "none",
        "message": "No official government scheme found matching your query on official portals or Google.",
        "schemes": []
    }


# ==============================================================================
# Admin & Supervisory Endpoints (Real Database Data — Zero Mock)
# ==============================================================================

class AdminReviewRequest(BaseModel):
    application_id: str
    action: str = Field(description="'approved', 'rejected', or 'request_info'")
    notes: str = Field(description="Mandatory reviewer reason or notes")
    admin_id: Optional[str] = None

class AdminSchemeCreateRequest(BaseModel):
    name: str
    category: str
    jurisdiction: str = Field(default="Central")
    benefit: Optional[str] = ""
    description: Optional[str] = ""
    official_source: Optional[str] = "Official Portal"
    eligibility_status: Optional[str] = "Active"
    rules: Optional[list] = []
    documents: Optional[list] = []

class AdminSchemeStatusRequest(BaseModel):
    status: str = Field(description="'Active', 'Draft', or 'Archived'")

class AdminSchemeUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    jurisdiction: Optional[str] = None
    benefit: Optional[str] = None
    description: Optional[str] = None
    official_source: Optional[str] = None
    eligibility_status: Optional[str] = None
    rules: Optional[list] = None
    documents: Optional[list] = None


@app.get("/admin/metrics", status_code=status.HTTP_200_OK)
def get_live_admin_metrics():
    """Aggregates live database statistics for the Admin Control Center."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # 1. Total & Active Citizens count
        citizens_res = supabase_admin.table("profiles").select("id", count="exact", head=True).execute()
        citizens_count = citizens_res.count or 0

        # 2. Applications count and status breakdown
        apps_res = supabase_admin.table("applications").select("status").execute()
        apps_data = apps_res.data or []
        total_apps = len(apps_data)
        
        status_breakdown = {
            "draft": 0,
            "awaiting_approval": 0,
            "submitted": 0,
            "under_review": 0,
            "approved": 0,
            "rejected": 0,
        }
        for a in apps_data:
            st = a.get("status", "draft")
            if st in status_breakdown:
                status_breakdown[st] += 1

        # 3. Documents verified count
        docs_res = supabase_admin.table("documents").select("id", count="exact", head=True).eq("status", "verified").execute()
        verified_docs_count = docs_res.count or 0

        # 4. Total Agent tasks / events count
        events_res = supabase_admin.table("agent_events").select("id", count="exact", head=True).execute()
        agent_tasks_count = events_res.count or 0

        # 5. Average workflow time calculation from completed agent runs
        runs_res = (
            supabase_admin.table("agent_runs")
            .select("started_at, completed_at")
            .not_.is_("completed_at", "null")
            .order("completed_at", desc=True)
            .limit(30)
            .execute()
        )
        avg_workflow_time = "3.5 mins"
        if runs_res.data:
            total_sec = 0
            valid_cnt = 0
            for r in runs_res.data:
                s_at = r.get("started_at")
                c_at = r.get("completed_at")
                if s_at and c_at:
                    try:
                        from datetime import datetime
                        s_dt = datetime.fromisoformat(s_at.replace("Z", "+00:00"))
                        c_dt = datetime.fromisoformat(c_at.replace("Z", "+00:00"))
                        diff = (c_dt - s_dt).total_seconds()
                        if 0 < diff < 7200:
                            total_sec += diff
                            valid_cnt += 1
                    except Exception:
                        pass
            if valid_cnt > 0:
                avg_s = total_sec / valid_cnt
                avg_workflow_time = f"{avg_s / 60:.1f} mins" if avg_s >= 60 else f"{int(avg_s)}s"

        # 6. Applications requiring review
        review_count = status_breakdown["submitted"] + status_breakdown["under_review"] + status_breakdown["awaiting_approval"]

        return {
            "status": "success",
            "metrics": {
                "active_citizens": citizens_count,
                "applications_total": total_apps,
                "applications_by_status": status_breakdown,
                "documents_verified": verified_docs_count,
                "agent_tasks_completed": agent_tasks_count,
                "avg_workflow_time": avg_workflow_time,
                "applications_requiring_review": review_count,
            }
        }
    except Exception as e:
        logger.error(f"Error computing admin metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/agents/status", status_code=status.HTTP_200_OK)
def get_live_agent_workforce_status():
    """Computes real-time status, execution metrics, and error rates per agent."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    canonical_agents = [
        {"id": "citizen", "name": "Citizen Agent", "role": "Intent Parser & Citizen Context"},
        {"id": "scheme", "name": "Scheme Agent", "role": "Civic Knowledge Retrieval"},
        {"id": "eligibility", "name": "Eligibility Agent", "role": "Deterministic Rules Evaluation"},
        {"id": "document", "name": "Document Agent", "role": "Gemini Vision & Verification"},
        {"id": "application", "name": "Application Agent", "role": "Form Payload Compilation"},
        {"id": "tracker", "name": "Tracker Agent", "role": "SLA & Status Monitoring"},
    ]

    try:
        # Fetch all events to compute per-agent task counts and last active times
        events_res = (
            supabase_admin.table("agent_events")
            .select("id, agent_name, created_at, action, details")
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )
        events = events_res.data or []

        # Fetch recent runs to compute health / active status
        runs_res = (
            supabase_admin.table("agent_runs")
            .select("id, status, started_at, completed_at")
            .order("started_at", desc=True)
            .limit(50)
            .execute()
        )
        runs = runs_res.data or []

        has_active_processing = any(r.get("status") in ["PROCESSING", "ONLINE"] for r in runs)
        has_recent_failed = any(r.get("status") == "FAILED" for r in runs[:10])

        agent_stats = []
        for agent in canonical_agents:
            agent_name = agent["name"]
            agent_events = [e for e in events if e.get("agent_name") == agent_name or agent["id"] in (e.get("agent_name") or "").lower()]
            
            task_count = len(agent_events)
            last_event = agent_events[0] if agent_events else None
            last_active = last_event.get("created_at") if last_event else None
            
            # Compute live agent status based on system state & events
            if has_recent_failed and agent["id"] in ["document", "scheme"]:
                live_status = "ERROR"
            elif has_active_processing:
                live_status = "ONLINE"
            elif last_active:
                live_status = "ONLINE"
            else:
                live_status = "IDLE"

            # Compute error count
            error_count = sum(1 for e in agent_events if "error" in str(e.get("action", "")).lower() or "missing" in str(e.get("action", "")).lower())
            error_rate = f"{(error_count / max(1, task_count)) * 100:.1f}%" if task_count > 0 else "0.0%"

            agent_stats.append({
                "id": agent["id"],
                "name": agent["name"],
                "role": agent["role"],
                "status": live_status,
                "tasks_processed": task_count,
                "error_count": error_count,
                "error_rate": error_rate,
                "last_active": last_active,
                "last_action": last_event.get("action") if last_event else "Awaiting invocation",
            })

        return {
            "status": "success",
            "agents": agent_stats,
            "system_active": has_active_processing,
    notes: str = Field(description="Mandatory reviewer reason or notes")
    admin_id: Optional[str] = None

class AdminSchemeCreateRequest(BaseModel):
    name: str
    category: str
    jurisdiction: str = Field(default="Central")
    benefit: Optional[str] = ""
    description: Optional[str] = ""
    official_source: Optional[str] = "Official Portal"
    eligibility_status: Optional[str] = "Active"
    rules: Optional[list] = []
    documents: Optional[list] = []

class AdminSchemeStatusRequest(BaseModel):
    status: str = Field(description="'Active', 'Draft', or 'Archived'")

class AdminSchemeUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    jurisdiction: Optional[str] = None
    benefit: Optional[str] = None
    description: Optional[str] = None
    official_source: Optional[str] = None
    eligibility_status: Optional[str] = None
    rules: Optional[list] = None
    documents: Optional[list] = None


@app.get("/admin/metrics", status_code=status.HTTP_200_OK)
def get_live_admin_metrics():
    """Aggregates live database statistics for the Admin Control Center."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        # 1. Total & Active Citizens count
        citizens_res = supabase_admin.table("profiles").select("id", count="exact", head=True).execute()
        citizens_count = citizens_res.count or 0

        # 2. Applications count and status breakdown
        apps_res = supabase_admin.table("applications").select("status").execute()
        apps_data = apps_res.data or []
        total_apps = len(apps_data)
        
        status_breakdown = {
            "draft": 0,
            "awaiting_approval": 0,
            "submitted": 0,
            "under_review": 0,
            "approved": 0,
            "rejected": 0,
        }
        for a in apps_data:
            st = a.get("status", "draft")
            if st in status_breakdown:
                status_breakdown[st] += 1

        # 3. Documents verified count
        docs_res = supabase_admin.table("documents").select("id", count="exact", head=True).eq("status", "verified").execute()
        verified_docs_count = docs_res.count or 0

        # 4. Total Agent tasks / events count
        events_res = supabase_admin.table("agent_events").select("id", count="exact", head=True).execute()
        agent_tasks_count = events_res.count or 0

        # 5. Average workflow time calculation from completed agent runs
        runs_res = (
            supabase_admin.table("agent_runs")
            .select("started_at, completed_at")
            .not_.is_("completed_at", "null")
            .order("completed_at", desc=True)
            .limit(30)
            .execute()
        )
        avg_workflow_time = "3.5 mins"
        if runs_res.data:
            total_sec = 0
            valid_cnt = 0
            for r in runs_res.data:
                s_at = r.get("started_at")
                c_at = r.get("completed_at")
                if s_at and c_at:
                    try:
                        from datetime import datetime
                        s_dt = datetime.fromisoformat(s_at.replace("Z", "+00:00"))
                        c_dt = datetime.fromisoformat(c_at.replace("Z", "+00:00"))
                        diff = (c_dt - s_dt).total_seconds()
                        if 0 < diff < 7200:
                            total_sec += diff
                            valid_cnt += 1
                    except Exception:
                        pass
            if valid_cnt > 0:
                avg_s = total_sec / valid_cnt
                avg_workflow_time = f"{avg_s / 60:.1f} mins" if avg_s >= 60 else f"{int(avg_s)}s"

        # 6. Applications requiring review
        review_count = status_breakdown["submitted"] + status_breakdown["under_review"] + status_breakdown["awaiting_approval"]

        return {
            "status": "success",
            "metrics": {
                "active_citizens": citizens_count,
                "applications_total": total_apps,
                "applications_by_status": status_breakdown,
                "documents_verified": verified_docs_count,
                "agent_tasks_completed": agent_tasks_count,
                "avg_workflow_time": avg_workflow_time,
                "applications_requiring_review": review_count,
            }
        }
    except Exception as e:
        logger.error(f"Error computing admin metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/agents/status", status_code=status.HTTP_200_OK)
def get_live_agent_workforce_status():
    """Computes real-time status, execution metrics, and error rates per agent."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    canonical_agents = [
        {"id": "citizen", "name": "Citizen Agent", "role": "Intent Parser & Citizen Context"},
        {"id": "scheme", "name": "Scheme Agent", "role": "Civic Knowledge Retrieval"},
        {"id": "eligibility", "name": "Eligibility Agent", "role": "Deterministic Rules Evaluation"},
        {"id": "document", "name": "Document Agent", "role": "Gemini Vision & Verification"},
        {"id": "application", "name": "Application Agent", "role": "Form Payload Compilation"},
        {"id": "tracker", "name": "Tracker Agent", "role": "SLA & Status Monitoring"},
    ]

    try:
        # Fetch all events to compute per-agent task counts and last active times
        events_res = (
            supabase_admin.table("agent_events")
            .select("id, agent_name, created_at, action, details")
            .order("created_at", desc=True)
            .limit(1000)
            .execute()
        )
        events = events_res.data or []

        # Fetch recent runs to compute health / active status
        runs_res = (
            supabase_admin.table("agent_runs")
            .select("id, status, started_at, completed_at")
            .order("started_at", desc=True)
            .limit(50)
            .execute()
        )
        runs = runs_res.data or []

        has_active_processing = any(r.get("status") in ["PROCESSING", "ONLINE"] for r in runs)
        has_recent_failed = any(r.get("status") == "FAILED" for r in runs[:10])

        agent_stats = []
        for agent in canonical_agents:
            agent_name = agent["name"]
            agent_events = [e for e in events if e.get("agent_name") == agent_name or agent["id"] in (e.get("agent_name") or "").lower()]
            
            task_count = len(agent_events)
            last_event = agent_events[0] if agent_events else None
            last_active = last_event.get("created_at") if last_event else None
            
            # Compute live agent status based on system state & events
            if has_recent_failed and agent["id"] in ["document", "scheme"]:
                live_status = "ERROR"
            elif has_active_processing:
                live_status = "ONLINE"
            elif last_active:
                live_status = "ONLINE"
            else:
                live_status = "IDLE"

            # Compute error count
            error_count = sum(1 for e in agent_events if "error" in str(e.get("action", "")).lower() or "missing" in str(e.get("action", "")).lower())
            error_rate = f"{(error_count / max(1, task_count)) * 100:.1f}%" if task_count > 0 else "0.0%"

            agent_stats.append({
                "id": agent["id"],
                "name": agent["name"],
                "role": agent["role"],
                "status": live_status,
                "tasks_processed": task_count,
                "error_count": error_count,
                "error_rate": error_rate,
                "last_active": last_active,
                "last_action": last_event.get("action") if last_event else "Awaiting invocation",
            })

        return {
            "status": "success",
            "agents": agent_stats,
            "system_active": has_active_processing,
        }
    except Exception as e:
        logger.error(f"Error fetching agent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/agents/events", status_code=status.HTTP_200_OK)
def get_live_agent_activity_feed(limit: int = 40):
    """Returns recent real-time agent activity across all citizens."""
    if not supabase_admin:
        return {"status": "error", "events": []}

    try:
        res = (
            supabase_admin.table("agent_events")
            .select("id, run_id, agent_name, action, details, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"status": "success", "events": res.data or []}
    except Exception as e:
        logger.error(f"Error fetching live agent events: {e}")
        return {"status": "error", "events": []}


@app.get("/admin/review-queue", status_code=status.HTTP_200_OK)
def get_admin_review_queue(
    status_filter: Optional[str] = None,
    scheme_id: Optional[str] = None,
    limit: int = 50,
):
    """Fetches applications requiring human supervisory review with full context."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        q = supabase_admin.table("applications").select(
            "id, tracking_id, citizen_id, scheme_id, status, applicant_info, created_at, source_run_id, admin_notes, profiles(full_name, phone, location), schemes(name, category, benefit)"
        )

        if status_filter and status_filter != "all":
            q = q.eq("status", status_filter)
        else:
            q = q.in_("status", ["submitted", "under_review", "awaiting_approval"])

        if scheme_id and scheme_id != "all":
            q = q.eq("scheme_id", scheme_id)

        res = q.order("created_at", desc=True).limit(limit).execute()
        return {"status": "success", "queue": res.data or []}
    except Exception as e:
        logger.error(f"Error fetching review queue: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/review", status_code=status.HTTP_200_OK)
def execute_human_review(req: AdminReviewRequest):
    """
    Approves, rejects, or requests info for an application.
    Updates application status in DB, writes immutable audit log, and creates citizen notification.
    """
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    if not req.notes.strip():
        raise HTTPException(status_code=400, detail="Reviewer notes/reason are mandatory for all supervisory actions.")

    try:
        # 1. Fetch application
        app_res = (
            supabase_admin.table("applications")
            .select("id, tracking_id, citizen_id, source_run_id, status")
            .or_(f"id.eq.{req.application_id},tracking_id.eq.{req.application_id}")
            .single()
            .execute()
        )
        if not app_res.data:
            raise HTTPException(status_code=404, detail="Application not found")

        app_row = app_res.data
        new_status = "approved" if req.action == "approved" else "rejected" if req.action == "rejected" else "under_review"
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # 2. Update Application status
        supabase_admin.table("applications").update({
            "status": new_status,
            "admin_notes": req.notes,
            "updated_at": now_iso,
        }).eq("id", app_row["id"]).execute()

        # 3. Write immutable audit log
        action_name = "APPLICATION_APPROVED" if req.action == "approved" else "APPLICATION_REJECTED" if req.action == "rejected" else "MORE_INFO_REQUESTED"
        supabase_admin.table("audit_logs").insert({
            "run_id": app_row.get("source_run_id"),
            "agent_name": "Human Reviewer",
            "action": action_name,
            "evidence": req.notes,
            "result": new_status.upper(),
        }).execute()

        # 4. Notify citizen
        if app_row.get("citizen_id"):
            notif_title = f"Application {new_status.capitalize()}: {app_row.get('tracking_id')}"
            supabase_admin.table("notifications").insert({
                "citizen_id": app_row["citizen_id"],
                "title": notif_title,
                "body": req.notes,
                "type": "success" if req.action == "approved" else "critical",
                "is_read": False,
            }).execute()

        return {
            "status": "success",
            "application_id": app_row["id"],
            "new_status": new_status,
            "message": f"Application successfully {new_status} and audit record committed.",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing admin review: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/admin/schemes", status_code=status.HTTP_201_CREATED)
def create_admin_scheme(req: AdminSchemeCreateRequest):
    """Creates a new official scheme with eligibility rules and document requirements in DB."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        new_id = str(uuid.uuid4())
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        scheme_data = {
            "id": new_id,
            "name": req.name.strip(),
            "category": req.category,
            "jurisdiction": req.jurisdiction,
            "benefit": req.benefit,
            "description": req.description,
            "official_source": req.official_source or "Official Portal",
            "eligibility_status": req.eligibility_status or "Active",
            "last_verified": now_iso,
        }
        supabase_admin.table("schemes").insert(scheme_data).execute()

        # Insert rules
        if req.rules:
            rule_rows = [
                {
                    "scheme_id": new_id,
                    "criterion_name": r.get("criterion_name", "General Criterion"),
                    "requirement": r.get("requirement", "Document verification"),
                    "rule_type": r.get("rule_type", "text"),
                    "evidence_source": r.get("evidence_source", "Identity Document"),
                }
                for r in req.rules
            ]
            supabase_admin.table("eligibility_rules").insert(rule_rows).execute()

        # Insert documents
        if req.documents:
            doc_rows = [
                {
                    "scheme_id": new_id,
                    "document_type": d if isinstance(d, str) else d.get("document_type", "Required Document"),
                    "is_mandatory": True if isinstance(d, str) else d.get("is_mandatory", True),
                }
                for d in req.documents
            ]
            supabase_admin.table("document_requirements").insert(doc_rows).execute()

        # Write audit log
        supabase_admin.table("audit_logs").insert({
            "agent_name": "Admin Officer",
            "action": "SCHEME_CREATED",
            "evidence": f"Created scheme: {req.name} ({req.jurisdiction})",
            "result": "ACTIVE",
        }).execute()

        return {"status": "success", "scheme_id": new_id, "message": "Scheme created successfully."}
    except Exception as e:
        logger.error(f"Error creating scheme: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/admin/schemes/{scheme_id}/status", status_code=status.HTTP_200_OK)
def update_scheme_status(scheme_id: str, req: AdminSchemeStatusRequest):
    """Updates scheme eligibility status (Active, Draft, Archived) immediately affecting AI agents."""
    if not supabase_admin:
        raise HTTPException(status_code=500, detail="Database not configured")

    if req.status not in ["Active", "Draft", "Archived"]:
        raise HTTPException(status_code=400, detail="Status must be 'Active', 'Draft', or 'Archived'")

    try:
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        supabase_admin.table("schemes").update({
            "eligibility_status": req.status,
            "updated_at": now_iso,
        }).eq("id", scheme_id).execute()

        supabase_admin.table("audit_logs").insert({
            "agent_name": "Admin Officer",
            "action": "SCHEME_STATUS_UPDATED",
            "evidence": f"Scheme {scheme_id} status updated to {req.status}",
            "result": req.status.upper(),
        }).execute()

        return {"status": "success", "scheme_id": scheme_id, "new_status": req.status}
    except Exception as e:
        logger.error(f"Error updating scheme status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/audit-logs", status_code=status.HTTP_200_OK)
def get_admin_audit_logs(limit: int = 50):
    """Returns immutable supervisory and agent audit trail."""
    if not supabase_admin:
        return {"status": "error", "logs": []}

    try:
        res = (
            supabase_admin.table("audit_logs")
            .select("id, run_id, agent_name, action, evidence, result, created_at")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return {"status": "success", "logs": res.data or []}
    except Exception as e:
        logger.error(f"Error loading audit logs: {e}")
        return {"status": "error", "logs": []}


@app.get("/admin/system-health", status_code=status.HTTP_200_OK)
def get_system_health():
    """Returns comprehensive real-time microservice health indicators."""
    db_ok = False
    if supabase_admin:
        try:
            r = supabase_admin.table("schemes").select("id", count="exact", head=True).limit(1).execute()
            db_ok = True
        except Exception:
            db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database_connected": db_ok,
        "groq_ai_configured": bool(os.getenv("GROQ_API_KEY")),
        "gemini_vision_configured": bool(os.getenv("GOOGLE_API_KEY")),
        "internal_secret_configured": bool(INTERNAL_SECRET),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
