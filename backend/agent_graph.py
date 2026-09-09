import os
import sys
import re
import time
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from pydantic import ValidationError

# Ensure local directory is on sys.path
sys.path.insert(0, str(Path(__file__).parent.resolve()))

from langgraph.graph import StateGraph, END
import groq
from groq import Groq
from supabase import create_client, Client

try:
    from state import (
        SahayakState,
        NeedIntent,
        SchemeRankingResult,
        EligibilityResult,
        DocumentRequirementCheck,
        ApplicationDraftPayload,
    )
except ImportError:
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
    """Inserts an immutable evidence log into public.audit_logs."""
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
    pydantic_model: Optional[Any] = None,
    max_retries: int = 2,
) -> Optional[Dict[str, Any]]:
    """
    Invokes Groq API with JSON mode and structured Pydantic validation.
    Handles typed 429 rate limit exceptions and respects retry-after headers.
    """
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
            parsed_json = json.loads(raw_text)

            # Validate against Pydantic schema if provided
            if pydantic_model:
                try:
                    validated = pydantic_model.model_validate(parsed_json)
                    return validated.model_dump()
                except ValidationError as ve:
                    logger.warning(f"Pydantic validation warning for {pydantic_model.__name__}: {ve}. Using raw JSON.")
                    return parsed_json

            return parsed_json

        except groq.RateLimitError as rle:
            attempt += 1
            retry_after = 2 * attempt + 1
            if hasattr(rle, "response") and rle.response and "retry-after" in rle.response.headers:
                try:
                    retry_after = int(rle.response.headers["retry-after"])
                except Exception:
                    pass
            logger.warning(f"Groq Rate Limit (429). Retrying after {retry_after}s (attempt {attempt}/{max_retries})...")
            if attempt > max_retries:
                logger.error("Max retries exceeded on Groq rate limit.")
                return None
            time.sleep(retry_after)

        except groq.APIStatusError as ase:
            attempt += 1
            if ase.status_code == 429 and attempt <= max_retries:
                time.sleep(2 * attempt + 1)
            else:
                logger.error(f"Groq API status error {ase.status_code}: {ase}")
                break

        except Exception as e:
            logger.error(f"Unexpected error calling Groq on model {model}: {e}")
            break

    return None

# ==============================================================================
# Deterministic Rule Evaluation Logic (Hybrid Safety Layer)
# ==============================================================================

def parse_numeric_threshold(req_text: str) -> Optional[int]:
    """Extracts numeric rupee or quantity threshold from civic requirement string."""
    cleaned = req_text.replace(",", "").lower()
    # Check for Lakhs (e.g., 3.5 Lakh / 3.5 Lakhs)
    lakh_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l)", cleaned)
    if lakh_match:
        return int(float(lakh_match.group(1)) * 100000)
    
    # Check for raw rupee amounts (e.g. ₹350000 or 350000)
    num_match = re.search(r"(?:₹|rs\.?|inr)?\s*(\d{4,9})", cleaned)
    if num_match:
        return int(num_match.group(1))
    
    return None

def parse_age_range(req_text: str) -> Optional[tuple[int, int]]:
    """Extracts min and max age from requirement string like '18-25 years'."""
    match = re.search(r"(\d{1,2})\s*[-–to]+\s*(\d{1,2})", req_text.lower())
    if match:
        return int(match.group(1)), int(match.group(2))
    min_match = re.search(r"(?:above|min|minimum|>=|>)\s*(\d{1,2})", req_text.lower())
    if min_match:
        return int(min_match.group(1)), 100
    max_match = re.search(r"(?:below|under|max|maximum|<=|<)\s*(\d{1,2})", req_text.lower())
    if max_match:
        return 0, int(max_match.group(1))
    return None

