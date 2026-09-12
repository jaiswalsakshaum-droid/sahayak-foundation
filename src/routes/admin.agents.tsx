import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ShieldCheck,
  SearchCheck,
  ClipboardCheck,
  FileCheck2,
  Activity,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  Zap,
  Radio,
  FileText,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getLiveWorkforceStatus,
  getLiveAgentEvents,
  type AgentWorkforceMember,
  type RealAgentEvent,
} from "@/lib/admin-services";

export const Route = createFileRoute("/admin/agents")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  head: () => ({
    meta: [
      { title: "AI Workforce Control Center — Sahayak Admin" },
      {
        name: "description",
        content:
          "Real-time supervisory control, event stream, and health telemetry for the 6 specialized AI agents.",
      },
    ],
  }),
  component: AdminAgentsControlCenter,
});

const AGENT_ICONS: Record<string, any> = {
  citizen: ShieldCheck,
  scheme: SearchCheck,
  eligibility: ClipboardCheck,
  document: FileCheck2,
  application: FileText,
  tracker: Clock,
};

const AGENT_COLORS: Record<string, { badge: string; iconBg: string; text: string }> = {
  citizen: {
    badge: "bg-blue-950 text-blue-300 border-blue-800",
    iconBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    text: "text-blue-400",
  },
  scheme: {
    badge: "bg-indigo-950 text-indigo-300 border-indigo-800",
    iconBg: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    text: "text-indigo-400",
  },
  eligibility: {
    badge: "bg-emerald-950 text-emerald-300 border-emerald-800",
    iconBg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    text: "text-emerald-400",
  },
  document: {
    badge: "bg-amber-950 text-amber-300 border-amber-800",
    iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    text: "text-amber-400",
  },
  application: {
    badge: "bg-purple-950 text-purple-300 border-purple-800",
    iconBg: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    text: "text-purple-400",
  },
  tracker: {
    badge: "bg-cyan-950 text-cyan-300 border-cyan-800",
    iconBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    text: "text-cyan-400",
  },
};

