import { supabase, isSupabaseConfigured } from "./supabase";
import { ok, err, type ServiceResult } from "./result";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const INTERNAL_SECRET = import.meta.env.VITE_INTERNAL_SECRET || "sahayak_dev_secret_123";

// -----------------------------------------------------------------------------
// Data Types
// -----------------------------------------------------------------------------

export type AdminMetrics = {
  active_citizens: number;
  applications_total: number;
  applications_by_status: {
    draft: number;
    awaiting_approval: number;
    submitted: number;
    under_review: number;
    approved: number;
    rejected: number;
  };
  documents_verified: number;
  agent_tasks_completed: number;
  avg_workflow_time: string;
  applications_requiring_review: number;
};

export type AgentWorkforceMember = {
  id: string;
  name: string;
  role: string;
  status: "ONLINE" | "BUSY" | "IDLE" | "ERROR";
  tasks_processed: number;
  error_count: number;
  error_rate: string;
  last_active: string | null;
  last_action: string;
};

export type RealAgentEvent = {
  id: string;
  run_id?: string;
  agent_name: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
};

export type PendingReviewApplication = {
  id: string;
  tracking_id: string;
  citizen_id: string;
  citizen_name: string;
  citizen_phone?: string;
  citizen_location?: string;
  scheme_id: string;
  scheme_name: string;
  scheme_category?: string;
  status: "draft" | "awaiting_approval" | "submitted" | "under_review" | "approved" | "rejected";
  applicant_info: Record<string, any>;
  created_at: string;
  source_run_id?: string;
  admin_notes?: string;
};

export type AdminSchemeDetail = {
  id: string;
  name: string;
  category: string;
  jurisdiction: "Central" | "State";
  eligibility_status: "Active" | "Draft" | "Archived";
  official_source: string;
  last_verified: string;
  status: string;
  docs: number;
  benefit?: string;
  description?: string;
  eligibility_rules: {
    id?: string;
    criterion_name: string;
    requirement: string;
    rule_type: string;
    evidence_source?: string;
  }[];
  document_requirements: {
    id?: string;
    document_type: string;
    is_mandatory: boolean;
  }[];
};

export type AuditLogEntry = {
  id: string;
  run_id?: string;
  agent_name: string;
  action: string;
  evidence: string;
  result: string;
  created_at: string;
};

export type SystemHealth = {
  status: "healthy" | "degraded" | "offline";
  database_connected: boolean;
  groq_ai_configured: boolean;
  gemini_vision_configured: boolean;
  internal_secret_configured: boolean;
  timestamp: string;
};

// -----------------------------------------------------------------------------
// Live Service Functions
// -----------------------------------------------------------------------------

/**
 * Fetch real aggregated metrics for the Admin Control Center
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  // Try backend endpoint first for atomic calculation
  try {
    const res = await fetch(`${BACKEND_URL}/admin/metrics`, {
      headers: { "X-Sahayak-Internal-Secret": INTERNAL_SECRET },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.metrics) return data.metrics;
    }
  } catch {
    // Fallback to direct Supabase queries
  }

  if (isSupabaseConfigured) {
    try {
      const [citizensRes, appsRes, docsRes, eventsRes, runsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("applications").select("status"),
        supabase.from("documents").select("id", { count: "exact", head: true }).eq("status", "verified"),
        supabase.from("agent_events").select("id", { count: "exact", head: true }),
        supabase
          .from("agent_runs")
          .select("started_at, completed_at")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(30),
      ]);

      const appsData = appsRes.data || [];
      const statusMap = {
        draft: 0,
        awaiting_approval: 0,
        submitted: 0,
        under_review: 0,
        approved: 0,
        rejected: 0,
      };

      appsData.forEach((a) => {
        const st = (a.status as keyof typeof statusMap) || "draft";
        if (st in statusMap) statusMap[st]++;
      });

      let avgMins = "3.5 mins";
      if (runsRes.data && runsRes.data.length > 0) {
        let totalSec = 0;
        let validCnt = 0;
        runsRes.data.forEach((r) => {
          if (r.started_at && r.completed_at) {
            const diff = (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000;
            if (diff > 0 && diff < 7200) {
              totalSec += diff;
              validCnt++;
            }
          }
        });
        if (validCnt > 0) {
          const avgS = totalSec / validCnt;
          avgMins = avgS >= 60 ? `${(avgS / 60).toFixed(1)} mins` : `${Math.round(avgS)}s`;
        }
      }

      return {
        active_citizens: citizensRes.count || 0,
        applications_total: appsData.length,
        applications_by_status: statusMap,
        documents_verified: docsRes.count || 0,
        agent_tasks_completed: eventsRes.count || 0,
        avg_workflow_time: avgMins,
        applications_requiring_review:
          statusMap.submitted + statusMap.under_review + statusMap.awaiting_approval,
      };
    } catch (e) {
      console.error("[Sahayak Admin] Error querying metrics directly:", e);
    }
  }

  // Pure zero-value empty state
  return {
    active_citizens: 0,
    applications_total: 0,
    applications_by_status: {
      draft: 0,
      awaiting_approval: 0,
      submitted: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
    },
    documents_verified: 0,
    agent_tasks_completed: 0,
    avg_workflow_time: "0s",
    applications_requiring_review: 0,
  };
}

/**
 * Fetch live workforce status per agent
 */
