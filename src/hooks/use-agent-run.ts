import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSession, getCurrentProfile } from "@/lib/auth";

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
  const [status, setStatus] = useState<
    "IDLE" | "PROCESSING" | "ACTION_REQUIRED" | "COMPLETED" | "ERROR"
  >("IDLE");
  const [activeAgentIndex, setActiveAgentIndex] = useState<number>(-1);
  const [latestData, setLatestData] = useState<Record<string, any>>({});
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const eventsChannelRef = useRef<any>(null);
  const runsChannelRef = useRef<any>(null);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (connectingTimerRef.current) {
      clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const clearPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Process a newly received or polled event
  const handleIncomingEvent = useCallback((newEvent: LiveAgentEvent) => {
    setEvents((prev) => {
      if (
        prev.some(
          (e) =>
            e.id === newEvent.id ||
            (e.action === newEvent.action && e.agent_name === newEvent.agent_name),
        )
      ) {
        return prev;
      }
      return [...prev, newEvent];
    });

    setIsConnecting(false);
    setIsReconnecting(false);

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
    } else if (agentName.includes("application")) {
      setActiveAgentIndex(4);
    } else if (agentName.includes("tracker")) {
      setActiveAgentIndex(5);
    }

    if (newEvent.details) {
      setLatestData((prev) => ({ ...prev, ...newEvent.details }));
      const missing = newEvent.details.missing_documents;
      const pending = newEvent.details.pending_requirements;
      const nextAction = newEvent.details.next_action;

      if (
        newEvent.details.application_draft ||
        newEvent.details.event_code === "APPLICATION_DRAFT_CREATED"
      ) {
        setStatus("COMPLETED");
        setActiveAgentIndex(4);
      } else if (
        (Array.isArray(missing) && missing.length > 0) ||
        (Array.isArray(pending) && pending.length > 0) ||
        nextAction?.type === "upload_document"
      ) {
        setStatus((current) => (current === "COMPLETED" ? "COMPLETED" : "ACTION_REQUIRED"));
        setActiveAgentIndex(3);
      }
    }
  }, []);

  // REST polling engine: Fast 1.2s polling during PROCESSING, 2s during ACTION_REQUIRED
  useEffect(() => {
    if (
      !runId ||
      !isSupabaseConfigured ||
      (status !== "PROCESSING" && status !== "ACTION_REQUIRED" && !isReconnecting)
    ) {
      clearPolling();
      return;
    }

    const pollRunState = async () => {
      try {
        // 1. Fetch agent events for the run
        const { data: polledEvents } = await supabase
          .from("agent_events")
          .select("*")
          .eq("run_id", runId)
          .order("created_at", { ascending: true });

        if (polledEvents && polledEvents.length > 0) {
          polledEvents.forEach((ev) => handleIncomingEvent(ev as LiveAgentEvent));
        }

        // 2. Fetch agent run status
        const { data: runRecord } = await supabase
          .from("agent_runs")
          .select("status")
          .eq("id", runId)
          .maybeSingle();

        if (runRecord?.status) {
          if (runRecord.status === "COMPLETED") {
            setStatus("COMPLETED");
            setActiveAgentIndex(4);
            clearPolling();
          } else if (
            runRecord.status === "ACTION REQUIRED" ||
            runRecord.status === "ACTION_REQUIRED"
          ) {
            setStatus((curr) => (curr === "COMPLETED" ? "COMPLETED" : "ACTION_REQUIRED"));
            setActiveAgentIndex(3);
          } else if (runRecord.status === "ERROR" || runRecord.status === "FAILED") {
            setStatus("ERROR");
            clearPolling();
          }
        }
      } catch (err) {
        console.warn("[useAgentRun] Polling notice:", err);
      }
    };

    // Immediately poll once on mount/transition
    pollRunState();

    const pollInterval = status === "PROCESSING" ? 1200 : 2500;
    pollIntervalRef.current = setInterval(pollRunState, pollInterval);

    return () => clearPolling();
  }, [runId, status, isReconnecting, handleIncomingEvent]);

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

    // Set a 12-second connecting watchdog
    connectingTimerRef.current = setTimeout(() => {
      setIsConnecting(true);
    }, 12000);

    // Set a 90-second safety notice (non-fatal, prompts user)
    idleTimerRef.current = setTimeout(() => {
      if (status === "PROCESSING") {
        setIsConnecting(false);
      }
    }, 90000);

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
          handleIncomingEvent(newEvent);
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

    // Channel 2: agent_runs — STATUS is the ground truth
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

          clearTimers();
          setIsConnecting(false);
          setIsReconnecting(false);

          if (updatedStatus === "COMPLETED") {
            setStatus("COMPLETED");
            setActiveAgentIndex(4);
          } else if (updatedStatus === "ACTION REQUIRED" || updatedStatus === "ACTION_REQUIRED") {
            setStatus("ACTION_REQUIRED");
            setActiveAgentIndex(3);
          } else if (updatedStatus === "ERROR" || updatedStatus === "FAILED") {
            setStatus("ERROR");
            setErrorMessage("Agent workflow encountered an error on the backend.");
          } else if (updatedStatus === "PROCESSING") {
            setStatus("PROCESSING");
          }
        },
      )
      .subscribe();

    runsChannelRef.current = runsChannel;

    return () => {
      clearTimers();
      clearPolling();
      if (eventsChannelRef.current) {
        supabase.removeChannel(eventsChannelRef.current);
      }
      if (runsChannelRef.current) {
        supabase.removeChannel(runsChannelRef.current);
      }
    };
  }, [runId, handleIncomingEvent, status]);

  const startRun = useCallback(async (query: string, selectedSchemeId?: string) => {
    clearTimers();
    clearPolling();
    setStatus("PROCESSING");
    setEvents([]);
    setLatestData({});
    setActiveAgentIndex(0);
    setErrorMessage(null);
    setIsConnecting(false);

    if (isSupabaseConfigured) {
      try {
        const session = await getSession();
        const token = session?.access_token || "";
        let citizenId = session?.user?.id;

        if (!citizenId) {
          try {
            const prof = await getCurrentProfile();
            citizenId = prof?.id;
          } catch (pe) {
            console.warn("Error getting profile in startRun:", pe);
          }
        }

        // Fallback to active citizen profile in database (Varsha Singh default)
        if (!citizenId) {
          citizenId = "e475446a-b859-4e8d-89f5-12753ba20ab9";
        }

        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        const internalSecret = import.meta.env.VITE_INTERNAL_SECRET || "sahayak_dev_secret_123";

        let realRunId: string | null = null;
        let targetCitizenId: string = citizenId;

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/orchestrate-agent-run`;

        // 1. Try calling Edge Function
        try {
          const res = await fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
            body: JSON.stringify({ query, selected_scheme_id: selectedSchemeId || null }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.run_id) {
              realRunId = data.run_id;
              if (data.citizen_id) targetCitizenId = data.citizen_id;
            }
          }
        } catch (edgeErr) {
          console.warn(
            "[useAgentRun] Edge function notice, falling back to direct client insertion:",
            edgeErr,
          );
        }

        // 2. Direct Supabase insertion fallback if edge function was unavailable
        if (!realRunId && targetCitizenId) {
          const insertPayload: Record<string, any> = {
            citizen_id: targetCitizenId,
            input_query: query,
            status: "PROCESSING",
          };
          if (selectedSchemeId) {
            insertPayload.selected_scheme_id = selectedSchemeId;
          }
          const { data: runRecord } = await supabase
            .from("agent_runs")
            .insert(insertPayload)
            .select()
            .single();

          if (runRecord?.id) {
            realRunId = runRecord.id;
          }
        }

        if (realRunId) {
          setRunId(realRunId);

          // 3. Dispatch directly to FastAPI backend so local uvicorn execution is guaranteed
          fetch(`${backendUrl}/run`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Sahayak-Internal-Secret": internalSecret,
            },
            body: JSON.stringify({
              run_id: realRunId,
              citizen_id: targetCitizenId,
              query,
              selected_scheme_id: selectedSchemeId || null,
            }),
          }).catch((err) => {
            console.warn("[useAgentRun] Direct backend dispatch warning:", err);
          });

          return realRunId;
        } else {
          setStatus("ERROR");
          setErrorMessage(
            "Could not initialize agent run session. Please ensure you are logged in.",
          );
          return null;
        }
      } catch (err: any) {
        console.error("[useAgentRun] Network or initialization failure:", err);
        setStatus("ERROR");
        setErrorMessage(
          err.message || "Failed to reach AI workforce service. Please check your connection.",
        );
        return null;
      }
    } else {
      // Local demo offline mode
      const offlineRunId = `demo-run-${Date.now()}`;
      setRunId(offlineRunId);
      return offlineRunId;
    }

    return null;
  }, []);

  const loadRunById = useCallback(
    async (existingRunId: string) => {
      clearTimers();
      clearPolling();
      setRunId(existingRunId);
      setEvents([]);
      setLatestData({});
      setErrorMessage(null);
      setIsConnecting(false);

      if (!isSupabaseConfigured) return;

      try {
        const { data: runRecord } = await supabase
          .from("agent_runs")
          .select("*")
          .eq("id", existingRunId)
          .maybeSingle();

        const { data: eventRecords } = await supabase
          .from("agent_events")
          .select("*")
          .eq("run_id", existingRunId)
          .order("created_at", { ascending: true });

        if (eventRecords && eventRecords.length > 0) {
          eventRecords.forEach((ev) => handleIncomingEvent(ev as LiveAgentEvent));
        }

        if (runRecord) {
          if (runRecord.status === "COMPLETED") {
            setStatus("COMPLETED");
            setActiveAgentIndex(5);
          } else if (
            runRecord.status === "ACTION REQUIRED" ||
            runRecord.status === "ACTION_REQUIRED"
          ) {
            setStatus("ACTION_REQUIRED");
            setActiveAgentIndex(3);
          } else if (runRecord.status === "PROCESSING") {
            setStatus("PROCESSING");
          } else if (runRecord.status === "ERROR" || runRecord.status === "FAILED") {
            setStatus("ERROR");
          }
        }
      } catch (err) {
        console.warn("Error loading past run:", err);
      }
    },
    [handleIncomingEvent],
  );

  const resetRun = useCallback(() => {
    clearTimers();
    clearPolling();
    if (eventsChannelRef.current) {
      supabase.removeChannel(eventsChannelRef.current);
      eventsChannelRef.current = null;
    }
    if (runsChannelRef.current) {
      supabase.removeChannel(runsChannelRef.current);
      runsChannelRef.current = null;
    }
    setRunId(null);
    setEvents([]);
    setStatus("IDLE");
    setActiveAgentIndex(-1);
    setLatestData({});
    setIsReconnecting(false);
    setIsConnecting(false);
    setErrorMessage(null);
  }, []);

  return {
    runId,
    events,
    status,
    activeAgentIndex,
    latestData,
    isReconnecting,
    isConnecting,
    errorMessage,
    startRun,
    loadRunById,
    resetRun,
    setStatus,
  };
}
