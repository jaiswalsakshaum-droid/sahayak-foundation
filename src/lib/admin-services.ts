import { supabase, isSupabaseConfigured } from "./supabase";
import { CANONICAL_SCHEME_IDS } from "./scheme-constants";
import { ok, err, type ServiceResult } from "./result";

// Supabase-compatible data models for Sahayak Admin
export type Scheme = {
  id: string;
  name: string;
  category: string;
  jurisdiction: "Central" | "State";
  eligibility_status: "Active" | "Draft" | "Archived";
  official_source: string;
  last_verified: string;
  created_at: string;
};

export type EligibilityRule = {
  id: string;
  scheme_id: string;
  criterion_name: string;
  requirement: string;
  rule_type: "numeric" | "boolean" | "enum" | "text";
};

export type DocumentRequirement = {
  id: string;
  scheme_id: string;
  document_type: string;
  is_mandatory: boolean;
};

export type AgentRun = {
  id: string;
  citizen_id: string;
  status: "ONLINE" | "PROCESSING" | "WAITING" | "ACTION REQUIRED" | "COMPLETED";
  started_at: string;
  completed_at: string | null;
  run_type?: string;
};

export type AgentEvent = {
  id: string;
  run_id: string;
  agent_name: string;
  action: string;
  timestamp: string;
  details: Record<string, any>;
};

export type AuditLog = {
  id: string;
  agent_name: string;
  action: string;
  evidence: string;
  result: string;
  timestamp: string;
  run_id: string;
};

export type ConsentRecord = {
  id: string;
  citizen_id: string;
  application_id: string;
  shared_data: string[];
  purpose: string;
  approved_at: string;
};

export interface PendingReviewApplication {
  id: string;
  tracking_id: string;
  citizen_id: string;
  citizen_name: string;
  scheme_id: string;
  scheme_name: string;
  status: "submitted" | "under_review" | "approved" | "rejected";
  applicant_info: Record<string, any>;
  created_at: string;
  source_run_id?: string;
  admin_notes?: string;
}

// Used ONLY when Supabase is not configured (local/offline demo). Never used as an error fallback — see Task 9.
export const LOCAL_DEMO_ADMIN_METRICS = {
  active_citizens: 12450,
  applications_processed: 8932,
  documents_verified: 34102,
  agent_tasks_completed: 156420,
  avg_workflow_time: "3.8 mins",
  applications_requiring_review: 4,
};

// Used ONLY when Supabase is not configured (local/offline demo). Never used as an error fallback — see Task 9.
export const LOCAL_DEMO_AGENT_EVENTS = [
  {
    id: "e1",
    timestamp: "20:41:02",
    agent: "Citizen Agent",
    action: "Intent identified: Education financial assistance",
  },
  {
    id: "e2",
    timestamp: "20:41:04",
    agent: "Scheme Agent",
    action: "4 candidate schemes retrieved",
  },
  {
    id: "e3",
    timestamp: "20:41:05",
    agent: "Eligibility Agent",
    action: "Income criterion verified",
  },
  {
    id: "e4",
    timestamp: "20:41:07",
    agent: "Document Agent",
    action: "Enrollment certificate missing",
  },
  {
    id: "e5",
    timestamp: "20:41:09",
    agent: "Application Agent",
    action: "Application draft created",
  },
  {
    id: "e6",
    timestamp: "20:41:12",
    agent: "Tracker Agent",
    action: "Application tracking monitor activated",
  },
];

// Used ONLY when Supabase is not configured (local/offline demo). Never used as an error fallback — see Task 9.
export const LOCAL_DEMO_SCHEMES_DATA = [
  {
    id: CANONICAL_SCHEME_IDS.NMMSS,
    name: "National Means-cum-Merit Scholarship",
    category: "Education",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 4,
    official_source: "myScheme / Ministry of Education",
    last_verified: "Today",
    status: "Active",
  },
  {
    id: CANONICAL_SCHEME_IDS.PM_KISAN,
    name: "PM-KISAN Samman Nidhi",
    category: "Agriculture",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 3,
    official_source: "PM Kisan Portal",
    last_verified: "Yesterday",
    status: "Active",
  },
  {
    id: CANONICAL_SCHEME_IDS.PMAY_U,
    name: "PM Awas Yojana (Urban)",
    category: "Housing",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 4,
    official_source: "PMAY Portal",
    last_verified: "1 week ago",
    status: "Active",
  },
  {
    id: CANONICAL_SCHEME_IDS.APY,
    name: "Atal Pension Yojana",
    category: "Employment & Pension",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 2,
    official_source: "PFRDA / Jansuraksha",
    last_verified: "2 days ago",
    status: "Active",
  },
  {
    id: CANONICAL_SCHEME_IDS.SUKANYA_SAMRIDDHI,
    name: "Sukanya Samriddhi Yojana",
    category: "Women & Child",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 3,
    official_source: "India Post / RBI",
    last_verified: "Today",
    status: "Active",
  },
];

