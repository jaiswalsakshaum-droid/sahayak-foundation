import os
import sys
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
    from agent_graph import sahayak_agent_workflow, write_agent_event
    from document_extractor import extract_document_data
except ImportError:
    from backend.agent_graph import sahayak_agent_workflow, write_agent_event
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

# ==============================================================================
# Background Runners
# ==============================================================================

async def run_langgraph_task(run_id: str, citizen_id: str, query: str):
    """Executes the LangGraph agent graph in background without blocking response."""
    logger.info(f"Starting background LangGraph run for run_id={run_id}")
    
    # 1. Fetch citizen profile from Supabase with snake_case method
    citizen_profile = {
        "full_name": "Rahul Sharma",
        "age": 20,
        "location": "Lucknow, Uttar Pradesh",
        "occupation": "Student / Agricultural Assistant",
        "annual_income": 210000,
        "caste_category": "OBC",
    }

    if supabase_admin and citizen_id:
        try:
            res = supabase_admin.table("profiles").select("*").eq("id", citizen_id).maybe_single().execute()
            if res.data:
                citizen_profile = res.data
        except Exception as e:
            logger.error(f"Could not load citizen profile for citizen_id={citizen_id}: {e}")

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

async def run_document_extraction_task(document_id: str):
    """Executes document intelligence extraction in the background."""
    logger.info(f"Starting document extraction for document_id={document_id}")
    try:
        extract_document_data(document_id)
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
        "version": "3.0.0",
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "supabase_configured": bool(supabase_admin is not None),
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

@app.post("/extract-document", status_code=status.HTTP_202_ACCEPTED)
async def extract_document(
    req: ExtractDocumentRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_internal_secret),
):
    """Triggers Groq Vision / OCR Document Intelligence extraction on an uploaded file."""
    background_tasks.add_task(run_document_extraction_task, req.document_id)
    return {
        "status": "accepted",
        "document_id": req.document_id,
        "message": "Document intelligence extraction initiated.",
    }

@app.post("/track")
def track_submission(
    req: TrackRequest,
    _: bool = Depends(verify_internal_secret),
):
    """Tracker Agent endpoint triggered on application submission."""
    if supabase_admin:
        try:
            supabase_admin.table("notifications").insert({
                "citizen_id": req.citizen_id,
                "title": f"Application submitted: {req.scheme_name}",
                "body": f"Tracking ID: {req.tracking_id}. Tracker Agent is now monitoring department review.",
                "type": "info",
            }).execute()
        except Exception as e:
            logger.warning(f"Error creating tracker notification: {e}")

    return {"status": "success", "message": "Tracker agent monitoring activated."}
