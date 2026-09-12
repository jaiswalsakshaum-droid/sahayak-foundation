"""
document_extractor.py — Real Vision AI extraction using Google Gemini Flash.

Flow:
  1. Fetch document metadata + file from Supabase Storage
  2. Determine file type (image vs PDF)
  3. Send to Gemini Flash (gemini-3.6-flash) multimodal vision
  4. Parse structured JSON response
  5. Validate extracted document_type vs citizen-selected type → flag mismatch
  6. Persist real results to Supabase documents table

No fake fallback data. If extraction fails, the document is marked
"extraction_failed" with an honest error message.
"""

import os
import io
import json
import logging
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()
logger = logging.getLogger("sahayak.document_extractor")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SUPABASE_URL              = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
GOOGLE_API_KEY            = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL              = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

# ---------------------------------------------------------------------------
# Supabase client
# ---------------------------------------------------------------------------
supabase_admin: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase client: {e}")

# ---------------------------------------------------------------------------
# Document type normalisation helpers
# ---------------------------------------------------------------------------
CANONICAL_DOC_TYPES = {
    "aadhaar": "Aadhaar Card",
    "uidai":   "Aadhaar Card",
    "pan":     "PAN Card",
    "income":  "Income Certificate",
    "residence": "Residence Proof",
    "address": "Residence Proof",
    "caste":   "Caste Certificate",
    "birth":   "Birth Certificate",
    "bank":    "Bank Passbook",
    "passbook": "Bank Passbook",
    "disability": "Disability Certificate",
    "land":    "Land Record",
    "ror":     "Land Record",
    "enrollment": "Enrollment Certificate",
}

def _normalise_type(raw_type: str) -> str:
    lower = (raw_type or "").lower()
    for key, canonical in CANONICAL_DOC_TYPES.items():
        if key in lower:
            return canonical
    return raw_type

def _types_match(extracted_type: str, hint_type: str) -> bool:
    norm_e = _normalise_type(extracted_type).lower()
    norm_h = _normalise_type(hint_type).lower()
    return norm_e == norm_h or norm_e in norm_h or norm_h in norm_e