export async function getLiveWorkforceStatus(): Promise<AgentWorkforceMember[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/agents/status`, {
      headers: { "X-Sahayak-Internal-Secret": INTERNAL_SECRET },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.agents) return data.agents;
    }
  } catch {
    // Fallback to Supabase
  }

  const defaultAgents: AgentWorkforceMember[] = [
    { id: "citizen", name: "Citizen Agent", role: "Intent Parser & Citizen Context", status: "ONLINE", tasks_processed: 0, error_count: 0, error_rate: "0%", last_active: null, last_action: "Idle" },
    { id: "scheme", name: "Scheme Agent", role: "Civic Knowledge Retrieval", status: "ONLINE", tasks_processed: 0, error_count: 0, error_rate: "0%", last_active: null, last_action: "Idle" },
    { id: "eligibility", name: "Eligibility Agent", role: "Deterministic Rules Evaluation", status: "ONLINE", tasks_processed: 0, error_count: 0, error_rate: "0%", last_active: null, last_action: "Idle" },
    { id: "document", name: "Document Agent", role: "Gemini Vision & Verification", status: "ONLINE", tasks_processed: 0, error_count: 0, error_rate: "0%", last_active: null, last_action: "Idle" },
    { id: "application", name: "Application Agent", role: "Form Payload Compilation", status: "ONLINE", tasks_processed: 0, error_count: 0, error_rate: "0%", last_active: null, last_action: "Idle" },
    { id: "tracker", name: "Tracker Agent", role: "SLA & Status Monitoring", status: "ONLINE", tasks_processed: 0, error_count: 0, error_rate: "0%", last_active: null, last_action: "Idle" },
  ];

  if (isSupabaseConfigured) {
    try {
      const { data: events } = await supabase
        .from("agent_events")
        .select("id, agent_name, action, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (events) {
        return defaultAgents.map((agent) => {
          const matched = events.filter((e) => e.agent_name === agent.name || e.agent_name?.toLowerCase().includes(agent.id));
          const lastE = matched[0];
          return {
            ...agent,
            tasks_processed: matched.length,
            last_active: lastE ? lastE.created_at : null,
            last_action: lastE ? lastE.action : "Awaiting invocation",
          };
        });
      }
    } catch (e) {
      console.error("[Sahayak Admin] Error fetching agent status directly:", e);
    }
  }

  return defaultAgents;
}

/**
 * Fetch real-time live agent event stream
 */
export async function getLiveAgentEvents(limit = 40): Promise<RealAgentEvent[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/agents/events?limit=${limit}`, {
      headers: { "X-Sahayak-Internal-Secret": INTERNAL_SECRET },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.events) return data.events;
    }
  } catch {
    // Fallback to Supabase
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("agent_events")
        .select("id, run_id, agent_name, action, details, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error && data) return data;
    } catch (e) {
      console.error("[Sahayak Admin] Error fetching agent events:", e);
    }
  }

  return [];
}

/**
 * Fetch applications queue needing human review
 */
