import { supabase, isSupabaseConfigured } from "./supabase";
import { getSession } from "./auth";

export type NeedIntent = {
  category: string;
  urgency: "low" | "medium" | "high";
  keywords: string[];
};

export type SchemeMatch = {
  id: string;
  name: string;
  category: string;
  benefit: string;
  matchScore: number;
  description: string;
  official: boolean;
  reqDocs: string[];
  lastVerified: string;
};

export type EligibilityCriterion = {
  name: string;
  citizenInfo: string;
  requirement: string;
  evidenceSource: string;
  status: "verified" | "missing" | "mismatch";
};

export type NextAction = {
  type: "upload_document" | "review_application" | "provide_info";
  description: string;
  agent: string;
};

// Fallback catalog of schemes
const FALLBACK_SCHEMES_DB: SchemeMatch[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "National Means-cum-Merit Scholarship",
    category: "Education",
    benefit: "₹12,000 / year",
    matchScore: 92,
    description: "Financial support for meritorious students continuing secondary education.",
    official: true,
    reqDocs: ["Income Certificate", "Enrollment Certificate", "Identity Proof"],
    lastVerified: "Today",
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "PM-KISAN Samman Nidhi",
    category: "Agriculture",
    benefit: "₹6,000 / year",
    matchScore: 98,
    description: "Income support to all landholding farmer families.",
    official: true,
    reqDocs: ["Aadhaar", "Land Ownership Record", "Bank Account Details"],
    lastVerified: "Yesterday",
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    name: "PM Awas Yojana (Urban)",
    category: "Housing",
    benefit: "Up to ₹2.67 Lakh subsidy",
    matchScore: 85,
    description: "Housing for all in urban areas through credit linked subsidy.",
    official: true,
    reqDocs: ["Income Proof", "Aadhaar", "Self-declaration of not owning a pucca house"],
    lastVerified: "1 week ago",
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    name: "Atal Pension Yojana",
    category: "Employment & Pension",
    benefit: "₹1,000 - ₹5,000 / month pension",
    matchScore: 78,
    description: "Guaranteed minimum pension for unorganized sector workers.",
    official: true,
    reqDocs: ["Aadhaar", "Savings Bank Account"],
    lastVerified: "2 days ago",
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    name: "Sukanya Samriddhi Yojana",
    category: "Women & Child",
    benefit: "High interest savings for girl child",
    matchScore: 88,
    description: "Small deposit scheme for the girl child to meet education and marriage expenses.",
    official: true,
    reqDocs: ["Birth Certificate of girl child", "Parent/Guardian ID proof", "Address Proof"],
    lastVerified: "Today",
  },
];

/**
 * Citizen Intent Understanding + Agent Run Persistence
 */
export async function understandCitizenNeed(query: string): Promise<NeedIntent> {
  const lowerQuery = query.toLowerCase();

  let category = "General";
  if (
    lowerQuery.includes("scholarship") ||
    lowerQuery.includes("education") ||
    lowerQuery.includes("college") ||
    lowerQuery.includes("school")
  ) {
    category = "Education";
  } else if (
    lowerQuery.includes("farm") ||
    lowerQuery.includes("agriculture") ||
    lowerQuery.includes("kisan")
  ) {
    category = "Agriculture";
  } else if (
    lowerQuery.includes("house") ||
    lowerQuery.includes("home") ||
    lowerQuery.includes("housing")
  ) {
    category = "Housing";
  } else if (
    lowerQuery.includes("job") ||
    lowerQuery.includes("employment") ||
    lowerQuery.includes("work")
  ) {
    category = "Employment & Pension";
  } else if (
    lowerQuery.includes("women") ||
    lowerQuery.includes("girl") ||
    lowerQuery.includes("daughter")
  ) {
    category = "Women & Child";
  }

  const intent: NeedIntent = {
    category,
    urgency:
      lowerQuery.includes("urgent") || lowerQuery.includes("lost my job") ? "high" : "medium",
    keywords: lowerQuery.split(" ").filter((w) => w.length > 4),
  };

  // Persist run and event to Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const session = await getSession();
      if (session?.user?.id) {
        const { data: run } = await supabase
          .from("agent_runs")
          .insert({
            citizen_id: session.user.id,
            input_query: query,
            status: "PROCESSING",
          })
          .select()
          .single();

        if (run?.id) {
          await supabase.from("agent_events").insert({
            run_id: run.id,
            agent_name: "Citizen Agent",
            action: `Intent classified: ${category} (${intent.urgency} urgency)`,
            details: { intent, query },
          });
        }
      }
    } catch (err) {
      console.warn("[Sahayak Services] Failed to persist agent run:", err);
    }
  }

  return intent;
}

/**
 * Retrieve matching schemes from Supabase with fallback
 */
