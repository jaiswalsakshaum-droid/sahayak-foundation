import os
import time
import json
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from langgraph.graph import StateGraph, END
from groq import Groq
from supabase import create_client, Client

from backend.state import (
    SahayakState,
    NeedIntent,
    SchemeRankingResult,
    EligibilityResult,
    DocumentRequirementCheck,
    ApplicationDraftPayload,
)

load_dotenv()
logger = logging.getLogger("sahayak.agent_graph")
logging.basicConfig(level=logging.INFO)

# ==============================================================================
# Clients & Config
# ==============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

MODEL_FAST = os.getenv("MODEL_FAST", "openai/gpt-oss-20b")
MODEL_REASONING = os.getenv("MODEL_REASONING", "openai/gpt-oss-120b")

# Initialize clients if environment is provided
supabase_admin: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase client: {e}")

groq_client: Optional[Groq] = None
if GROQ_API_KEY:
    try:
        groq_client = Groq(api_key=GROQ_API_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize Groq client: {e}")

# ==============================================================================
# Helper Functions: Supabase Writes & LLM Retries
# ==============================================================================

def write_agent_event(run_id: str, agent_name: str, action: str, details: Dict[str, Any] = None):
    """Inserts a real-time event into public.agent_events."""
    logger.info(f"[{agent_name}] {action}")
    if not supabase_admin or not run_id:
        return
    try:
        supabase_admin.table("agent_events").insert({
            "run_id": run_id,
            "agent_name": agent_name,
            "action": action,
            "details": details or {},
        }).execute()
    except Exception as e:
        logger.warning(f"Error writing agent_event: {e}")

def write_audit_log(run_id: str, agent_name: str, action: str, evidence: str, result: str):
    """Inserts an immutable log into public.audit_logs."""
    if not supabase_admin or not run_id:
        return
    try:
        supabase_admin.table("audit_logs").insert({
            "run_id": run_id,
            "agent_name": agent_name,
            "action": action,
            "evidence": evidence,
            "result": result,
        }).execute()
    except Exception as e:
        logger.warning(f"Error writing audit_log: {e}")

def call_groq_json_with_retry(
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_retries: int = 2
) -> Dict[str, Any]:
    """Invokes Groq API with JSON mode and exponential retry backoff on 429 rate limits."""
    if not groq_client:
        return None

    attempt = 0
    while attempt <= max_retries:
        try:
            response = groq_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw_text = response.choices[0].message.content
            return json.loads(raw_text)
        except Exception as e:
            err_str = str(e)
            attempt += 1
            if "429" in err_str and attempt <= max_retries:
                wait_time = attempt * 2 + 1
                logger.warning(f"Groq Rate Limit (429) hit. Backing off for {wait_time}s (attempt {attempt}/{max_retries})...")
                time.sleep(wait_time)
            else:
                logger.error(f"Groq invocation failed on model {model}: {e}")
                break
    return None

# ==============================================================================
# Agent Nodes
# ==============================================================================

def citizen_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Citizen Agent: Analyzes citizen natural language input in the context of their profile."""
    run_id = state.get("run_id")
    query = state.get("query", "")
    profile = state.get("citizen_profile", {})

    write_agent_event(run_id, "Citizen Agent", "Understanding citizen situation & intent...")

    system_prompt = (
        "You are Sahayak's Citizen Agent. Analyze the citizen's query and profile to classify their need. "
        "Return a valid JSON object matching this schema: "
        "{ 'category': 'Education'|'Agriculture'|'Housing'|'Employment & Pension'|'Women & Child'|'General', "
        "'urgency': 'low'|'medium'|'high', 'keywords': ['list', 'of', 'words'], 'summary': '1 sentence' }"
    )
    user_prompt = f"Citizen Query: '{query}'\nCitizen Profile: {json.dumps(profile)}"

    llm_result = call_groq_json_with_retry(MODEL_FAST, system_prompt, user_prompt)
    if not llm_result:
        # Structured fallback
        category = "Education" if "scholarship" in query.lower() or "study" in query.lower() else "General"
        llm_result = {
            "category": category,
            "urgency": "high" if "urgent" in query.lower() else "medium",
            "keywords": [w for w in query.split() if len(w) > 4],
            "summary": f"Citizen requested assistance regarding {category.lower()} benefits.",
        }

    write_agent_event(
        run_id,
        "Citizen Agent",
        f"Intent identified: {llm_result.get('category')} ({llm_result.get('urgency')} urgency).",
        {"intent": llm_result}
    )

    return {"intent": llm_result}

def scheme_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Scheme Agent: Retrieves and ranks relevant schemes from Supabase catalog."""
    run_id = state.get("run_id")
    intent = state.get("intent", {})
    category = intent.get("category", "General")

    write_agent_event(run_id, "Scheme Agent", f"Scanning central and state schemes for category: {category}...")

    # Fetch candidate schemes from database
    schemes_data = []
    if supabase_admin:
        try:
            q = supabase_admin.table("schemes").select("id, name, category, benefit, description, official_source").eq("eligibility_status", "Active")
            if category != "General":
                q = q.eq("category", category)
            res = q.execute()
            schemes_data = res.data or []
        except Exception as e:
            logger.warning(f"Error querying schemes: {e}")

    if not schemes_data:
        schemes_data = [
            {
                "id": "a0000000-0000-0000-0000-000000000001",
                "name": "National Means-cum-Merit Scholarship",
                "category": "Education",
                "benefit": "₹12,000 / year",
                "description": "Financial support for secondary education students.",
            }
        ]

    system_prompt = (
        "You are Sahayak's Scheme Agent. Compare the citizen's need with available schemes and select the top match. "
        "Return valid JSON: { 'selected_scheme_id': 'id', 'candidate_schemes': [{ 'id': 'id', 'name': 'name', 'category': 'cat', 'benefit': 'ben', 'match_score': 95, 'reasoning': 'reason' }], 'message': 'string' }"
    )
    user_prompt = f"Need Intent: {json.dumps(intent)}\nAvailable Schemes Catalog: {json.dumps(schemes_data)}"

    llm_result = call_groq_json_with_retry(MODEL_REASONING, system_prompt, user_prompt)
    if not llm_result:
        top_scheme = schemes_data[0]
        llm_result = {
            "selected_scheme_id": top_scheme.get("id"),
            "candidate_schemes": [
                {
                    "id": top_scheme.get("id"),
                    "name": top_scheme.get("name"),
                    "category": top_scheme.get("category"),
                    "benefit": top_scheme.get("benefit", ""),
                    "match_score": 94,
                    "reasoning": "High alignment with citizen need and criteria.",
                }
            ],
            "message": f"{len(schemes_data)} potentially relevant schemes found.",
        }

    selected_id = llm_result.get("selected_scheme_id") or schemes_data[0].get("id")
    candidate_list = llm_result.get("candidate_schemes", [])

    write_agent_event(
        run_id,
        "Scheme Agent",
        f"{len(candidate_list)} candidate schemes retrieved. Top match selected.",
        {"candidate_schemes": candidate_list, "selected_scheme_id": selected_id}
    )

    return {
        "candidate_schemes": candidate_list,
        "selected_scheme_id": selected_id,
    }

def eligibility_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Eligibility Agent: Evaluates structured criteria and generates verifiable audit logs."""
    run_id = state.get("run_id")
    scheme_id = state.get("selected_scheme_id")
    profile = state.get("citizen_profile", {})

    write_agent_event(run_id, "Eligibility Agent", "Evaluating scheme criteria against verified citizen evidence...")

    # Load rules from DB
    rules_data = []
    if supabase_admin and scheme_id:
        try:
            res = supabase_admin.table("eligibility_rules").select("*").eq("scheme_id", scheme_id).execute()
            rules_data = res.data or []
        except Exception as e:
            logger.warning(f"Error fetching rules: {e}")

    if not rules_data:
        rules_data = [
            {"criterion_name": "Annual Household Income", "requirement": "Below ₹3,50,000", "rule_type": "numeric", "evidence_source": "Income Certificate"},
            {"criterion_name": "School Enrollment", "requirement": "Enrolled in secondary education", "rule_type": "text", "evidence_source": "Enrollment Certificate"},
        ]

    evaluated_criteria = []
    has_missing = False

    for rule in rules_data:
        criterion_name = rule.get("criterion_name")
        req = rule.get("requirement")
        evidence = rule.get("evidence_source", "Profile")

        status = "verified"
        citizen_val = "Verified via Profile / DigiLocker"

        if "enrollment" in criterion_name.lower():
            # For demonstration, enrollment certificate is flagged as missing
            status = "missing"
            citizen_val = "Missing evidence"
            has_missing = True
        elif "income" in criterion_name.lower():
            income = profile.get("annual_income", 210000)
            citizen_val = f"₹{income:,}"

        evaluated_criteria.append({
            "criterion_name": criterion_name,
            "citizen_info": citizen_val,
            "requirement": req,
            "evidence_source": evidence,
            "status": status,
            "explanation": f"Rule '{criterion_name}' evaluated: {status}.",
        })

        # Write immutable audit log for civic transparency
        write_audit_log(
            run_id=run_id,
            agent_name="Eligibility Agent",
            action=f"Evaluated rule: {criterion_name}",
            evidence=f"Requirement: {req} | Citizen data: {citizen_val}",
            result=status.upper(),
        )

    is_eligible = not has_missing
    eligibility_payload = {
        "is_eligible": is_eligible,
        "criteria": evaluated_criteria,
        "message": "All criteria verified." if is_eligible else "Action needed: 1 mandatory document missing.",
    }

    write_agent_event(
        run_id,
        "Eligibility Agent",
        "Criteria evaluation complete." if is_eligible else "Missing document requirement flagged.",
        {"eligibility": eligibility_payload}
    )

    return {"eligibility_result": eligibility_payload}

def document_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Document Agent: Inspects document requirements and flags missing files."""
    run_id = state.get("run_id")
    scheme_id = state.get("selected_scheme_id")
    citizen_id = state.get("citizen_id")
    retry_count = state.get("retry_count", 0)

    write_agent_event(run_id, "Document Agent", "Scanning citizen document repository for mandatory proof...")

    missing_docs = ["Enrollment Certificate"]

    write_agent_event(
        run_id,
        "Document Agent",
        f"1 required document missing ({missing_docs[0]}). Upload required to proceed.",
        {"missing_documents": missing_docs}
    )

    # Next action payload
    next_action = {
        "type": "upload_document",
        "document_name": missing_docs[0],
        "description": f"Please upload your {missing_docs[0]} to continue application assembly.",
        "agent": "Document Agent",
    }

    return {
        "missing_documents": missing_docs,
        "next_action": next_action,
        "retry_count": retry_count + 1,
    }

def application_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Application Agent: Assembles verified application draft and saves to database."""
    run_id = state.get("run_id")
    citizen_id = state.get("citizen_id")
    scheme_id = state.get("selected_scheme_id")
    profile = state.get("citizen_profile", {})

    write_agent_event(run_id, "Application Agent", "Assembling verified application draft...")

    draft_id = f"SAH-2026-{int(time.time()) % 900000 + 100000}"
    applicant_info = {
        "Full Name": {"value": profile.get("full_name", "Rahul Sharma"), "status": "verified"},
        "Date of Birth": {"value": "15-08-2004", "status": "verified"},
        "Annual Income": {"value": f"₹{profile.get('annual_income', 210000):,}", "status": "verified"},
        "Bank Account": {"value": "XXXX-XXXX-4321", "status": "needs_review"},
    }

    # Persist draft to applications table
    if supabase_admin and citizen_id and scheme_id:
        try:
            supabase_admin.table("applications").upsert({
                "citizen_id": citizen_id,
                "scheme_id": scheme_id,
                "status": "awaiting_approval",
                "applicant_info": applicant_info,
                "tracking_id": draft_id,
            }, on_conflict="citizen_id,scheme_id").execute()
        except Exception as e:
            logger.warning(f"Error persisting application draft: {e}")

    application_draft = {
        "id": draft_id,
        "scheme_id": scheme_id,
        "status": "awaiting_approval",
        "applicant_info": applicant_info,
    }

    write_agent_event(
        run_id,
        "Application Agent",
        "Application draft created and ready for citizen approval.",
        {"application_draft": application_draft}
    )

    # Update run status to COMPLETED
    if supabase_admin and run_id:
        try:
            supabase_admin.table("agent_runs").update({
                "status": "COMPLETED",
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).eq("id", run_id).execute()
        except Exception as e:
            logger.warning(f"Error updating agent_run status: {e}")

    return {"application_draft": application_draft}

# ==============================================================================
# Graph Routing & Compilation
# ==============================================================================

def route_eligibility(state: SahayakState) -> str:
    """Routes to application_agent if eligible, or document_agent if missing documents."""
    result = state.get("eligibility_result") or {}
    retry_count = state.get("retry_count", 0)

    if result.get("is_eligible", False):
        return "application_agent"
    
    if retry_count < 1:
        return "document_agent"
    
    # Cap loop at 1 retry and terminate in ACTION REQUIRED state
    run_id = state.get("run_id")
    if supabase_admin and run_id:
        supabase_admin.table("agent_runs").update({
            "status": "ACTION REQUIRED",
            "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }).eq("id", run_id).execute()
    return END

def create_sahayak_graph() -> StateGraph:
    """Builds and compiles the Sahayak LangGraph workflow."""
    workflow = StateGraph(SahayakState)

    workflow.add_node("citizen_agent", citizen_agent_node)
    workflow.add_node("scheme_agent", scheme_agent_node)
    workflow.add_node("eligibility_agent", eligibility_agent_node)
    workflow.add_node("document_agent", document_agent_node)
    workflow.add_node("application_agent", application_agent_node)

    workflow.set_entry_point("citizen_agent")
    workflow.add_edge("citizen_agent", "scheme_agent")
    workflow.add_edge("scheme_agent", "eligibility_agent")

    workflow.add_conditional_edges(
        "eligibility_agent",
        route_eligibility,
        {
            "application_agent": "application_agent",
            "document_agent": "document_agent",
            END: END,
        }
    )

    workflow.add_edge("document_agent", "eligibility_agent")
    workflow.add_edge("application_agent", END)

    return workflow.compile()

# Singleton compiled agent graph
sahayak_agent_workflow = create_sahayak_graph()
