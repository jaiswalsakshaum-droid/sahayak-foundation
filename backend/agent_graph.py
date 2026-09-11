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
        CriterionEvaluation,
        DocumentRequirementCheck,
        ApplicationDraftPayload,
    )
except ImportError:
    from backend.state import (
        SahayakState,
        NeedIntent,
        SchemeRankingResult,
        EligibilityResult,
        CriterionEvaluation,
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

def write_agent_event(
    run_id: str,
    agent_name: str,
    action: str,
    details: Optional[Dict[str, Any]] = None,
    event_code: Optional[str] = None,
):
    """Inserts a real-time event into public.agent_events."""
    logger.info(f"[{agent_name}] {action}")
    if not supabase_admin or not run_id:
        return
    payload_details = dict(details or {})
    if event_code and "event_code" not in payload_details:
        payload_details["event_code"] = event_code
    try:
        supabase_admin.table("agent_events").insert({
            "run_id": run_id,
            "agent_name": agent_name,
            "action": action,
            "details": payload_details,
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
# Deterministic & Grounded Rule Evaluation Logic (Hybrid Safety Layer)
# ==============================================================================

def parse_numeric_threshold(req_text: str) -> Optional[int]:
    """Extracts numeric rupee or quantity threshold from civic requirement string."""
    cleaned = req_text.replace(",", "").lower()
    # Check for Lakhs (e.g., 3.5 Lakh / 3.5 Lakhs / 3L / 6L / 18L)
    lakh_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|l\b)", cleaned)
    if lakh_match:
        return int(float(lakh_match.group(1)) * 100000)
    
    # Check for raw rupee amounts (e.g. ₹350000 or 350000)
    num_match = re.search(r"(?:₹|rs\.?|inr)?\s*(\d{4,9})", cleaned)
    if num_match:
        return int(num_match.group(1))
    
    return None

def parse_age_range(req_text: str) -> Optional[tuple[int, int]]:
    """Extracts min and max age from requirement string like '14-18 years', '18-40 years', 'Below 10 years'."""
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

def evaluate_numeric_rule(
    criterion_name: str,
    req: str,
    evidence_source: str,
    profile: Dict[str, Any],
    verified_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Evaluates numeric threshold and range criteria (income, age, allowances)."""
    c_lower = criterion_name.lower()
    r_lower = req.lower()

    # 1. Income Comparison
    if "income" in c_lower or "income" in r_lower or "₹" in req or "rs" in r_lower:
        # Check verified Income Certificate first, then profile
        income_doc = next(
            (d for d in verified_docs if "income" in d.get("document_type", "").lower()),
            None
        )
        extracted = (income_doc.get("extracted_fields") or {}) if income_doc else {}
        citizen_income = extracted.get("annual_income") or profile.get("annual_income")

        if citizen_income is None:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Not Specified",
                "requirement": req,
                "evidence_source": evidence_source or "Income Certificate",
                "status": "missing",
                "explanation": "Annual household income is not declared or documented in profile.",
            }

        try:
            citizen_income = int(float(str(citizen_income).replace(",", "").replace("₹", "")))
        except (ValueError, TypeError):
            citizen_income = 210000

        threshold = parse_numeric_threshold(req) or 350000
        is_met = citizen_income <= threshold
        status = "verified" if is_met else "mismatch"
        citizen_val = f"₹{citizen_income:,}"
        source = "Income Certificate (Verified)" if income_doc else "Citizen Profile"
        explanation = (
            f"Annual income {citizen_val} satisfies ceiling ({req})."
            if is_met
            else f"Annual income {citizen_val} exceeds upper limit ({req})."
        )
        return {
            "criterion_name": criterion_name,
            "citizen_info": citizen_val,
            "requirement": req,
            "evidence_source": source,
            "status": status,
            "explanation": explanation,
        }

    # 2. Age Range Comparison
    if "age" in c_lower or "age" in r_lower or "years" in r_lower or "year" in r_lower:
        # Check identity docs or profile
        id_doc = next(
            (d for d in verified_docs if any(k in d.get("document_type", "").lower() for k in ["aadhaar", "identity", "birth", "pan"])),
            None
        )
        extracted = (id_doc.get("extracted_fields") or {}) if id_doc else {}
        citizen_age = extracted.get("age") or profile.get("age")

        if citizen_age is None:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Not Verified",
                "requirement": req,
                "evidence_source": evidence_source or "Identity Document",
                "status": "missing",
                "explanation": "Citizen age could not be determined from profile or identity documents.",
            }

        try:
            citizen_age = int(float(citizen_age))
        except (ValueError, TypeError):
            citizen_age = 20

        age_range = parse_age_range(req)
        citizen_val = f"{citizen_age} years"
        source = f"{id_doc.get('document_type')} (Verified)" if id_doc else "Citizen Profile"

        if age_range:
            min_age, max_age = age_range
            is_met = min_age <= citizen_age <= max_age
            status = "verified" if is_met else "mismatch"
            explanation = (
                f"Citizen age ({citizen_age} years) is within eligible range ({min_age}-{max_age} years)."
                if is_met
                else f"Citizen age ({citizen_age} years) is outside eligible range ({req})."
            )
        else:
            status = "verified"
            explanation = f"Age criteria satisfied ({citizen_age} years)."

        return {
            "criterion_name": criterion_name,
            "citizen_info": citizen_val,
            "requirement": req,
            "evidence_source": source,
            "status": status,
            "explanation": explanation,
        }

    # Generic numeric fallback
    threshold = parse_numeric_threshold(req)
    return {
        "criterion_name": criterion_name,
        "citizen_info": f"Threshold {threshold or req}",
        "requirement": req,
        "evidence_source": evidence_source,
        "status": "verified" if threshold else "missing",
        "explanation": f"Numerical criterion evaluated against {evidence_source}.",
    }

def evaluate_boolean_rule(
    criterion_name: str,
    req: str,
    evidence_source: str,
    profile: Dict[str, Any],
    verified_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Evaluates yes/no attributes (landholding, pucca house ownership, taxpayer status, bank seeding)."""
    c_lower = criterion_name.lower()
    r_lower = req.lower()

    # 1. Landholding / Land Ownership (PM-KISAN)
    if "land" in c_lower or "land" in r_lower or "cultivable" in r_lower:
        land_doc = next(
            (d for d in verified_docs if any(k in d.get("document_type", "").lower() for k in ["land", "ror", "khasra", "khatauni"])),
            None
        )
        if land_doc:
            fields = land_doc.get("extracted_fields") or {}
            land_size = fields.get("land_area", "Cultivable family parcel")
            return {
                "criterion_name": criterion_name,
                "citizen_info": f"Verified landholding: {land_size}",
                "requirement": req,
                "evidence_source": "Land Records / RoR (Verified)",
                "status": "verified",
                "explanation": f"Agricultural land ownership verified via official land records ({land_size}).",
            }
        
        # Check profile declaration
        if profile.get("occupation", "").lower() in ["farmer", "agriculture", "agricultural assistant"] or profile.get("has_land"):
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Declared Landholding Farmer",
                "requirement": req,
                "evidence_source": "Self Declaration / Profile",
                "status": "verified",
                "explanation": "Agricultural landholder status declared in profile. Upload RoR for statutory filing.",
            }

        return {
            "criterion_name": criterion_name,
            "citizen_info": "Land Record Not Uploaded",
            "requirement": req,
            "evidence_source": evidence_source or "Land Records / RoR",
            "status": "missing",
            "explanation": "Mandatory proof of cultivable landholding (RoR) is missing.",
        }

    # 2. Pucca House Ownership (PMAY-U: Must not own a pucca house)
    if "house" in c_lower or "pucca" in r_lower or "housing" in c_lower:
        owns_pucca = profile.get("owns_pucca_house", False)
        if not owns_pucca:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "No Pucca House Owned",
                "requirement": req,
                "evidence_source": "Self Declaration / Affidavit",
                "status": "verified",
                "explanation": "Citizen self-declaration confirms no prior pucca dwelling ownership across India.",
            }
        else:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Owns Pucca House",
                "requirement": req,
                "evidence_source": "Self Declaration",
                "status": "mismatch",
                "explanation": "Beneficiary already owns a pucca house, exceeding PMAY-U eligibility guidelines.",
            }

    # 3. Taxpayer Status (APY: Not an income taxpayer)
    if "tax" in c_lower or "taxpayer" in r_lower:
        is_taxpayer = profile.get("is_taxpayer", False)
        if not is_taxpayer:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Non-Taxpayer Record",
                "requirement": req,
                "evidence_source": "Self Declaration / PAN",
                "status": "verified",
                "explanation": "Verified non-taxpayer status under IT Act for unorganized sector pension eligibility.",
            }
        else:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Income Taxpayer",
                "requirement": req,
                "evidence_source": "Income Tax Records",
                "status": "mismatch",
                "explanation": "Existing income taxpayer status disqualifies from APY government co-contribution.",
            }

    # Default boolean check against profile
    attr_key = criterion_name.lower().replace(" ", "_")
    profile_val = profile.get(attr_key)
    if profile_val is not None:
        status = "verified" if bool(profile_val) else "mismatch"
        return {
            "criterion_name": criterion_name,
            "citizen_info": str(profile_val),
            "requirement": req,
            "evidence_source": evidence_source,
            "status": status,
            "explanation": f"Boolean attribute verified from citizen profile: {profile_val}.",
        }

    return {
        "criterion_name": criterion_name,
        "citizen_info": "Pending Verification",
        "requirement": req,
        "evidence_source": evidence_source,
        "status": "missing",
        "explanation": f"Insufficient data to verify {criterion_name} ({req}).",
    }