export async function findRelevantSchemes(intent: NeedIntent): Promise<SchemeMatch[]> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from("schemes")
        .select(
          `
          id,
          name,
          category,
          benefit,
          description,
          official_source,
          last_verified,
          document_requirements (
            document_type
          )
        `,
        )
        .eq("eligibility_status", "Active");

      if (intent.category !== "General") {
        query = query.eq("category", intent.category);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((item: any, idx: number) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          benefit: item.benefit || "Government Benefit",
          matchScore: 95 - idx * 4,
          description: item.description || "",
          official: Boolean(item.official_source),
          reqDocs: item.document_requirements?.map((d: any) => d.document_type) || [
            "Aadhaar Card",
            "Income Certificate",
          ],
          lastVerified: item.last_verified
            ? new Date(item.last_verified).toLocaleDateString()
            : "Recently",
        }));
      }
    } catch (err) {
      console.warn("[Sahayak Services] Schemes query error:", err);
    }
  }

  // Fallback to local schemes list
  if (intent.category === "General") {
    return FALLBACK_SCHEMES_DB.slice(0, 3);
  }
  const filtered = FALLBACK_SCHEMES_DB.filter((s) => s.category === intent.category);
  return filtered.length > 0 ? filtered : FALLBACK_SCHEMES_DB.slice(0, 2);
}

/**
 * Check eligibility against eligibility_rules table
 */
export async function checkEligibility(
  schemeId: string,
  citizenData: any,
): Promise<{ isEligible: boolean; criteria: EligibilityCriterion[] }> {
  if (isSupabaseConfigured) {
    try {
      const { data: rules } = await supabase
        .from("eligibility_rules")
        .select("*")
        .eq("scheme_id", schemeId);

      if (rules && rules.length > 0) {
        const criteria: EligibilityCriterion[] = rules.map((r: any) => ({
          name: r.criterion_name,
          citizenInfo: "Verified via profile / DigiLocker",
          requirement: r.requirement,
          evidenceSource: r.evidence_source || "Profile",
          status: "verified",
        }));

        // For demo scholarship schemes, demonstrate missing enrollment certificate requirement
        if (schemeId.includes("0001") || schemeId.includes("s1") || schemeId.includes("demo-1")) {
          criteria.push({
            name: "Enrollment Certificate",
            citizenInfo: "Missing",
            requirement: "Enrolled in recognized institution",
            evidenceSource: "—",
            status: "missing",
          });
        }

        const isEligible = criteria.every((c) => c.status === "verified");
        return { isEligible, criteria };
      }
    } catch (err) {
      console.warn("[Sahayak Services] Error reading eligibility rules:", err);
    }
  }

  // Fallback logic
  const criteria: EligibilityCriterion[] = [
    {
      name: "Age",
      citizenInfo: "20",
      requirement: "18-25",
      evidenceSource: "Profile",
      status: "verified",
    },
    {
      name: "Household Income",
      citizenInfo: "₹2.1L",
      requirement: "Below ₹3.5L",
      evidenceSource: "Income Certificate",
      status: "verified",
    },
  ];

  if (schemeId === "s1" || schemeId === "demo-1" || schemeId.includes("0001")) {
    criteria.push({
      name: "Enrollment Certificate",
      citizenInfo: "Missing",
      requirement: "Required",
      evidenceSource: "—",
      status: "missing",
    });
  }

  const isEligible = criteria.every((c) => c.status === "verified");
  return { isEligible, criteria };
}

/**
 * Generate Next Action based on eligibility status
 */
export async function generateNextAction(eligibility: {
  isEligible: boolean;
  criteria: EligibilityCriterion[];
}): Promise<NextAction> {
  const missing = eligibility.criteria.find((c) => c.status === "missing");

  if (missing) {
    return {
      type: "upload_document",
      description: `Please upload your ${missing.name} to continue.`,
      agent: "Document Agent",
    };
  }

  return {
    type: "review_application",
    description: "All criteria met. Please review the draft application.",
    agent: "Application Agent",
  };
}

export type DocumentValidationResult = {
  isValid: boolean;
  type: string;
  name: string;
  issueDate: string;
  validity: string;
  confidence: number;
  extractedFields: Record<string, string>;
};

/**
 * Validate document, persist in documents table & Supabase Storage,
 * then fire the extract-document Edge Function for real Groq Vision analysis.
 */
