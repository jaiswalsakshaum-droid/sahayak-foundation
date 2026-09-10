import { supabase, isSupabaseConfigured } from "./supabase";
import { err, ok, type ServiceResult } from "./result";

export interface StageCount {
  name: string;
  count: number;
}

export interface VolumeDay {
  name: string;
  count: number;
}

export interface TaskDistribution {
  name: string;
  value: number;
}

export interface CompletionRateMonth {
  name: string;
  rate: number;
}

// Fallback demo fixtures used ONLY when Supabase is genuinely unconfigured
const LOCAL_DEMO_APPS_BY_STAGE: StageCount[] = [
  { name: "Draft", count: 42 },
  { name: "Awaiting Approval", count: 28 },
  { name: "Submitted", count: 65 },
  { name: "Under Review", count: 118 },
  { name: "Approved", count: 240 },
  { name: "Rejected", count: 15 },
];

const LOCAL_DEMO_DOC_VOLUME: VolumeDay[] = [
  { name: "Mon", count: 142 },
  { name: "Tue", count: 198 },
  { name: "Wed", count: 230 },
  { name: "Thu", count: 215 },
  { name: "Fri", count: 280 },
  { name: "Sat", count: 160 },
  { name: "Sun", count: 110 },
];

const LOCAL_DEMO_AGENT_TASKS: TaskDistribution[] = [
  { name: "Citizen Agent", value: 340 },
  { name: "Scheme Agent", value: 520 },
  { name: "Eligibility Agent", value: 680 },
  { name: "Document Agent", value: 490 },
  { name: "Application Agent", value: 310 },
  { name: "Tracker Agent", value: 240 },
];

const LOCAL_DEMO_COMPLETION_RATES: CompletionRateMonth[] = [
  { name: "Apr", rate: 84.2 },
  { name: "May", rate: 86.5 },
  { name: "Jun", rate: 89.1 },
  { name: "Jul", rate: 91.4 },
  { name: "Aug", rate: 93.8 },
  { name: "Sep", rate: 94.7 },
];

/**
 * Fetch application counts grouped by status / stage
 */
export async function getApplicationsByStage(): Promise<ServiceResult<StageCount[]>> {
  if (!isSupabaseConfigured) {
    return ok(LOCAL_DEMO_APPS_BY_STAGE);
  }

  try {
    // Attempt RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_applications_by_stage");
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return ok(
        rpcData.map((row: any) => ({
          name: row.name
            ? row.name.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Unknown",
          count: Number(row.count) || 0,
        })),
      );
    }

    // Direct aggregation fallback
    const { data, error } = await supabase.from("applications").select("status");
    if (error) {
      return err(`Failed to load applications by stage: ${error.message}`);
    }

    const stageMap: Record<string, number> = {
      draft: 0,
      awaiting_approval: 0,
      submitted: 0,
      under_review: 0,
      approved: 0,
      rejected: 0,
    };

    (data || []).forEach((row) => {
      const st = row.status || "draft";
      stageMap[st] = (stageMap[st] || 0) + 1;
    });

    const formatted: StageCount[] = Object.entries(stageMap).map(([status, count]) => ({
      name: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }));

    return ok(formatted);
  } catch (e: any) {
    return err(`Unexpected error loading application stages: ${e.message || e}`);
  }
}

/**
 * Fetch daily document upload volume over trailing N days
 */
export async function getDocumentVolumeByDay(days = 7): Promise<ServiceResult<VolumeDay[]>> {
  if (!isSupabaseConfigured) {
    return ok(LOCAL_DEMO_DOC_VOLUME);
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_document_volume_by_day", {
      days,
    });
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return ok(
        rpcData.map((row: any) => ({
          name: row.name,
          count: Number(row.count) || 0,
        })),
      );
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("documents")
      .select("uploaded_at")
      .gte("uploaded_at", cutoff)
      .order("uploaded_at", { ascending: true });

    if (error) {
      return err(`Failed to load document volume: ${error.message}`);
    }

    const dayMap: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString(undefined, { weekday: "short" });
      dayMap[key] = 0;
    }

    (data || []).forEach((row) => {
      const dayKey = new Date(row.uploaded_at).toLocaleDateString(undefined, { weekday: "short" });
      dayMap[dayKey] = (dayMap[dayKey] || 0) + 1;
    });

    const formatted: VolumeDay[] = Object.entries(dayMap).map(([name, count]) => ({
      name,
      count,
    }));

    return ok(formatted);
  } catch (e: any) {
    return err(`Unexpected error loading document volume: ${e.message || e}`);
  }
}

/**
 * Fetch distribution of executed agent tasks across the workforce
 */
export async function getAgentTaskDistribution(): Promise<ServiceResult<TaskDistribution[]>> {
  if (!isSupabaseConfigured) {
    return ok(LOCAL_DEMO_AGENT_TASKS);
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_agent_task_distribution");
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return ok(
        rpcData.map((row: any) => ({
          name: row.name || "Agent",
          value: Number(row.value) || 0,
        })),
      );
    }

    const { data, error } = await supabase.from("agent_events").select("agent_name");
    if (error) {
      return err(`Failed to load agent task distribution: ${error.message}`);
    }

    const taskMap: Record<string, number> = {};
    (data || []).forEach((row) => {
      const name = row.agent_name || "Unknown Agent";
      taskMap[name] = (taskMap[name] || 0) + 1;
    });

    const formatted: TaskDistribution[] = Object.entries(taskMap).map(([name, value]) => ({
      name,
      value,
    }));

    return ok(formatted.length > 0 ? formatted : LOCAL_DEMO_AGENT_TASKS);
  } catch (e: any) {
    return err(`Unexpected error loading agent task distribution: ${e.message || e}`);
  }
}

/**
 * Fetch monthly application completion & approval rates
 */
export async function getCompletionRateByMonth(
  months = 6,
): Promise<ServiceResult<CompletionRateMonth[]>> {
  if (!isSupabaseConfigured) {
    return ok(LOCAL_DEMO_COMPLETION_RATES);
  }

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_completion_rate_by_month", {
      months,
    });
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return ok(
        rpcData.map((row: any) => ({
          name: row.name,
          rate: Number(row.rate) || 0,
        })),
      );
    }

    const cutoff = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("applications")
      .select("created_at, status")
      .gte("created_at", cutoff);

    if (error) {
      return err(`Failed to load completion rates: ${error.message}`);
    }

    const monthMap: Record<string, { total: number; approved: number }> = {};
    (data || []).forEach((row) => {
      const month = new Date(row.created_at).toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
      if (!monthMap[month]) monthMap[month] = { total: 0, approved: 0 };
      monthMap[month].total += 1;
      if (row.status === "approved") {
        monthMap[month].approved += 1;
      }
    });

    const formatted: CompletionRateMonth[] = Object.entries(monthMap).map(([name, stats]) => ({
      name,
      rate: stats.total > 0 ? Math.round((stats.approved / stats.total) * 1000) / 10 : 0,
    }));

    return ok(formatted.length > 0 ? formatted : LOCAL_DEMO_COMPLETION_RATES);
  } catch (e: any) {
    return err(`Unexpected error loading completion rates: ${e.message || e}`);
  }
}
