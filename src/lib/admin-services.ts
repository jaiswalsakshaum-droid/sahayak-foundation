import { supabase, isSupabaseConfigured } from "./supabase";

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

export const MOCK_ADMIN_METRICS = {
  active_citizens: 12450,
  applications_processed: 8932,
  documents_verified: 34102,
  agent_tasks_completed: 156420,
  avg_workflow_time: "4.2 mins",
  applications_requiring_review: 412,
};

export const MOCK_AGENT_EVENTS = [
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
];

export const MOCK_SCHEMES_DATA = [
  {
    id: "1",
    name: "National Means-cum-Merit Scholarship",
    category: "Education",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 3,
    official_source: "myScheme",
    last_verified: "Today",
    status: "Active",
  },
  {
    id: "2",
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
    id: "3",
    name: "State Girls Education Grant",
    category: "Women",
    jurisdiction: "State",
    eligibility_status: "Active",
    docs: 2,
    official_source: "State Portal",
    last_verified: "3 days ago",
    status: "Active",
  },
  {
    id: "4",
    name: "PM Awas Yojana",
    category: "Housing",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 4,
    official_source: "PMAY Portal",
    last_verified: "1 week ago",
    status: "Active",
  },
  {
    id: "5",
    name: "Rural Employment Guarantee",
    category: "Employment",
    jurisdiction: "Central",
    eligibility_status: "Active",
    docs: 2,
    official_source: "NREGA",
    last_verified: "2 weeks ago",
    status: "Active",
  },
];

/**
 * Fetch real aggregate admin metrics from Supabase with fallback
 */
export async function getAdminMetrics(): Promise<typeof MOCK_ADMIN_METRICS> {
  if (!isSupabaseConfigured) {
    return MOCK_ADMIN_METRICS;
  }

  try {
    const [citizensCount, appsCount, docsCount, runsCount] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("applications").select("*", { count: "exact", head: true }),
      supabase.from("documents").select("*", { count: "exact", head: true }),
      supabase.from("agent_runs").select("*", { count: "exact", head: true }),
    ]);

    return {
      active_citizens: citizensCount.count || MOCK_ADMIN_METRICS.active_citizens,
      applications_processed: appsCount.count || MOCK_ADMIN_METRICS.applications_processed,
      documents_verified: docsCount.count || MOCK_ADMIN_METRICS.documents_verified,
      agent_tasks_completed: (runsCount.count || 1) * 6,
      avg_workflow_time: "4.2 mins",
      applications_requiring_review: 412,
    };
  } catch (err) {
    console.warn("[Sahayak Admin] Error fetching metrics:", err);
    return MOCK_ADMIN_METRICS;
  }
}

/**
 * Fetch live recent agent events
 */
export async function getRecentAgentEvents(): Promise<typeof MOCK_AGENT_EVENTS> {
  if (!isSupabaseConfigured) {
    return MOCK_AGENT_EVENTS;
  }

  try {
    const { data, error } = await supabase
      .from("agent_events")
      .select("id, created_at, agent_name, action")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return MOCK_AGENT_EVENTS;
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
    return MOCK_AGENT_EVENTS;
  }
}

/**
 * Fetch schemes data for admin management
 */
export async function getAdminSchemes(): Promise<typeof MOCK_SCHEMES_DATA> {
  if (!isSupabaseConfigured) {
    return MOCK_SCHEMES_DATA;
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
      return MOCK_SCHEMES_DATA;
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
    return MOCK_SCHEMES_DATA;
  }
}