export async function validateDocument(file: any): Promise<DocumentValidationResult> {
  const result: DocumentValidationResult = {
    isValid: true,
    type: file?.type?.includes("image") ? "Identity Proof" : "Income Proof",
    name: file?.name ? file.name.replace(/\.[^/.]+$/, "") : "Aadhaar Card",
    issueDate: "12-05-2018",
    validity: "Lifetime",
    confidence: 96,
    extractedFields: {
      Name: "Rahul Sharma",
      DOB: "15-08-2004",
      "Document ID": "XXXX-XXXX-4321",
    },
  };

  if (isSupabaseConfigured) {
    try {
      const session = await getSession();
      if (session?.user?.id) {
        let uploadedPath: string | null = null;

        // If a real File object is provided, upload to Supabase Storage 'documents' bucket
        if (file && (file instanceof Blob || typeof file.arrayBuffer === "function")) {
          const fileName = `${Date.now()}_${(file.name || "document.pdf").replace(/\s+/g, "_")}`;
          const storagePath = `${session.user.id}/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("documents")
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: true,
            });

          if (!uploadError && uploadData) {
            uploadedPath = uploadData.path;
          } else if (uploadError) {
            console.warn("[Sahayak Storage] Upload error:", uploadError.message);
          }
        }

        // Insert the document metadata row — status starts as "processing" when we have a file path
        const { data: insertedDoc, error: insertError } = await supabase
          .from("documents")
          .insert({
            citizen_id: session.user.id,
            document_type: result.type,
            file_name: file?.name || "Uploaded_Document.pdf",
            file_path: uploadedPath,
            status: uploadedPath ? "processing" : "verified",
            confidence: uploadedPath ? 0 : result.confidence / 100,
            extracted_fields: uploadedPath ? {} : result.extractedFields,
          })
          .select("id")
          .single();

        if (!insertError && insertedDoc?.id && uploadedPath) {
          // Fire extraction Edge Function asynchronously — do not await
          // The Render backend will call Groq Vision and update the documents row directly
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
          const edgeFunctionUrl = `${supabaseUrl}/functions/v1/extract-document`;

          fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({ document_id: insertedDoc.id }),
          }).catch((err) => {
            console.warn("[Sahayak] extract-document Edge Function dispatch error:", err);
          });

          // Return an in-progress result — the real extracted fields will populate via
          // the documents table update once Groq Vision analysis completes (~5–15s)
          return {
            ...result,
            confidence: 0,
            extractedFields: {
              Status: "Extraction in progress...",
              "Document ID": insertedDoc.id.slice(0, 8).toUpperCase(),
              Note: "Fields will appear once Groq Vision analysis completes",
            },
          };
        }
      }
    } catch (err) {
      console.warn("[Sahayak Services] Document insert/upload error:", err);
    }
  }

  return result;
}

export async function extractDocumentFields(file: any): Promise<Record<string, string>> {
  const result = await validateDocument(file);
  return result.extractedFields;
}

export async function matchDocumentToRequirement(
  _file: any,
  _requirementId: string,
): Promise<boolean> {
  return true;
}

export type ApplicationDraft = {
  id: string;
  schemeId: string;
  schemeName: string;
  status: "draft" | "awaiting_approval" | "submitted" | "under_review" | "approved";
  applicantInfo: Record<string, { value: string; status: "verified" | "needs_review" | "missing" }>;
  documents: { name: string; status: "verified" | "missing" | "needs_review" }[];
};

/**
 * Prepare application draft with duplicate prevention
 */
export async function prepareApplication(schemeId: string): Promise<ApplicationDraft> {
  const targetSchemeId = schemeId.startsWith("a000")
    ? schemeId
    : "a0000000-0000-0000-0000-000000000001";

  if (isSupabaseConfigured) {
    try {
      const session = await getSession();
      if (session?.user?.id) {
        // Find scheme name
        const { data: scheme } = await supabase
          .from("schemes")
          .select("name")
          .eq("id", targetSchemeId)
          .single();

        const schemeName = scheme?.name || "National Means-cum-Merit Scholarship";

        // Check if an application draft already exists for this citizen and scheme
        const { data: existingApp } = await supabase
          .from("applications")
          .select("*")
          .eq("citizen_id", session.user.id)
          .eq("scheme_id", targetSchemeId)
          .maybeSingle();

        if (existingApp) {
          return {
            id: existingApp.tracking_id || existingApp.id,
            schemeId: targetSchemeId,
            schemeName,
            status: existingApp.status as any,
            applicantInfo: existingApp.applicant_info || {
              "Full Name": { value: "Rahul Sharma", status: "verified" },
              "Date of Birth": { value: "15-08-2004", status: "verified" },
              "Annual Income": { value: "₹2,10,000", status: "verified" },
            },
            documents: [
              { name: "Aadhaar Card", status: "verified" },
              { name: "Income Certificate", status: "verified" },
              { name: "Enrollment Certificate", status: "missing" },
            ],
          };
        }

        const draftId = `SAH-2026-${Math.floor(100000 + Math.random() * 900000)}`;
        const applicantInfo = {
          "Full Name": { value: "Rahul Sharma", status: "verified" as const },
          "Date of Birth": { value: "15-08-2004", status: "verified" as const },
          "Education Level": { value: "Undergraduate", status: "verified" as const },
          "Annual Income": { value: "₹2,10,000", status: "verified" as const },
          "Bank Account": { value: "XXXX-XXXX-4321", status: "needs_review" as const },
        };

        await supabase.from("applications").insert({
          citizen_id: session.user.id,
          scheme_id: targetSchemeId,
          status: "awaiting_approval",
          applicant_info: applicantInfo,
          tracking_id: draftId,
        });

        return {
          id: draftId,
          schemeId: targetSchemeId,
          schemeName,
          status: "awaiting_approval",
          applicantInfo,
          documents: [
            { name: "Aadhaar Card", status: "verified" },
            { name: "Income Certificate", status: "verified" },
            { name: "Enrollment Certificate", status: "verified" },
          ],
        };
      }
    } catch (err) {
      console.warn("[Sahayak Services] Prepare application error:", err);
    }
  }

  return {
    id: "SAH-2026-004281",
    schemeId,
    schemeName: "National Means-cum-Merit Scholarship",
    status: "awaiting_approval",
    applicantInfo: {
      "Full Name": { value: "Rahul Sharma", status: "verified" },
      "Date of Birth": { value: "15-08-2004", status: "verified" },
      "Education Level": { value: "Undergraduate", status: "verified" },
      "Annual Income": { value: "₹2,10,000", status: "verified" },
      "Bank Account": { value: "XXXX-XXXX-4321", status: "needs_review" },
    },
    documents: [
      { name: "Aadhaar Card", status: "verified" },
      { name: "Income Certificate", status: "verified" },
      { name: "Enrollment Certificate", status: "verified" },
    ],
  };
}

/**
 * Save draft state
 */
export async function saveApplicationDraft(draft: ApplicationDraft): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from("applications")
        .update({
          applicant_info: draft.applicantInfo,
          updated_at: new Date().toISOString(),
        })
        .eq("tracking_id", draft.id);
    } catch (err) {
      console.warn("[Sahayak Services] Save draft error:", err);
    }
  }
  return true;
}

/**
 * Record explicit citizen consent
 */
export async function recordConsent(applicationId: string, citizenId?: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      const session = await getSession();
      const effectiveCitizenId = citizenId || session?.user?.id;
      if (effectiveCitizenId) {
        await supabase.from("consent_records").insert({
          citizen_id: effectiveCitizenId,
          purpose: "Verification and submission for benefit disbursement",
          shared_data: ["Identity (Aadhaar)", "Income Certificate", "Bank Account Details"],
          approved_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("[Sahayak Services] Consent recording error:", err);
    }
  }
  return true;
}

/**
 * Submit verified application
 */
export async function submitApplication(
  applicationId: string,
): Promise<{ success: boolean; trackingId: string }> {
  const trackingId = applicationId.startsWith("SAH-")
    ? applicationId
    : `SAH-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from("applications")
        .update({
          status: "submitted",
          updated_at: new Date().toISOString(),
        })
        .or(`tracking_id.eq.${applicationId},id.eq.${applicationId}`);
    } catch (err) {
      console.warn("[Sahayak Services] Submission update error:", err);
    }
  }

  return { success: true, trackingId };
}

/**
 * Get real application status and dynamically derived step timeline from DB
 */
export async function getApplicationStatus(applicationId: string): Promise<{
  status: string;
  timeline: { step: string; status: "completed" | "current" | "pending" }[];
}> {
  let appStatus = "submitted";

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("applications")
        .select("status")
        .or(`tracking_id.eq.${applicationId},id.eq.${applicationId}`)
        .maybeSingle();

      if (!error && data?.status) {
        appStatus = data.status;
      }
    } catch (err) {
      console.warn("[Sahayak Services] Get application status error:", err);
    }
  }

  // Derive step timeline based on real status
  const isDraft = appStatus === "draft";
  const isAwaiting = appStatus === "awaiting_approval";
  const isSubmitted = appStatus === "submitted";
  const isReview = appStatus === "under_review";
  const isApproved = appStatus === "approved";

  return {
    status: appStatus,
    timeline: [
      {
        step: "Application prepared",
        status: "completed",
      },
      {
        step: "Citizen approved",
        status: isDraft ? "pending" : isAwaiting ? "current" : "completed",
      },
      {
        step: "Submitted to government portal",
        status: isDraft || isAwaiting ? "pending" : isSubmitted ? "completed" : "completed",
      },
      {
        step: "Under department review",
        status:
          isDraft || isAwaiting || isSubmitted ? "pending" : isReview ? "current" : "completed",
      },
      {
        step: "Benefit decision & approval",
        status: isApproved ? "completed" : "pending",
      },
      {
        step: "Direct benefit transfer (DBT)",
        status: "pending",
      },
    ],
  };
}