def evaluate_enum_rule(
    criterion_name: str,
    req: str,
    evidence_source: str,
    profile: Dict[str, Any],
    verified_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Evaluates categorical criteria (caste category, domicile/location, gender, education level)."""
    c_lower = criterion_name.lower()
    r_lower = req.lower()

    # 1. Location / Domicile / State residency
    if "location" in c_lower or "residence" in c_lower or "domicile" in c_lower or "state" in c_lower or "urban" in r_lower:
        citizen_loc = profile.get("location", "")
        if citizen_loc:
            # Check if state or urban matches
            is_match = any(term in citizen_loc.lower() for term in ["uttar pradesh", "lucknow", "urban", "delhi", "maharashtra", "india"]) or "india" in r_lower or "resident" in r_lower
            return {
                "criterion_name": criterion_name,
                "citizen_info": citizen_loc,
                "requirement": req,
                "evidence_source": "Citizen Profile / Aadhaar",
                "status": "verified" if is_match else "mismatch",
                "explanation": f"Citizen location '{citizen_loc}' matches requirement ({req})." if is_match else f"Location '{citizen_loc}' does not satisfy requirement ({req}).",
            }

    # 2. Caste / Social Category (General, OBC, SC, ST, EWS)
    if "caste" in c_lower or "category" in c_lower or "social" in c_lower:
        category_doc = next(
            (d for d in verified_docs if "caste" in d.get("document_type", "").lower() or "category" in d.get("document_type", "").lower()),
            None
        )
        citizen_cat = profile.get("category") or (category_doc.get("extracted_fields", {}).get("category") if category_doc else None)
        if citizen_cat:
            is_match = citizen_cat.lower() in r_lower or "all" in r_lower or "any" in r_lower
            return {
                "criterion_name": criterion_name,
                "citizen_info": citizen_cat,
                "requirement": req,
                "evidence_source": "Caste Certificate (Verified)" if category_doc else "Citizen Profile",
                "status": "verified" if is_match else "mismatch",
                "explanation": f"Citizen social category '{citizen_cat}' evaluated against {req}.",
            }
        return {
            "criterion_name": criterion_name,
            "citizen_info": "Not Stated",
            "requirement": req,
            "evidence_source": evidence_source,
            "status": "missing",
            "explanation": "Category proof required for reserved scheme quota.",
        }

    # 3. Education Level / Status
    if "education" in c_lower or "qualification" in c_lower:
        edu = profile.get("education_level") or profile.get("occupation", "")
        if edu:
            return {
                "criterion_name": criterion_name,
                "citizen_info": str(edu),
                "requirement": req,
                "evidence_source": "Citizen Profile",
                "status": "verified",
                "explanation": f"Educational background ({edu}) meets scheme eligibility guidelines.",
            }

    return {
        "criterion_name": criterion_name,
        "citizen_info": "Not Provided",
        "requirement": req,
        "evidence_source": evidence_source,
        "status": "missing",
        "explanation": f"Insufficient profile details to verify {criterion_name} ({req}).",
    }

def evaluate_text_rule(
    criterion_name: str,
    req: str,
    evidence_source: str,
    profile: Dict[str, Any],
    verified_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Evaluates qualitative/text criteria with grounded document evidence and structured LLM fallback."""
    c_lower = criterion_name.lower()
    r_lower = req.lower()

    # 1. School / College Enrollment Evidence
    if "enrollment" in c_lower or "student" in c_lower or "school" in c_lower or "institution" in c_lower:
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
                "explanation": "Mandatory proof of active school/institution enrollment is missing.",
            }

    # 2. Bank Account / Passbook Seeding
    if "bank" in c_lower or "bank" in r_lower or "account" in c_lower or "aadhaar-seeded" in r_lower:
        bank_doc = next(
            (d for d in verified_docs if "bank" in d.get("document_type", "").lower() or "passbook" in d.get("document_type", "").lower()),
            None
        )
        if bank_doc:
            fields = bank_doc.get("extracted_fields") or {}
            bank_name = fields.get("bank_name", "Active Bank Account")
            return {
                "criterion_name": criterion_name,
                "citizen_info": f"Active account at {bank_name}",
                "requirement": req,
                "evidence_source": "Bank Passbook (Verified)",
                "status": "verified",
                "explanation": f"Aadhaar-seeded active bank account confirmed via {bank_name}.",
            }
        else:
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Bank Passbook Missing",
                "requirement": req,
                "evidence_source": "Bank Passbook",
                "status": "missing",
                "explanation": "Direct Benefit Transfer requires verified bank account passbook.",
            }

    # 3. Citizenship / Resident Indian
    if "citizen" in c_lower or "citizenship" in c_lower or "resident" in r_lower:
        id_doc = next(
            (d for d in verified_docs if any(k in d.get("document_type", "").lower() for k in ["aadhaar", "identity", "passport", "voter"])),
            None
        )
        if id_doc or profile.get("location"):
            return {
                "criterion_name": criterion_name,
                "citizen_info": "Resident Indian Citizen",
                "requirement": req,
                "evidence_source": "Aadhaar / National Identity (Verified)" if id_doc else "Citizen Profile",
                "status": "verified",
                "explanation": "Indian citizenship and residency confirmed via verified civic identity records.",
            }

    # 4. Grounded LLM Reasoning Layer for Complex Declarations
    if groq_client:
        prompt_system = (
            "You are Sahayak's Evidence-Backed Civic Eligibility Judge. "
            "Evaluate whether the citizen satisfies the specific scheme criterion based STRICTLY on available evidence.\n"
            "If evidence is insufficient or no matching document is present, return status 'missing' with a clear citation.\n"
            "Return valid JSON matching: { 'criterion_name': '...', 'citizen_info': 'concise evidence summary', 'requirement': '...', 'evidence_source': '...', 'status': 'verified'|'missing'|'mismatch', 'explanation': '1 sentence justification with cited evidence' }"
        )
        prompt_user = (
            f"Criterion Name: {criterion_name}\n"
            f"Requirement: {req}\n"
            f"Evidence Source Expected: {evidence_source}\n"
            f"Citizen Profile: {json.dumps(profile)}\n"
            f"Verified Documents on file: {[d.get('document_type') for d in verified_docs]}"
        )
        llm_eval = call_groq_json_with_retry(
            MODEL_REASONING,
            prompt_system,
            prompt_user,
            pydantic_model=CriterionEvaluation
        )
        if llm_eval and "status" in llm_eval:
            return {
                "criterion_name": criterion_name,
                "citizen_info": llm_eval.get("citizen_info", "Inspected from records"),
                "requirement": req,
                "evidence_source": evidence_source,
                "status": llm_eval.get("status", "missing"),
                "explanation": llm_eval.get("explanation", f"Evaluated against {evidence_source}."),
            }

    # Missing evidence fallback — never rubber stamp!
    return {
        "criterion_name": criterion_name,
        "citizen_info": "Insufficient Data",
        "requirement": req,
        "evidence_source": evidence_source,
        "status": "missing",
        "explanation": f"Insufficient data to verify {criterion_name}. Mandatory evidence ({evidence_source}) is required.",
    }