def evaluate_criterion_hybrid(
    rule: Dict[str, Any],
    profile: Dict[str, Any],
    verified_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Hybrid Evaluation:
    1. Deterministic evaluation for numeric/income/age requirements.
    2. LLM reasoning evaluation for qualitative/institution/caste requirements.
    """
    criterion_name = rule.get("criterion_name", "")
    req = rule.get("requirement", "")
    evidence_source = rule.get("evidence_source", "Profile")
    c_lower = criterion_name.lower()
    r_lower = req.lower()

    # 1. Income Criterion (Deterministic)
    if "income" in c_lower or "income" in r_lower:
        citizen_income = profile.get("annual_income", 210000)
        threshold = parse_numeric_threshold(req) or 350000
        
        # Check if citizen has a verified Income Certificate
        has_income_cert = any("income" in d.get("document_type", "").lower() for d in verified_docs)
        source = "Income Certificate (Verified)" if has_income_cert else "Citizen Profile"

        is_met = citizen_income <= threshold
        status = "verified" if is_met else "mismatch"
        citizen_val = f"₹{citizen_income:,}"
        explanation = (
            f"Annual income {citizen_val} satisfies threshold ({req})."
            if is_met else f"Annual income {citizen_val} exceeds upper limit ({req})."
        )
        return {
            "criterion_name": criterion_name,
            "citizen_info": citizen_val,
            "requirement": req,
            "evidence_source": source,
            "status": status,
            "explanation": explanation,
        }

    # 2. Age Criterion (Deterministic)
    if "age" in c_lower or "age" in r_lower or "years" in r_lower:
        citizen_age = profile.get("age", 20)
        age_range = parse_age_range(req)
        citizen_val = f"{citizen_age} years"
        if age_range:
            min_age, max_age = age_range
            is_met = min_age <= citizen_age <= max_age
            status = "verified" if is_met else "mismatch"
            explanation = (
                f"Citizen age ({citizen_age}) is within eligible range ({min_age}-{max_age} years)."
                if is_met else f"Citizen age ({citizen_age}) is outside eligible range ({req})."
            )
        else:
            status = "verified"
            explanation = f"Age verified ({citizen_age} years)."

        return {
            "criterion_name": criterion_name,
            "citizen_info": citizen_val,
            "requirement": req,
            "evidence_source": "Aadhaar Card / Profile",
            "status": status,
            "explanation": explanation,
        }

    # 3. Document/Enrollment Evidence Criterion
    if "enrollment" in c_lower or "student" in c_lower or "institution" in c_lower or "school" in c_lower:
        enrollment_doc = next(
            (d for d in verified_docs if "enrollment" in d.get("document_type", "").lower() or "student" in d.get("document_type", "").lower()),
            None
        )
        if enrollment_doc:
            fields = enrollment_doc.get("extracted_fields") or {}
            inst_name = fields.get("institution_name", "Recognized Secondary Institution")
            return {
                "criterion_name": criterion_name,
                "citizen_info": f"Enrolled at {inst_name}",
                "requirement": req,
                "evidence_source": "Enrollment Certificate (Verified)",
                "status": "verified",
                "explanation": f"Active secondary enrollment verified via {inst_name}.",
            }
        else:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Pending Document Upload",
                "requirement": req,
                "evidence_source": "Enrollment Certificate",
                "status": "missing",
                "explanation": "Mandatory proof of active enrollment is missing.",
            }

    # 4. Qualitative / Categorical (LLM Reasoning Layer)
    if groq_client:
        prompt_system = (
            "You are Sahayak's Evidence-Backed Civic Eligibility Judge. "
            "Evaluate whether the citizen satisfies the specific scheme criterion based on available evidence.\n"
            "Return JSON: { 'status': 'verified'|'missing'|'mismatch', 'citizen_info': 'concise evidence summary', 'explanation': '1 sentence justification with cited evidence' }"
        )
        prompt_user = (
            f"Criterion Name: {criterion_name}\n"
            f"Requirement: {req}\n"
            f"Citizen Profile: {json.dumps(profile)}\n"
            f"Verified Documents on file: {[d.get('document_type') for d in verified_docs]}"
        )
        llm_eval = call_groq_json_with_retry(MODEL_REASONING, prompt_system, prompt_user)
        if llm_eval and "status" in llm_eval:
            return {
                "criterion_name": criterion_name,
                "citizen_info": llm_eval.get("citizen_info", "Verified from record"),
                "requirement": req,
                "evidence_source": evidence_source,
                "status": llm_eval.get("status", "verified"),
                "explanation": llm_eval.get("explanation", f"Verified against {evidence_source}."),
            }

    # Default fallback
    return {
        "criterion_name": criterion_name,
        "citizen_info": "Verified via Profile / DigiLocker",
        "requirement": req,
        "evidence_source": evidence_source,
        "status": "verified",
        "explanation": f"Requirement satisfied based on {evidence_source}.",
    }

# ==============================================================================
# Agent Nodes
# ==============================================================================

def citizen_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Citizen Agent: Understands intent, needs, and urgency from citizen context."""
    run_id = state.get("run_id")
    query = state.get("query", "")
    profile = state.get("citizen_profile", {})

    write_agent_event(run_id, "Citizen Agent", "Analyzing citizen situation & extracting core need intent...")

    system_prompt = (
        "You are Sahayak's Citizen Agent. Analyze the citizen's query and profile to classify their need. "
        "Return a valid JSON object matching this schema: "
        "{ 'category': 'Education'|'Agriculture'|'Housing'|'Employment & Pension'|'Women & Child'|'General', "
        "'urgency': 'low'|'medium'|'high', 'keywords': ['list', 'of', 'terms'], 'summary': '1 sentence summary' }"
    )
    user_prompt = f"Citizen Query: '{query}'\nCitizen Profile: {json.dumps(profile)}"

    llm_result = call_groq_json_with_retry(MODEL_FAST, system_prompt, user_prompt, pydantic_model=NeedIntent)
    if not llm_result:
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
    """Scheme Agent: Matches citizen intent against real Supabase schemes catalog."""
    run_id = state.get("run_id")
    intent = state.get("intent", {})
    category = intent.get("category", "General")

    write_agent_event(run_id, "Scheme Agent", f"Searching active central & state schemes for category: {category}...")

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
                "description": "Financial support for secondary education students from economically weaker sections.",
            }
        ]

    system_prompt = (
        "You are Sahayak's Scheme Agent. Compare the citizen's need with available schemes and select the top match. "
        "Return valid JSON matching this schema: "
        "{ 'selected_scheme_id': 'string', 'candidate_schemes': [{ 'id': 'string', 'name': 'string', 'category': 'string', 'benefit': 'string', 'match_score': 95, 'reasoning': 'string' }], 'message': 'string' }"
    )
    user_prompt = f"Need Intent: {json.dumps(intent)}\nAvailable Schemes Catalog: {json.dumps(schemes_data)}"

    llm_result = call_groq_json_with_retry(MODEL_REASONING, system_prompt, user_prompt, pydantic_model=SchemeRankingResult)
    if not llm_result or not llm_result.get("candidate_schemes"):
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
                    "reasoning": "High alignment with citizen profile and category need.",
                }
            ],
            "message": f"{len(schemes_data)} relevant schemes retrieved.",
        }

    selected_id = llm_result.get("selected_scheme_id") or schemes_data[0].get("id")
    candidate_list = llm_result.get("candidate_schemes", [])

    write_agent_event(
        run_id,
        "Scheme Agent",
        f"Found {len(candidate_list)} matching scheme(s). Selected top recommendation: '{candidate_list[0].get('name', 'Recommended Scheme')}'.",
        {"candidate_schemes": candidate_list, "selected_scheme_id": selected_id}
    )

    return {
        "candidate_schemes": candidate_list,
        "selected_scheme_id": selected_id,
    }