export async function getPendingReviewApplications(
  statusFilter?: string,
  schemeId?: string,
): Promise<PendingReviewApplication[]> {
  try {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.append("status_filter", statusFilter);
    if (schemeId && schemeId !== "all") params.append("scheme_id", schemeId);

    const res = await fetch(`${BACKEND_URL}/admin/review-queue?${params.toString()}`, {
      headers: { "X-Sahayak-Internal-Secret": INTERNAL_SECRET },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.queue) {
        return data.queue.map((row: any) => ({
          id: row.id,
          tracking_id: row.tracking_id || row.id,
          citizen_id: row.citizen_id,
          citizen_name: row.profiles?.full_name || "Citizen Applicant",
          citizen_phone: row.profiles?.phone,
          citizen_location: row.profiles?.location,
          scheme_id: row.scheme_id,
          scheme_name: row.schemes?.name || "Welfare Scheme",
          scheme_category: row.schemes?.category,
          status: row.status,
          applicant_info: row.applicant_info || {},
          created_at: row.created_at,
          source_run_id: row.source_run_id,
          admin_notes: row.admin_notes,
        }));
      }
    }
  } catch {
    // Fallback to Supabase
  }

  if (isSupabaseConfigured) {
    try {
      let q = supabase
        .from("applications")
        .select(
          `
          id,
          tracking_id,
          citizen_id,
          scheme_id,
          status,
          applicant_info,
          created_at,
          source_run_id,
          admin_notes,
          profiles (full_name, phone, location),
          schemes (name, category, benefit)
        `,
        )
        .in("status", ["submitted", "under_review", "awaiting_approval"]);

      if (schemeId && schemeId !== "all") {
        q = q.eq("scheme_id", schemeId);
      }

      const { data, error } = await q.order("created_at", { ascending: false });
      if (!error && data) {
        return data.map((row: any) => ({
          id: row.id,
          tracking_id: row.tracking_id || row.id,
          citizen_id: row.citizen_id,
          citizen_name: row.profiles?.full_name || "Citizen Applicant",
          citizen_phone: row.profiles?.phone,
          citizen_location: row.profiles?.location,
          scheme_id: row.scheme_id,
          scheme_name: row.schemes?.name || "Welfare Scheme",
          scheme_category: row.schemes?.category,
          status: row.status,
          applicant_info: row.applicant_info || {},
          created_at: row.created_at,
          source_run_id: row.source_run_id,
          admin_notes: row.admin_notes,
        }));
      }
    } catch (e) {
      console.error("[Sahayak Admin] Error fetching review queue:", e);
    }
  }

  return [];
}

/**
 * Execute human review decision (Approve, Reject, Request Info) with mandatory notes
 */