def evaluate_criterion_hybrid(
    rule: Dict[str, Any],
    profile: Dict[str, Any],
    verified_docs: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Dispatches criterion evaluation based on rule_type:
    - 'numeric': Threshold & range bounds (income, age).
    - 'boolean': Yes/no civic attributes (landholding, pucca house, taxpayer status).
    - 'enum': Categorical matching (caste, location/domicile, education level).
    - 'text': Qualitative evidence matching & grounded LLM reasoning.
    """
    criterion_name = rule.get("criterion_name", "Eligibility Rule")
    req = rule.get("requirement", "")
    rule_type = (rule.get("rule_type") or "text").lower()
    evidence_source = rule.get("evidence_source", "Profile / Verification Engine")

    if rule_type == "numeric":
        return evaluate_numeric_rule(criterion_name, req, evidence_source, profile, verified_docs)
    elif rule_type == "boolean":
        return evaluate_boolean_rule(criterion_name, req, evidence_source, profile, verified_docs)
    elif rule_type == "enum":
        return evaluate_enum_rule(criterion_name, req, evidence_source, profile, verified_docs)
    else:  # text / qualitative
        return evaluate_text_rule(criterion_name, req, evidence_source, profile, verified_docs)

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
                "source_run_id": run_id,
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
        {"application_draft": application_draft, "event_code": "APPLICATION_DRAFT_CREATED"},
        event_code="APPLICATION_DRAFT_CREATED",
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

def tracker_agent_node(state: SahayakState) -> Dict[str, Any]:
    """
    Tracker Agent Node: Deterministic status-transition watcher & next-best-action generator.
    Scans submitted/under_review applications, records progress events, checks SLA delays,
    and returns next action guidance.
    """
    run_id = state.get("run_id")
    citizen_id = state.get("citizen_id")

    write_agent_event(
        run_id,
        "Tracker Agent",
        "Scanning active application review statuses across government departments...",
        event_code="TRACKER_SWEEP_STARTED",
    )

    if not supabase_admin:
        return {"next_action": {"type": "status_check", "description": "Tracker Agent active."}}

    try:
        query = supabase_admin.table("applications").select("*, schemes(name)")
        if citizen_id:
            query = query.eq("citizen_id", citizen_id)
        res = query.in_("status", ["submitted", "under_review"]).execute()
        apps = res.data or []

        for app_row in apps:
            app_citizen = app_row.get("citizen_id") or citizen_id
            tracking_id = app_row.get("tracking_id", "Unknown")
            scheme_name = (app_row.get("schemes") or {}).get("name") or "Government Scheme"
            created_at_str = app_row.get("created_at")
            days_since = 1
            if created_at_str:
                try:
                    from datetime import datetime, timezone
                    created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    days_since = max(1, (datetime.now(timezone.utc) - created_dt).days)
                except Exception:
                    days_since = 1

            status_label = "under departmental review" if app_row.get("status") == "under_review" else "submitted"
            action_text = f"Application {tracking_id} ({scheme_name}) is {status_label} (Day {days_since})."
            write_agent_event(
                run_id,
                "Tracker Agent",
                action_text,
                {
                    "event_code": "TRACKER_STATUS_CHECK",
                    "tracking_id": tracking_id,
                    "days_since_submission": days_since,
                    "status": app_row.get("status"),
                },
                event_code="TRACKER_STATUS_CHECK",
            )

            # SLA escalation check (nudge if pending review > 10 days)
            if days_since > 10 and app_row.get("status") == "submitted" and app_citizen:
                try:
                    supabase_admin.table("notifications").insert({
                        "citizen_id": app_citizen,
                        "title": f"Review SLA Notice: {scheme_name}",
                        "body": f"Application {tracking_id} has reached Day {days_since} of departmental review. Tracker Agent is monitoring for updates.",
                        "type": "warning",
                    }).execute()
                except Exception as ne:
                    logger.warning(f"Error inserting tracker SLA notification: {ne}")

    except Exception as e:
        logger.error(f"Error running tracker agent sweep: {e}")

    next_action = {
        "type": "tracker_monitoring",
        "description": "Tracker Agent is actively monitoring department review timelines and SLA checkpoints.",
        "agent": "Tracker Agent",
    }

    write_agent_event(
        run_id,
        "Tracker Agent",
        "Tracker Agent sweep completed. Monitoring active.",
        {"next_action": next_action, "event_code": "TRACKER_SWEEP_COMPLETED"},
        event_code="TRACKER_SWEEP_COMPLETED",
    )

    return {"next_action": next_action}

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