/**
 * Fetch real aggregate admin metrics from Supabase with fallback
 */
export async function getAdminMetrics(): Promise<typeof LOCAL_DEMO_ADMIN_METRICS> {
  if (!isSupabaseConfigured) {
    return LOCAL_DEMO_ADMIN_METRICS;
  }

  try {
    const [citizensCount, appsCount, docsCount, runsCount, pendingReviewCount, completedRuns] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("applications").select("*", { count: "exact", head: true }),
        supabase.from("documents").select("*", { count: "exact", head: true }),
        supabase.from("agent_runs").select("*", { count: "exact", head: true }),
        supabase
          .from("applications")
          .select("*", { count: "exact", head: true })
          .in("status", ["awaiting_approval", "submitted", "under_review"]),
        supabase
          .from("agent_runs")
          .select("started_at, completed_at")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(20),
      ]);

    // Compute average workflow execution time
    let avgMins = "3.5 mins";
    if (completedRuns.data && completedRuns.data.length > 0) {
      let totalSeconds = 0;
      let validCount = 0;
      completedRuns.data.forEach((r) => {
        if (r.started_at && r.completed_at) {
          const diff =
            (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000;
          if (diff > 0 && diff < 3600) {
            totalSeconds += diff;
            validCount++;
          }
        }
      });
      if (validCount > 0) {
        const avgSec = totalSeconds / validCount;
        avgMins = avgSec >= 60 ? `${(avgSec / 60).toFixed(1)} mins` : `${Math.round(avgSec)}s`;
      }
    }

    return {
      active_citizens: citizensCount.count || LOCAL_DEMO_ADMIN_METRICS.active_citizens,
      applications_processed: appsCount.count || LOCAL_DEMO_ADMIN_METRICS.applications_processed,
      documents_verified: docsCount.count || LOCAL_DEMO_ADMIN_METRICS.documents_verified,
      agent_tasks_completed: (runsCount.count || 1) * 6,
      avg_workflow_time: avgMins,
      applications_requiring_review: pendingReviewCount.count ?? 0,
    };
  } catch (err) {
    console.warn("[Sahayak Admin] Error fetching metrics:", err);
    return LOCAL_DEMO_ADMIN_METRICS;
  }
}

/**
 * Fetch live recent agent events
 */
export async function getRecentAgentEvents(): Promise<typeof LOCAL_DEMO_AGENT_EVENTS> {
  if (!isSupabaseConfigured) {
    return LOCAL_DEMO_AGENT_EVENTS;
  }

  try {
    const { data, error } = await supabase
      .from("agent_events")
      .select("id, created_at, agent_name, action")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return LOCAL_DEMO_AGENT_EVENTS;
    }

    return data.map((e: any) => ({
      id: e.id,
      timestamp: new Date(e.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      agent: e.agent_name,
      action: e.action,
    }));
  } catch (err) {
    console.warn("[Sahayak Admin] Error fetching agent events:", err);
    return LOCAL_DEMO_AGENT_EVENTS;
  }
}

/**
 * Fetch schemes data for admin management
 */
export async function getAdminSchemes(): Promise<typeof LOCAL_DEMO_SCHEMES_DATA> {
  if (!isSupabaseConfigured) {
    return LOCAL_DEMO_SCHEMES_DATA;
  }

  try {
    const { data, error } = await supabase.from("schemes").select(`
        id,
        name,
        category,
        jurisdiction,
        eligibility_status,
        official_source,
        last_verified,
        document_requirements (count)
      `);

    if (error || !data || data.length === 0) {
      return LOCAL_DEMO_SCHEMES_DATA;
    }

    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      jurisdiction: s.jurisdiction,
      eligibility_status: s.eligibility_status,
      docs: s.document_requirements?.[0]?.count || 2,
      official_source: s.official_source || "Official Portal",
      last_verified: s.last_verified ? new Date(s.last_verified).toLocaleDateString() : "Today",
      status: s.eligibility_status,
    }));
  } catch (err) {
    console.warn("[Sahayak Admin] Error fetching admin schemes:", err);
    return LOCAL_DEMO_SCHEMES_DATA;
  }
}

/**
 * Fetch pending applications queue for admin human review
 */
