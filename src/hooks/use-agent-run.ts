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

export function useAgentRun() {
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<LiveAgentEvent[]>([]);
  const [status, setStatus] = useState<"IDLE" | "PROCESSING" | "ACTION_REQUIRED" | "COMPLETED">(
    "IDLE",
  );
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [latestData, setLatestData] = useState<Record<string, any>>({});
  const channelRef = useRef<any>(null);

  // Subscribe to Realtime Postgres changes for this run_id
  useEffect(() => {
    if (!runId || !isSupabaseConfigured) return;

    // Clean up previous channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
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

          // Update active agent index based on agent name
          const agentName = newEvent.agent_name.toLowerCase();
          if (agentName.includes("citizen")) {
            setActiveAgentIndex(0);
          } else if (agentName.includes("scheme")) {
            setActiveAgentIndex(1);
          } else if (agentName.includes("eligibility")) {
            setActiveAgentIndex(2);
          } else if (agentName.includes("document")) {
            setActiveAgentIndex(3);
            setStatus("ACTION_REQUIRED");
          } else if (agentName.includes("application")) {
            setActiveAgentIndex(4);
            setStatus("COMPLETED");
          }

          if (newEvent.details) {
            setLatestData((prev) => ({ ...prev, ...newEvent.details }));
          }
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [runId]);

  const startRun = useCallback(async (query: string) => {
    setStatus("PROCESSING");
    setEvents([]);
    setLatestData({});
    setActiveAgentIndex(0);

    const generatedRunId = `run-${Date.now()}`;
    setRunId(generatedRunId);

    if (isSupabaseConfigured) {
      try {
        const session = await getSession();
        const token = session?.access_token || "";

        // Attempt to call orchestrate-agent-run Edge function or direct local backend
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
            setRunId(data.run_id);
            return data.run_id;
          }
        }
      } catch (err) {
        console.warn(
          "[useAgentRun] Edge function notice, running with local simulation fallback:",
          err,
        );
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
    startRun,
  };
}