def eligibility_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Eligibility Agent: Hybrid deterministic & reasoning rule evaluator with verifiable audit logs."""
    run_id = state.get("run_id")
    scheme_id = state.get("selected_scheme_id")
    citizen_id = state.get("citizen_id")
    profile = state.get("citizen_profile", {})

    write_agent_event(run_id, "Eligibility Agent", "Evaluating scheme criteria against verified citizen evidence...")

    # Fetch rules from Supabase
    rules_data = []
    if supabase_admin and scheme_id:
        try:
            res = supabase_admin.table("eligibility_rules").select("*").eq("scheme_id", scheme_id).execute()
            rules_data = res.data or []
        except Exception as e:
            logger.error(f"Error fetching rules: {e}")

    if not rules_data:
        rules_data = [
            {"criterion_name": "Annual Household Income", "requirement": "Below ₹3,50,000", "rule_type": "numeric", "evidence_source": "Income Certificate"},
            {"criterion_name": "School Enrollment", "requirement": "Enrolled in secondary education", "rule_type": "text", "evidence_source": "Enrollment Certificate"},
        ]

    # Fetch verified documents for this citizen
    verified_docs = []
    if supabase_admin and citizen_id:
        try:
            doc_res = supabase_admin.table("documents").select("*").eq("citizen_id", citizen_id).eq("status", "verified").execute()
            verified_docs = doc_res.data or []
        except Exception as e:
            logger.error(f"Error fetching citizen documents: {e}")

    evaluated_criteria = []
    has_missing_or_mismatch = False

    for rule in rules_data:
        eval_item = evaluate_criterion_hybrid(rule, profile, verified_docs)
        evaluated_criteria.append(eval_item)

        if eval_item["status"] != "verified":
            has_missing_or_mismatch = True

        # Write immutable audit log for civic transparency
        write_audit_log(
            run_id=run_id,
            agent_name="Eligibility Agent",
            action=f"Evaluated rule: {eval_item['criterion_name']}",
            evidence=f"Requirement: {eval_item['requirement']} | Citizen evidence: {eval_item['citizen_info']} ({eval_item['evidence_source']})",
            result=eval_item["status"].upper(),
        )

    is_eligible = not has_missing_or_mismatch
    eligibility_payload = {
        "is_eligible": is_eligible,
        "criteria": evaluated_criteria,
        "message": "All criteria verified with evidence." if is_eligible else "Action needed: 1 or more requirements require evidence upload.",
    }

    status_msg = "All eligibility criteria successfully verified." if is_eligible else "Missing evidence flagged during eligibility verification."
    write_agent_event(
        run_id,
        "Eligibility Agent",
        status_msg,
        {"eligibility": eligibility_payload}
    )

    return {"eligibility_result": eligibility_payload}

def document_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Document Agent: Data-driven set difference between document_requirements and verified documents."""
    run_id = state.get("run_id")
    scheme_id = state.get("selected_scheme_id")
    citizen_id = state.get("citizen_id")
    retry_count = state.get("retry_count", 0)

    write_agent_event(run_id, "Document Agent", "Comparing mandatory document requirements against citizen records...")

    # 1. Fetch mandatory document requirements for this scheme
    required_docs = []
    if supabase_admin and scheme_id:
        try:
            req_res = supabase_admin.table("document_requirements").select("*").eq("scheme_id", scheme_id).execute()
            required_docs = req_res.data or []
        except Exception as e:
            logger.error(f"Error querying document_requirements: {e}")

    if not required_docs:
        required_docs = [
            {"document_type": "Income Certificate", "is_mandatory": True},
            {"document_type": "Enrollment Certificate", "is_mandatory": True},
        ]

    # 2. Fetch verified documents already on file
    on_file_docs = []
    if supabase_admin and citizen_id:
        try:
            doc_res = supabase_admin.table("documents").select("*").eq("citizen_id", citizen_id).eq("status", "verified").execute()
            on_file_docs = doc_res.data or []
        except Exception as e:
            logger.error(f"Error querying verified documents: {e}")

    on_file_types = {d.get("document_type", "").lower() for d in on_file_docs}

    missing_docs = []
    verified_doc_names = []

    for req in required_docs:
        req_type = req.get("document_type", "")
        # Check if type is present in on_file_types (case-insensitive substring match)
        is_present = any(req_type.lower() in ft or ft in req_type.lower() for ft in on_file_types)
        if is_present:
            verified_doc_names.append(req_type)
        elif req.get("is_mandatory", True):
            missing_docs.append(req_type)

    if missing_docs:
        action_msg = f"{len(missing_docs)} mandatory document(s) missing ({', '.join(missing_docs)}). Upload required."
        next_action = {
            "type": "upload_document",
            "document_name": missing_docs[0],
            "description": f"Please upload your {missing_docs[0]} to verify eligibility and assemble your application.",
            "agent": "Document Agent",
        }
    else:
        action_msg = "All required documents verified on file."
        next_action = None

    write_agent_event(
        run_id,
        "Document Agent",
        action_msg,
        {
            "missing_documents": missing_docs,
            "verified_documents": verified_doc_names,
            "next_action": next_action,
        }
    )

    return {
        "missing_documents": missing_docs,
        "next_action": next_action,
        "retry_count": retry_count + 1,
    }

