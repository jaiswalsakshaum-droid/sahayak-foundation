import os
import logging
from typing import Dict, Any, Optional
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from supabase import create_client, Client
from backend.agent_graph import sahayak_agent_workflow, write_agent_event

load_dotenv()
logger = logging.getLogger("sahayak.api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Sahayak AI Workforce Microservice",
    description="LangGraph Multi-Agent Backend calling Groq for Civic Scheme Navigation",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERNAL_SECRET = os.getenv("INTERNAL_SHARED_SECRET", "sahayak-internal-secret-2026")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

supabase_admin: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.warning(f"Could not connect to Supabase from FastAPI: {e}")

class RunRequest(BaseModel):
    run_id: str = Field(description="Unique agent_run UUID")
    citizen_id: str = Field(description="Citizen profile UUID")
    query: str = Field(description="Natural language query from citizen")

class TrackRequest(BaseModel):
    citizen_id: str
    application_id: str
    tracking_id: str
    scheme_name: str

# ==============================================================================
# Background Runner
# ==============================================================================

async def run_langgraph_task(run_id: str, citizen_id: str, query: str):
    """Executes the LangGraph agent graph in background without blocking response."""
    logger.info(f"Starting background LangGraph run for run_id={run_id}")
    
    # 1. Fetch citizen profile from Supabase
    citizen_profile = {
        "full_name": "Rahul Sharma",
        "age": 20,
        "location": "Lucknow, Uttar Pradesh",
        "occupation": "Student / Agricultural Assistant",
        "annual_income": 210000,
    }

    if supabase_admin and citizen_id:
        try:
            res = supabase_admin.table("profiles").select("*").eq("id", citizen_id).maybeSingle().execute()
            if res.data:
                citizen_profile = res.data
        except Exception as e:
            logger.warning(f"Could not load citizen profile: {e}")

    # 2. Initial state
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
        "application_draft": None,
        "next_action": None,
        "retry_count": 0,
        "error": None,
    }

    try:
        # Run graph
        sahayak_agent_workflow.invoke(initial_state)
        logger.info(f"LangGraph execution finished successfully for run_id={run_id}")
    except Exception as e:
        logger.error(f"Error executing LangGraph for run_id={run_id}: {e}")
        write_agent_event(run_id, "System", f"Workflow notice: {str(e)[:120]}")

# ==============================================================================
# API Endpoints
# ==============================================================================

@app.get("/health")
def health_check():
    """Trivial health check for pre-warming Render container before demo slot."""
    return {
        "status": "healthy",
        "service": "sahayak-langgraph-backend",
        "timestamp": os.getenv("RENDER_GIT_COMMIT", "local-dev"),
    }

@app.post("/run", status_code=status.HTTP_202_ACCEPTED)
async def start_orchestration(
    req: RunRequest,
    background_tasks: BackgroundTasks,
    x_sahayak_internal_secret: Optional[str] = Header(None, alias="X-Sahayak-Internal-Secret"),
):
    """Triggers multi-agent orchestration for a citizen query."""
    # Optional shared secret verification
    if INTERNAL_SECRET and x_sahayak_internal_secret:
        if x_sahayak_internal_secret != INTERNAL_SECRET:
            raise HTTPException(status_code=403, detail="Forbidden: Invalid internal secret")

    background_tasks.add_task(run_langgraph_task, req.run_id, req.citizen_id, req.query)

    return {
        "status": "accepted",
        "run_id": req.run_id,
        "message": "Orchestration started in background.",
    }

@app.post("/track")
def track_submission(
    req: TrackRequest,
    x_sahayak_internal_secret: Optional[str] = Header(None, alias="X-Sahayak-Internal-Secret"),
):
    """Tracker Agent endpoint triggered on application submission."""
    if INTERNAL_SECRET and x_sahayak_internal_secret:
        if x_sahayak_internal_secret != INTERNAL_SECRET:
            raise HTTPException(status_code=403, detail="Forbidden: Invalid internal secret")

    if supabase_admin:
        try:
            # Create tracker notification
            supabase_admin.table("notifications").insert({
                "citizen_id": req.citizen_id,
                "title": f"Application submitted: {req.scheme_name}",
                "body": f"Tracking ID: {req.tracking_id}. Tracker Agent is now monitoring department review.",
                "type": "info",
            }).execute()
        except Exception as e:
            logger.warning(f"Error creating tracker notification: {e}")

    return {"status": "success", "message": "Tracker agent monitoring activated."}
