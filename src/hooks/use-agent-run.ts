import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export type LiveAgentEvent = {
  id: string;
  run_id: string;
  agent_name: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
};

export const AGENT_STEPS = [
  { key: "citizen", label: "Citizen Context", agentName: "Citizen Agent" },
  { key: "scheme", label: "Scheme Discovery", agentName: "Scheme Agent" },
  { key: "eligibility", label: "Rule Verification", agentName: "Eligibility Agent" },
  { key: "document", label: "Document Check", agentName: "Document Agent" },
  { key: "application", label: "Draft Preparation", agentName: "Application Agent" },
  { key: "tracker", label: "Journey Tracking", agentName: "Tracker Agent" },
];

export function useAgentRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<LiveAgentEvent[]>([]);
  const [status, setStatus] = useState<"IDLE" | "PROCESSING" | "ACTION_REQUIRED" | "COMPLETED" | "ERROR">(
    "IDLE",
  );
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [latestData, setLatestData] = useState<Record<string, any>>({});
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const eventsChannelRef = useRef<any>(null);
  const runsChannelRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout helper
  const clearRunTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Subscribe to agent_events (message feed) and agent_runs (status ground truth)
  useEffect(() => {
    if (!runId || !isSupabaseConfigured) return;

    // Clean up previous channels if any
    if (eventsChannelRef.current) {
      supabase.removeChannel(eventsChannelRef.current);
    }
    if (runsChannelRef.current) {
      supabase.removeChannel(runsChannelRef.current);
    }

    // Channel 1: agent_events — live message feed for the run
    const eventsChannel = supabase
      .channel(`agent_events:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_events",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const newEvent = payload.new as LiveAgentEvent;
          setEvents((prev) => [...prev, newEvent]);

          // Receiving any event means the run is alive — cancel the timeout
          clearRunTimeout();
          setIsReconnecting(false);

          // Update active agent index based on agent name (display only, not status ground truth)
          const agentName = newEvent.agent_name.toLowerCase();
          if (agentName.includes("citizen")) {
            setActiveAgentIndex(0);
          } else if (agentName.includes("scheme")) {
            setActiveAgentIndex(1);
          } else if (agentName.includes("eligibility")) {
            setActiveAgentIndex(2);
          } else if (agentName.includes("document")) {
            setActiveAgentIndex(3);
          } else if (agentName.includes("application")) {
            setActiveAgentIndex(4);
          } else if (agentName.includes("tracker")) {
            setActiveAgentIndex(5);
          }

          if (newEvent.details) {
            setLatestData((prev) => ({ ...prev, ...newEvent.details }));
          }
        },
      )
      .subscribe((subStatus) => {
        if (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT") {
          setIsReconnecting(true);
        } else if (subStatus === "SUBSCRIBED") {
          setIsReconnecting(false);
        }
      });

    eventsChannelRef.current = eventsChannel;

    // Channel 2: agent_runs — STATUS is the ground truth (not inferred from agent names)
    const runsChannel = supabase
      .channel(`agent_runs_status:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agent_runs",
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const updatedStatus = payload.new?.status as string | undefined;
          if (!updatedStatus) return;

          // Cancel timeout — the run completed (one way or another)
          clearRunTimeout();
          setIsReconnecting(false);

          if (updatedStatus === "COMPLETED") {
            setStatus("COMPLETED");
            setActiveAgentIndex(4);
          } else if (updatedStatus === "ACTION REQUIRED") {
            setStatus("ACTION_REQUIRED");
          } else if (updatedStatus === "ERROR" || updatedStatus === "FAILED") {
            setStatus("ERROR");
          }
        },
      )
      .subscribe();

    runsChannelRef.current = runsChannel;

    return () => {
      clearRunTimeout();
      if (eventsChannelRef.current) {
        supabase.removeChannel(eventsChannelRef.current);
      }
      if (runsChannelRef.current) {
        supabase.removeChannel(runsChannelRef.current);
      }
    };
  }, [runId]);

  const startRun = useCallback(async (query: string) => {
    clearRunTimeout();
    setStatus("PROCESSING");
    setEvents([]);
    setLatestData({});
    setActiveAgentIndex(0);

    const generatedRunId = `run-${Date.now()}`;
    setRunId(generatedRunId);

    // 9-second safety timeout — if nothing comes back, surface an error instead of an infinite spinner
    timeoutRef.current = setTimeout(() => {
      setStatus("ERROR");
    }, 9000);

    if (isSupabaseConfigured) {
      try {
        const session = await getSession();
        const token = session?.access_token || "";

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/orchestrate-agent-run`;

        const res = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({ query }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.run_id) {
            // Use the server-assigned run_id so our Realtime subscriptions match the DB row
            setRunId(data.run_id);
            return data.run_id;
          }
        } else if (res.status === 401) {
          // Auth error — surface immediately, don't wait for timeout
          clearRunTimeout();
          setStatus("ERROR");
        }
      } catch (err) {
        console.warn(
          "[useAgentRun] Edge function error:",
          err,
        );
        // Don't clear timeout — let it fire naturally if no events arrive
      }
    }

    return generatedRunId;
  }, []);

  return {
    runId,
    events,
    status,
    activeAgentIndex,
    latestData,
    isReconnecting,
    startRun,
  };
}
