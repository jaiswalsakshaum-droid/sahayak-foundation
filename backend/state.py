from typing import TypedDict, Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ==============================================================================
# Pydantic Structured Output Models
# ==============================================================================

class NeedIntent(BaseModel):
    category: str = Field(description="Dominant need category: Education, Agriculture, Housing, Employment & Pension, Women & Child, or General")
    urgency: str = Field(description="Urgency level: low, medium, or high")
    keywords: List[str] = Field(default_factory=list, description="Extracted key topic terms")
    summary: str = Field(description="Brief 1-sentence summary of citizen need")

class SchemeMatchItem(BaseModel):
    id: str = Field(description="Scheme UUID or identifier")
    name: str = Field(description="Official scheme title")
    category: str = Field(description="Category of scheme")
    benefit: str = Field(description="Headline benefit or subsidy")
    match_score: int = Field(description="Confidence match score from 0 to 100")
    reasoning: str = Field(description="Clear justification why this scheme matches citizen profile")

class SchemeRankingResult(BaseModel):
    selected_scheme_id: str = Field(description="Top recommended scheme ID")
    candidate_schemes: List[SchemeMatchItem] = Field(description="Ranked list of matching candidate schemes")
    message: str = Field(description="Summary message for citizen display")

class CriterionEvaluation(BaseModel):
    criterion_name: str = Field(description="Name of rule/criterion")
    citizen_info: str = Field(description="Citizen profile evidence value")
    requirement: str = Field(description="Scheme rule requirement")
    evidence_source: str = Field(description="Document or profile source")
    status: str = Field(description="Evaluation result: verified, missing, or mismatch")
    explanation: str = Field(description="Clear explanation of evaluation")

class EligibilityResult(BaseModel):
    is_eligible: bool = Field(description="True if all mandatory criteria are verified")
    criteria: List[CriterionEvaluation] = Field(description="List of evaluated criteria")
    message: str = Field(description="Summary explanation for the citizen")

class DocumentRequirementCheck(BaseModel):
    missing_documents: List[str] = Field(default_factory=list, description="Names of mandatory documents that are missing or require upload")
    verified_documents: List[str] = Field(default_factory=list, description="Names of verified documents already on file")
    message: str = Field(description="Summary message from document agent")

class ApplicationDraftPayload(BaseModel):
    applicant_name: str = Field(description="Applicant full name")
    applicant_info: Dict[str, Any] = Field(description="Formatted key-value attributes for application form")
    required_attachments: List[str] = Field(description="List of document attachments linked to draft")
    message: str = Field(description="Summary message from application agent")

# ==============================================================================
# LangGraph State Schema
# ==============================================================================

class SahayakState(TypedDict):
    run_id: str
    citizen_id: str
    query: str
    citizen_profile: Dict[str, Any]
    intent: Optional[Dict[str, Any]]
    candidate_schemes: Optional[List[Dict[str, Any]]]
    selected_scheme_id: Optional[str]
    eligibility_result: Optional[Dict[str, Any]]
    missing_documents: Optional[List[str]]
    application_draft: Optional[Dict[str, Any]]
    next_action: Optional[Dict[str, Any]]
    retry_count: int
    error: Optional[str]