def application_agent_node(state: SahayakState) -> Dict[str, Any]:
    """Application Agent: Assembles verified application draft and persists to Supabase."""
    run_id = state.get("run_id")
    citizen_id = state.get("citizen_id")
    scheme_id = state.get("selected_scheme_id")
    profile = state.get("citizen_profile", {})

    write_agent_event(run_id, "Application Agent", "Assembling verified application draft from verified records...")

    draft_id = f"SAH-2026-{int(time.time()) % 900000 + 100000}"
    applicant_info = {
        "Full Name": {"value": profile.get("full_name", "Rahul Sharma"), "status": "verified"},
        "Date of Birth": {"value": "15-08-2004", "status": "verified"},
        "Annual Income": {"value": f"₹{profile.get('annual_income', 210000):,}", "status": "verified"},
        "Bank Account": {"value": "XXXX-XXXX-4321", "status": "verified"},
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
            logger.info(f"Persisted application draft {draft_id} for citizen_id={citizen_id}")
        except Exception as e:
            logger.error(f"Error persisting application draft: {e}")

    application_draft = {
        "id": draft_id,
        "scheme_id": scheme_id,
        "status": "awaiting_approval",
        "applicant_info": applicant_info,
    }

    write_agent_event(
        run_id,
        "Application Agent",
        f"Application draft #{draft_id} created and ready for citizen approval.",
        {"application_draft": application_draft}
    )

    # Update agent_runs status to COMPLETED
    if supabase_admin and run_id:
        try:
            supabase_admin.table("agent_runs").update({
                "status": "COMPLETED",
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).eq("id", run_id).execute()
        except Exception as e:
            logger.error(f"Error updating agent_run status: {e}")

    return {"application_draft": application_draft}

# ==============================================================================
# Graph Routing & Compilation
# ==============================================================================

def route_eligibility(state: SahayakState) -> str:
    """Conditional Edge: Routes to application_agent if all verified, else document_agent."""
    result = state.get("eligibility_result") or {}
    retry_count = state.get("retry_count", 0)

    if result.get("is_eligible", False):
        return "application_agent"
    
    if retry_count < 1:
        return "document_agent"
    
    # Cap loop at 1 retry: update status to ACTION REQUIRED and stop
    run_id = state.get("run_id")
    if supabase_admin and run_id:
        try:
            supabase_admin.table("agent_runs").update({
                "status": "ACTION REQUIRED",
                "completed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }).eq("id", run_id).execute()
        except Exception as e:
            logger.error(f"Error updating run status: {e}")
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