# ---------------------------------------------------------------------------
# PDF helpers
# ---------------------------------------------------------------------------
def _extract_pdf_text(pdf_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            return ""
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        logger.warning(f"PDF text extraction failed: {e}")
        return ""

def _pdf_embedded_image(pdf_bytes: bytes) -> Optional[bytes]:
    """Try to extract the first embedded image from a scanned PDF page."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if reader.is_encrypted:
            return None
        page = reader.pages[0]
        resources = page.get("/Resources")
        if resources and "/XObject" in resources:
            xobjects = resources["/XObject"].get_object()
            for obj in xobjects.values():
                obj = obj.get_object()
                if obj.get("/Subtype") == "/Image":
                    data = obj.get_data()
                    if data:
                        return data
    except Exception as e:
        logger.warning(f"PDF embedded image extraction failed: {e}")
    return None

# ---------------------------------------------------------------------------
# Gemini extraction prompt
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT = """You are a Government Document Intelligence AI for Sahayak (India).
Examine the provided document image or text and extract information as structured JSON.

STRICT RULES:
1. Only report fields you can actually read in the document. Use null for unreadable fields.
2. Do NOT guess, invent, or hallucinate any values. If a field is not clearly visible, return null.
3. Determine document_type from the document content itself.
4. Return ONLY valid JSON — no markdown code fences, no explanation.

JSON schema to return:
{
  "document_type": "Aadhaar Card|PAN Card|Income Certificate|Residence Proof|Caste Certificate|Birth Certificate|Bank Passbook|Disability Certificate|Land Record|Enrollment Certificate|Other",
  "applicant_name": "<Full name as printed, or null>",
  "id_number": "<Primary ID/certificate number, or null>",
  "dob": "<DD-MM-YYYY if visible, or null>",
  "father_name": "<Father's name if printed, or null>",
  "address": "<Address if printed, or null>",
  "income_amount": <integer INR amount if income cert, or null>,
  "issue_date": "<Issue date YYYY-MM-DD if visible, or null>",
  "issuing_authority": "<Authority name that issued this document, or null>",
  "confidence": <float 0.0-1.0 reflecting how clearly you can read the document>,
  "is_valid": <boolean: true if document appears genuine and readable>,
  "summary": "<One sentence describing what you extracted from this document>"
}"""

# ---------------------------------------------------------------------------
# Main extraction entry point
# ---------------------------------------------------------------------------
def extract_document_data(document_id: str) -> Dict[str, Any]:
    """
    Downloads file from Supabase Storage, runs Gemini Flash vision extraction,
    validates type match, and updates the documents table.
    """
    if not supabase_admin:
        raise ValueError("Supabase client is not configured")

    # 1. Fetch document metadata
    doc_res = (
        supabase_admin.table("documents")
        .select("*")
        .eq("id", document_id)
        .maybe_single()
        .execute()
    )
    if not doc_res.data:
        raise ValueError(f"Document {document_id} not found")

    doc_record    = doc_res.data
    file_path     = doc_record.get("file_path")
    doc_type_hint = doc_record.get("document_type", "Government Document")

    logger.info(f"[{document_id}] Extracting: file={file_path}, type_hint={doc_type_hint}")

    # 2. Download file bytes
    file_bytes: Optional[bytes] = None
    if file_path:
        try:
            file_bytes = supabase_admin.storage.from_("documents").download(file_path)
            logger.info(f"[{document_id}] Downloaded {len(file_bytes)} bytes")
        except Exception as e:
            logger.error(f"[{document_id}] Storage download failed: {e}")

    if not file_bytes:
        _update_document(document_id, {
            "extraction_error": "No file found in storage. Please re-upload the document.",
            "document_type": doc_type_hint,
            "confidence": 0.0, "is_valid": False,
        }, confidence=0.0, status="extraction_failed")
        return {"error": "No file in storage"}

    # 3. Check for Google API key
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == "YOUR_GOOGLE_AI_API_KEY_HERE":
        err_msg = (
            "GOOGLE_API_KEY is not configured. "
            "Get a free key at https://aistudio.google.com/apikey and add it to backend/.env"
        )
        logger.error(f"[{document_id}] {err_msg}")
        _update_document(document_id, {
            "extraction_error": err_msg,
            "document_type": doc_type_hint,
            "confidence": 0.0, "is_valid": False,
        }, confidence=0.0, status="extraction_failed")
        return {"error": err_msg}

    # 4. Determine file type and build content list for Gemini
    ext = (file_path.rsplit(".", 1)[-1] if "." in file_path else "jpg").lower()
    is_pdf = ext == "pdf"

    content_parts: list = [EXTRACTION_PROMPT]

    from google import genai
    from google.genai import types as gtypes

    if is_pdf:
        pdf_text = _extract_pdf_text(file_bytes)
        if pdf_text:
            logger.info(f"[{document_id}] Sending PDF text ({len(pdf_text)} chars) to Gemini")
            content_parts.append(f"\nDocument text extracted from PDF:\n\n{pdf_text[:8000]}")
        else:
            # Try embedded image first
            img_bytes = _pdf_embedded_image(file_bytes)
            if img_bytes:
                logger.info(f"[{document_id}] Sending embedded PDF image ({len(img_bytes)} bytes)")
                content_parts.append(gtypes.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"))
            else:
                # Send raw PDF bytes to Gemini (it supports PDF natively)
                logger.info(f"[{document_id}] Sending raw PDF ({len(file_bytes)} bytes) to Gemini")
                content_parts.append(gtypes.Part.from_bytes(data=file_bytes, mime_type="application/pdf"))
    else:
        mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
        mime_type = mime_map.get(ext, "image/jpeg")
        logger.info(f"[{document_id}] Sending image ({mime_type}, {len(file_bytes)} bytes) to Gemini")
        content_parts.append(gtypes.Part.from_bytes(data=file_bytes, mime_type=mime_type))

    # 5. Call Gemini Flash
    extracted_payload: Optional[Dict[str, Any]] = None
    extraction_error: Optional[str] = None

    candidate_models = [GEMINI_MODEL, "gemini-3.6-flash", "gemini-2.5-flash", "gemini-1.5-flash"]
    models_to_try = []
    for m in candidate_models:
        if m and m not in models_to_try:
            models_to_try.append(m)

    try:
        client = genai.Client(api_key=GOOGLE_API_KEY)
        last_ex = None
        for model_candidate in models_to_try:
            try:
                logger.info(f"[{document_id}] Calling Gemini with model={model_candidate}")
                response = client.models.generate_content(
                    model=model_candidate,
                    contents=content_parts,
                    config=gtypes.GenerateContentConfig(
                        temperature=0.05,
                        response_mime_type="application/json",
                    ),
                )
                raw_text = (response.text or "").strip()
                # Strip potential markdown code fences just in case
                if raw_text.startswith("```"):
                    parts = raw_text.split("```")
                    raw_text = parts[1] if len(parts) > 1 else raw_text
                    if raw_text.startswith("json"):
                        raw_text = raw_text[4:]
                    raw_text = raw_text.strip()

                extracted_payload = json.loads(raw_text)
                logger.info(
                    f"[{document_id}] Gemini ({model_candidate}) extracted: "
                    f"type={extracted_payload.get('document_type')}, "
                    f"name={extracted_payload.get('applicant_name')}, "
                    f"confidence={extracted_payload.get('confidence')}"
                )
                last_ex = None
                break
            except Exception as ex:
                last_ex = ex
                logger.warning(f"[{document_id}] Model {model_candidate} failed: {ex}")
                continue

        if not extracted_payload and last_ex:
            raise last_ex
    except json.JSONDecodeError as e:
        extraction_error = f"AI returned unparseable response: {e}"
        logger.error(f"[{document_id}] JSON parse error: {e}")
    except Exception as e:
        extraction_error = f"Vision extraction failed: {str(e)[:250]}"
        logger.error(f"[{document_id}] Gemini error: {type(e).__name__}: {e}")

    # 6. Handle extraction failure — honest error, no fake data
    if not extracted_payload:
        error_fields = {
            "extraction_error": extraction_error or "Unknown error during vision extraction",
            "document_type": doc_type_hint,
            "confidence": 0.0, "is_valid": False,
            "summary": "Extraction failed. Please re-upload a clearer image or PDF.",
        }
        _update_document(document_id, error_fields, confidence=0.0, status="extraction_failed")
        return error_fields

    # 7. Document type mismatch detection
    extracted_type = extracted_payload.get("document_type", "")
    if extracted_type and doc_type_hint and not _types_match(extracted_type, doc_type_hint):
        logger.warning(
            f"[{document_id}] TYPE MISMATCH: selected='{doc_type_hint}', detected='{extracted_type}'"
        )
        extracted_payload["type_mismatch"] = True
        extracted_payload["type_mismatch_detail"] = (
            f"You selected '{doc_type_hint}' but this document appears to be a '{extracted_type}'. "
            f"Please re-upload the correct document."
        )
        # Force low confidence to trigger needs_review
        extracted_payload["confidence"] = min(float(extracted_payload.get("confidence", 0.5)), 0.4)

    # 8. Determine final status
    confidence  = float(extracted_payload.get("confidence", 0.0))
    is_valid    = bool(extracted_payload.get("is_valid", False))
    has_mismatch = extracted_payload.get("type_mismatch", False)

    if has_mismatch:
        new_status = "needs_review"
    elif confidence >= 0.70 and is_valid:
        new_status = "verified"
    else:
        new_status = "needs_review"

    canonical_type = _normalise_type(extracted_type or doc_type_hint)
    extracted_payload["document_type"] = canonical_type

    _update_document(document_id, extracted_payload, confidence=confidence,
                     status=new_status, canonical_type=canonical_type)
    return extracted_payload


def _update_document(
    document_id: str,
    extracted_fields: Dict[str, Any],
    confidence: float,
    status: str,
    canonical_type: Optional[str] = None,
) -> None:
    """Persist extraction results to the documents table."""
    if not supabase_admin:
        return
    update_payload: Dict[str, Any] = {
        "extracted_fields": extracted_fields,
        "confidence":       confidence,
        "status":           status,
    }
    if canonical_type:
        update_payload["document_type"] = canonical_type
    try:
        supabase_admin.table("documents").update(update_payload).eq("id", document_id).execute()
        logger.info(f"[{document_id}] Updated → status={status}, confidence={confidence:.2f}")
    except Exception as e:
        logger.error(f"[{document_id}] DB update failed: {e}")