function AdminAgentsControlCenter() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<AgentWorkforceMember | null>(null);

  // Queries
  const agentsQuery = useQuery({
    queryKey: ["admin", "agents", "status"],
    queryFn: getLiveWorkforceStatus,
    refetchInterval: 5000,
  });

  const eventsQuery = useQuery({
    queryKey: ["admin", "agents", "events"],
    queryFn: () => getLiveAgentEvents(40),
    refetchInterval: 3000,
  });

  const agents = agentsQuery.data || [];
  const events = eventsQuery.data || [];

  const totalTasks = agents.reduce((acc, a) => acc + a.tasks_processed, 0);
  const totalErrors = agents.reduce((acc, a) => acc + a.error_count, 0);
  const isAnyAgentInError = agents.some((a) => a.status === "ERROR");

  return (
    <AdminLayout
      title="AI Workforce Control Center"
      subtitle="Autonomous Multi-Agent telemetry, deterministic pipeline health, and live multi-citizen activity feed."
    >
      <div className="space-y-8">
        {/* System Alert Banner if Error */}
        {isAnyAgentInError && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-rose-200">
            <AlertTriangle className="size-5 shrink-0 text-rose-400" />
            <div className="text-xs">
              <span className="font-bold">Workforce Alert:</span> One or more agents encountered a
              processing failure or missing credential. Check the activity stream below for
              execution traces.
            </div>
          </div>
        )}

        {/* Global Workforce Telemetry Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Workforce Roster</span>
              <Bot className="size-4 text-brand" />
            </div>
            <p className="text-2xl font-bold font-display text-white">6 Agents</p>
            <p className="text-[11px] text-slate-400 mt-1">Specialized civic sub-graphs</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">
                Total Tasks Executed
              </span>
              <Zap className="size-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-display text-white">
              {agentsQuery.isLoading ? "—" : totalTasks.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Live database events</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Workforce Health</span>
              <Activity className="size-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-display text-emerald-300">
              {agentsQuery.isLoading
                ? "—"
                : `${Math.max(0, 100 - (totalErrors / Math.max(1, totalTasks)) * 100).toFixed(1)}%`}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Operational success rate</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">
                Live Activity Pulse
              </span>
              <Radio className="size-4 text-rose-400 animate-pulse" />
            </div>
            <p className="text-2xl font-bold font-display text-white">{events.length} Events</p>
            <p className="text-[11px] text-slate-400 mt-1">Streaming in real-time (3s poll)</p>
          </div>
        </div>

        {/* 6 Specialized Agent Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <Bot className="size-5 text-brand" />
              Specialized Agent Pipeline Roster
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["admin", "agents"] });
              }}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 h-8 text-xs"
            >
              <RefreshCw
                className={`size-3.5 mr-1.5 ${agentsQuery.isRefetching ? "animate-spin" : ""}`}
              />
              Poll Telemetry
            </Button>
          </div>

          {agentsQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 className="size-7 animate-spin text-brand" />
              <p className="text-xs">Computing live agent workforce telemetry...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => {
                const IconComponent = AGENT_ICONS[agent.id] || Bot;
                const styling = AGENT_COLORS[agent.id] || {
                  badge: "bg-slate-800 text-slate-300 border-slate-700",
                  iconBg: "bg-slate-800 text-slate-300 border-slate-700",
                  text: "text-slate-300",
                };

                return (
                  <div
                    key={agent.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm hover:border-slate-700 transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex size-10 items-center justify-center rounded-xl border ${styling.iconBg}`}
                          >
                            <IconComponent className="size-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white">{agent.name}</h3>
                            <p className="text-[11px] text-slate-400">{agent.role}</p>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                            agent.status === "ERROR"
                              ? "bg-rose-950 text-rose-300 border-rose-800"
                              : agent.status === "ONLINE"
                                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              agent.status === "ONLINE"
                                ? "bg-emerald-400 animate-pulse"
                                : agent.status === "ERROR"
                                  ? "bg-rose-400"
                                  : "bg-slate-500"
                            }`}
                          />
                          {agent.status}
                        </span>
                      </div>

                      {/* Execution Statistics */}
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 my-3 text-center">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Tasks
                          </p>
                          <p className="text-sm font-bold text-white mt-0.5 font-display">
                            {agent.tasks_processed}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Error Rate
                          </p>
                          <p className="text-sm font-bold text-slate-200 mt-0.5 font-display">
                            {agent.error_rate}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            Last Active
                          </p>
                          <p className="text-xs font-semibold text-slate-300 mt-0.5">
                            {agent.last_active
                              ? new Date(agent.last_active).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Idle"}
                          </p>
                        </div>
                      </div>

                      {/* Last Event / Action */}
                      <div className="text-xs text-slate-400 space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Recent Operation
                        </span>
                        <p className="text-slate-200 text-xs truncate bg-slate-950/60 rounded px-2.5 py-1.5 border border-slate-800/80 font-mono">
                          {agent.last_action}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Activity Stream Feed */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <Radio className="size-4 text-emerald-400 animate-pulse" />
              <h3 className="text-sm font-bold text-white font-display">
                Real-Time Multi-Citizen Event Stream
              </h3>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 font-mono">
                LIVE
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Showing recent agent actions executed in LangGraph backend
            </span>
          </div>

          {eventsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="size-5 animate-spin text-brand mr-2" />
              <span className="text-xs">Streaming events from database...</span>
            </div>
          ) : events.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No recent agent events. Trigger an assistant query or upload a document to view
              real-time operations.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/40 scrollbar-none">
              {events.map((e) => {
                const styling = AGENT_COLORS[e.agent_name?.toLowerCase().replace(" agent", "")] || {
                  badge: "bg-slate-800 text-slate-300 border-slate-700",
                  text: "text-slate-300",
                };

                return (
                  <div
                    key={e.id}
                    className="pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold border shrink-0 ${styling.badge}`}
                      >
                        {e.agent_name}
                      </span>
                      <p className="text-slate-200 text-xs font-medium truncate">{e.action}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px] text-slate-500 font-mono">
                      {e.run_id && (
                        <span className="rounded bg-slate-950 px-1.5 py-0.5 border border-slate-800 text-slate-400">
                          run:{e.run_id.slice(0, 8)}
                        </span>
                      )}
                      <span>{new Date(e.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