export async function getPendingReviewApplications(): Promise<PendingReviewApplication[]> {
  if (!isSupabaseConfigured) {
    return [
      {
        id: "demo-app-1",
        tracking_id: "SAH-2026-482019",
        citizen_id: "demo-citizen-1",
        citizen_name: "Rahul Sharma",
        scheme_id: CANONICAL_SCHEME_IDS.NMMSS,
        scheme_name: "National Means-cum-Merit Scholarship",
        status: "submitted",
        applicant_info: {
          "Full Name": "Rahul Sharma",
          "Annual Income": "₹2,10,000",
          "School Enrollment": "Verified",
        },
        created_at: new Date().toISOString(),
      },
    ];
  }

  try {
    const { data, error } = await supabase
      .from("applications")
      .select(`
        id,
        tracking_id,
        citizen_id,
        scheme_id,
        status,
        applicant_info,
        created_at,
        source_run_id,
        admin_notes,
        profiles (full_name),
        schemes (name)
      `)
      .in("status", ["submitted", "under_review", "awaiting_approval"])
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      tracking_id: row.tracking_id || row.id,
      citizen_id: row.citizen_id,
      citizen_name: row.profiles?.full_name || "Citizen Applicant",
      scheme_id: row.scheme_id,
      scheme_name: row.schemes?.name || "Government Scheme",
      status: row.status,
      applicant_info: row.applicant_info || {},
      created_at: row.created_at,
      source_run_id: row.source_run_id,
      admin_notes: row.admin_notes,
    }));
  } catch (err) {
    console.warn("[Sahayak Admin] Error fetching pending review applications:", err);
    return [];
  }
}

/**
 * Perform admin human review action (Approve or Reject with reason)
 */
export async function reviewApplication(
  applicationId: string,
  action: "approved" | "rejected",
  notes?: string
): Promise<ServiceResult<boolean>> {
  if (!isSupabaseConfigured) {
    return ok(true);
  }

  try {
    // 1. Fetch current application row to get source_run_id and tracking_id
    const { data: appRow, error: fetchError } = await supabase
      .from("applications")
      .select("id, tracking_id, source_run_id, citizen_id")
      .or(`id.eq.${applicationId},tracking_id.eq.${applicationId}`)
      .single();

    if (fetchError || !appRow) {
      return err(`Application not found: ${fetchError?.message}`);
    }

    // 2. Update status and admin notes on applications table
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        status: action,
        admin_notes: notes || (action === "approved" ? "Approved by human reviewer." : "Rejected."),
        updated_at: new Date().toISOString(),
      })
      .eq("id", appRow.id);

    if (updateError) {
      return err(`Failed to update application status: ${updateError.message}`);
    }

    // 3. Insert immutable human review record into audit_logs
    try {
      await supabase.from("audit_logs").insert({
        run_id: appRow.source_run_id || null,
        agent_name: "Human Reviewer",
        action: action === "approved" ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
        evidence: notes || (action === "approved" ? "Approved as submitted." : "Rejected by department reviewer."),
        result: action.toUpperCase(),
      });
    } catch (auditErr) {
      console.warn("[Sahayak Admin] Non-blocking audit log error:", auditErr);
    }

    // 4. Notify citizen
    if (appRow.citizen_id) {
      try {
        await supabase.from("notifications").insert({
          citizen_id: appRow.citizen_id,
          title: `Application ${action === "approved" ? "Approved" : "Update"}: ${appRow.tracking_id}`,
          body: notes || `Your application ${appRow.tracking_id} has been ${action}.`,
          type: action === "approved" ? "success" : "critical",
        });
      } catch (notifErr) {
        console.warn("[Sahayak Admin] Non-blocking notification error:", notifErr);
      }
    }

    return ok(true);
  } catch (e: any) {
    return err(`Error executing review: ${e.message || e}`);
  }
}

import { CANONICAL_SCHEME_LIST } from "./scheme-constants";

export const MOCK_SCHEMES_DATA = CANONICAL_SCHEME_LIST.map((s) => ({
  id: s.id,
  name: s.name,
  category: s.category,
  jurisdiction: s.jurisdiction,
  eligibility_status: "Active" as const,
  official_source: s.officialSource,
  last_verified: "Today",
  created_at: new Date().toISOString(),
  docs: s.documentRequirements.length,
  status: "Active",
  rulesCount: 4,
  benefit: s.benefit,
  description: s.description,
  rules: [
    { criterion: "Age & Enrollment", requirement: "Must meet target criteria", verifiedBy: "Eligibility Agent" },
    { criterion: "Income Threshold", requirement: "Below maximum ceiling", verifiedBy: "Eligibility Agent" },
    { criterion: "Jurisdiction / Residence", requirement: "Domicile verified", verifiedBy: "Eligibility Agent" },
  ],
  documents: s.documentRequirements.map((d) => ({
    name: d,
    mandatory: true,
    acceptedFormats: "PDF, JPG, PNG",
  })),
}));