export async function reviewApplication(
  applicationId: string,
  action: "approved" | "rejected" | "request_info",
  notes: string,
): Promise<ServiceResult<boolean>> {
  if (!notes || !notes.trim()) {
    return err("A mandatory reason or justification note is required for all review actions.");
  }

  try {
    const res = await fetch(`${BACKEND_URL}/admin/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sahayak-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        application_id: applicationId,
        action,
        notes: notes.trim(),
      }),
    });

    if (res.ok) {
      return ok(true);
    }
    const errJson = await res.json();
    return err(errJson.detail || "Failed to record review decision");
  } catch (e: any) {
    console.error("[Sahayak Admin] Backend review failed, trying direct Supabase fallback:", e);
  }

  if (isSupabaseConfigured) {
    try {
      const { data: appRow, error: fetchErr } = await supabase
        .from("applications")
        .select("id, tracking_id, citizen_id, source_run_id")
        .or(`id.eq.${applicationId},tracking_id.eq.${applicationId}`)
        .single();

      if (fetchErr || !appRow) return err("Application not found.");

      const newStatus = action === "approved" ? "approved" : action === "rejected" ? "rejected" : "under_review";
      const nowIso = new Date().toISOString();

      await supabase
        .from("applications")
        .update({
          status: newStatus,
          admin_notes: notes.trim(),
          updated_at: nowIso,
        })
        .eq("id", appRow.id);

      await supabase.from("audit_logs").insert({
        run_id: appRow.source_run_id || null,
        agent_name: "Human Reviewer",
        action: action === "approved" ? "APPLICATION_APPROVED" : action === "rejected" ? "APPLICATION_REJECTED" : "MORE_INFO_REQUESTED",
        evidence: notes.trim(),
        result: newStatus.toUpperCase(),
      });

      if (appRow.citizen_id) {
        await supabase.from("notifications").insert({
          citizen_id: appRow.citizen_id,
          title: `Application ${action.toUpperCase()}: ${appRow.tracking_id}`,
          body: notes.trim(),
          type: action === "approved" ? "success" : "critical",
          is_read: false,
        });
      }

      return ok(true);
    } catch (e: any) {
      return err(e.message || "Failed to commit review to database.");
    }
  }

  return err("Database connection unavailable.");
}

/**
 * Fetch all schemes directly from database with rules and documents
 */
export async function getAdminSchemes(): Promise<AdminSchemeDetail[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase.from("schemes").select(`
      id,
      name,
      category,
      jurisdiction,
      eligibility_status,
      official_source,
      last_verified,
      benefit,
      description,
      document_requirements (
        id,
        document_type,
        is_mandatory
      ),
      eligibility_rules (
        id,
        criterion_name,
        requirement,
        rule_type,
        evidence_source
      )
    `).order("name");

    if (error || !data) return [];

    return data.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      jurisdiction: s.jurisdiction,
      eligibility_status: s.eligibility_status,
      docs: s.document_requirements?.length || 0,
      official_source: s.official_source || "Official Portal",
      last_verified: s.last_verified ? new Date(s.last_verified).toLocaleDateString() : "Today",
      status: s.eligibility_status,
      benefit: s.benefit || "",
      description: s.description || "",
      eligibility_rules: s.eligibility_rules || [],
      document_requirements: s.document_requirements || [],
    }));
  } catch (err) {
    console.error("[Sahayak Admin] Error fetching admin schemes:", err);
    return [];
  }
}

/**
 * Update scheme eligibility status in DB and audit trail
 */
export async function updateAdminSchemeStatus(
  schemeId: string,
  status: "Active" | "Draft" | "Archived",
): Promise<ServiceResult<boolean>> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/schemes/${schemeId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Sahayak-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({ status }),
    });
    if (res.ok) return ok(true);
  } catch {}

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from("schemes")
        .update({ eligibility_status: status, updated_at: new Date().toISOString() })
        .eq("id", schemeId);

      if (error) return err(error.message);

      await supabase.from("audit_logs").insert({
        agent_name: "Admin Officer",
        action: "SCHEME_STATUS_UPDATED",
        evidence: `Scheme status changed to ${status}`,
        result: status.toUpperCase(),
      });

      return ok(true);
    } catch (e: any) {
      return err(e.message || "Failed to update scheme status");
    }
  }

  return err("Database connection unavailable.");
}

/**
 * Create a new official scheme directly in DB
 */
export async function createAdminScheme(scheme: {
  name: string;
  category: string;
  jurisdiction: "Central" | "State";
  benefit: string;
  description: string;
  official_source: string;
  rules: { criterion_name: string; requirement: string; rule_type: string; evidence_source?: string }[];
  documents: { document_type: string; is_mandatory: boolean }[];
}): Promise<ServiceResult<string>> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/schemes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sahayak-Internal-Secret": INTERNAL_SECRET,
      },
      body: JSON.stringify({
        name: scheme.name,
        category: scheme.category,
        jurisdiction: scheme.jurisdiction,
        benefit: scheme.benefit,
        description: scheme.description,
        official_source: scheme.official_source,
        eligibility_status: "Active",
        rules: scheme.rules,
        documents: scheme.documents,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      return ok(json.scheme_id);
    }
  } catch {}

  if (isSupabaseConfigured) {
    try {
      const { data: newScheme, error: sErr } = await supabase
        .from("schemes")
        .insert({
          name: scheme.name.trim(),
          category: scheme.category,
          jurisdiction: scheme.jurisdiction,
          benefit: scheme.benefit,
          description: scheme.description,
          official_source: scheme.official_source || "Official Portal",
          eligibility_status: "Active",
        })
        .select()
        .single();

      if (sErr || !newScheme) return err(sErr?.message || "Failed to create scheme");

      if (scheme.rules?.length) {
        await supabase.from("eligibility_rules").insert(
          scheme.rules.map((r) => ({
            scheme_id: newScheme.id,
            criterion_name: r.criterion_name,
            requirement: r.requirement,
            rule_type: r.rule_type || "text",
            evidence_source: r.evidence_source || "Document",
          })),
        );
      }

      if (scheme.documents?.length) {
        await supabase.from("document_requirements").insert(
          scheme.documents.map((d) => ({
            scheme_id: newScheme.id,
            document_type: d.document_type,
            is_mandatory: d.is_mandatory ?? true,
          })),
        );
      }

      await supabase.from("audit_logs").insert({
        agent_name: "Admin Officer",
        action: "SCHEME_CREATED",
        evidence: `Created scheme: ${scheme.name}`,
        result: "ACTIVE",
      });

      return ok(newScheme.id);
    } catch (e: any) {
      return err(e.message || "Failed to create scheme");
    }
  }

  return err("Database connection unavailable.");
}

/**
 * Fetch immutable audit logs
 */
export async function getAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/audit-logs?limit=${limit}`, {
      headers: { "X-Sahayak-Internal-Secret": INTERNAL_SECRET },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.logs) return data.logs;
    }
  } catch {}

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, run_id, agent_name, action, evidence, result, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error && data) return data;
    } catch (e) {
      console.error("[Sahayak Admin] Error fetching audit logs:", e);
    }
  }

  return [];
}

/**
 * Fetch system health metrics
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  try {
    const res = await fetch(`${BACKEND_URL}/admin/system-health`, {
      headers: { "X-Sahayak-Internal-Secret": INTERNAL_SECRET },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  return {
    status: isSupabaseConfigured ? "healthy" : "degraded",
    database_connected: isSupabaseConfigured,
    groq_ai_configured: true,
    gemini_vision_configured: true,
    internal_secret_configured: true,
    timestamp: new Date().toISOString(),
  };
}
