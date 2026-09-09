import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bot,
  ShieldCheck,
  SearchCheck,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  Activity,
  Zap,
  ArrowRight,
  ArrowDown,
  X,
  Lock,
  FileKey,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";

export const Route = createFileRoute("/admin/agents")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  component: AdminAgentsPage,
});

const AGENTS_DATA = [
  {
    id: "citizen",
    name: "Citizen Agent",
    role: "Understands citizen intent and context",
    status: "ONLINE",
    task: "Awaiting input",
    input: "Natural language query",
    output: "Structured intent & profile",
    lastActive: "Just now",
    confidence: "98%",
    icon: ShieldCheck,
    color: "text-blue-600",
    bg: "bg-blue-100",
    border: "border-blue-200",
  },
  {
    id: "scheme",
    name: "Scheme Agent",
    role: "Retrieves potentially relevant schemes",
    status: "PROCESSING",
    task: "Querying knowledge base",
    input: "Citizen intent",
    output: "Candidate schemes list",
    lastActive: "2s ago",
    confidence: "94%",
    icon: SearchCheck,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    border: "border-indigo-200",
  },
  {
    id: "eligibility",
    name: "Eligibility Agent",
    role: "Evaluates structured eligibility criteria",
    status: "WAITING",
    task: "Idle",
    input: "Citizen profile & Scheme criteria",
    output: "Eligibility result & Missing requirements",
    lastActive: "1m ago",
    confidence: "99%",
    icon: ClipboardCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    border: "border-emerald-200",
  },
  {
    id: "document",
    name: "Document Agent",
    role: "Validates supporting documents",
    status: "ACTION REQUIRED",
    task: "Waiting for Income Certificate",
    input: "Uploaded file",
    output: "Extracted fields & validation score",
    lastActive: "5m ago",
    confidence: "96%",
    icon: FileCheck2,
    color: "text-amber-600",
    bg: "bg-amber-100",
    border: "border-amber-200",
  },
  {
    id: "application",
    name: "Application Agent",
    role: "Prepares applications",
    status: "COMPLETED",
    task: "Draft generated",
    input: "Verified eligibility & docs",
    output: "Application draft payload",
    lastActive: "10m ago",
    confidence: "99%",
    icon: FileText,
    color: "text-purple-600",
    bg: "bg-purple-100",
    border: "border-purple-200",
  },
  {
    id: "tracker",
    name: "Tracker Agent",
    role: "Monitors progress and identifies next actions",
    status: "ONLINE",
    task: "Monitoring active submissions",
    input: "Government portal status",
    output: "Actionable notifications",
    lastActive: "1hr ago",
    confidence: "100%",
    icon: Landmark,
    color: "text-rose-600",
    bg: "bg-rose-100",
    border: "border-rose-200",
  },
];

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getRecentAgentEvents } from "@/lib/admin-services";

function AdminAgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<(typeof AGENTS_DATA)[0] | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  // Load initial events and subscribe to live agent_events across all runs
  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      const initial = await getRecentAgentEvents();
      if (isMounted) setEvents(initial);
    }
    loadEvents();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel("admin_agent_events")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "agent_events" },
          (payload) => {
            const row = payload.new as any;
            const newEv = {
              id: row.id,
              run_id: row.run_id,
              timestamp: new Date(row.created_at || Date.now()).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
              agent: row.agent_name,
              action: row.action,
            };
            setEvents((prev) => [newEv, ...prev]);
          },
        )
        .subscribe();

      return () => {
        isMounted = false;
        supabase.removeChannel(channel);
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full items-center px-5">
          <Link to="/" className="flex items-center gap-2 mr-8 text-foreground hover:text-brand">
            <span className="grid size-8 place-items-center rounded-lg bg-slate-900 font-display text-sm font-semibold text-white">
              S
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak Admin</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground">
              Overview
            </Link>
            <Link to="/admin/agents" className="text-foreground">
              AI Workforce
            </Link>
            <Link to="/admin/schemes" className="text-muted-foreground hover:text-foreground">
              Knowledge Base
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full px-5 py-8 mx-auto max-w-[1400px] grid grid-cols-1 xl:grid-cols-12 gap-8 relative">
        {/* LEFT COLUMN: Workforce Graph & Trust Center */}
        <div className="xl:col-span-3 space-y-8">
          <div className="bg-card rounded-xl border border-line p-5 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Collaboration Flow
              </h3>
              <span className="inline-flex items-center gap-1.5 text-xs text-sage font-medium">
                <span className="size-2 rounded-full bg-sage animate-pulse" /> Live Realtime
              </span>
            </div>

            <div className="flex flex-col items-center">
              <FlowBox label="Citizen" />
              <FlowArrow />

              <FlowBox
                label="Citizen Agent"
                agentId="citizen"
                onClick={() => setSelectedAgent(AGENTS_DATA[0])}
              />
              <FlowArrow />

              <FlowBox
                label="Scheme Agent"
                agentId="scheme"
                onClick={() => setSelectedAgent(AGENTS_DATA[1])}
              />
              <FlowArrow />

              <FlowBox
                label="Eligibility Agent"
                agentId="eligibility"
                onClick={() => setSelectedAgent(AGENTS_DATA[2])}
              />
              <FlowArrow />

              <FlowBox
                label="Document Agent"
                agentId="document"
                onClick={() => setSelectedAgent(AGENTS_DATA[3])}
              />
              <FlowArrow />

              <FlowBox
                label="Eligibility Agent"
                agentId="eligibility"
                onClick={() => setSelectedAgent(AGENTS_DATA[2])}
              />
              <FlowArrow />

              <FlowBox
                label="Application Agent"
                agentId="application"
                onClick={() => setSelectedAgent(AGENTS_DATA[4])}
              />
              <FlowArrow />

              <FlowBox label="Human Approval" highlight />
              <FlowArrow />

              <FlowBox label="Government Portal" />
              <FlowArrow />

              <FlowBox
                label="Tracker Agent"
                agentId="tracker"
                onClick={() => setSelectedAgent(AGENTS_DATA[5])}
              />
              <FlowArrow />

              <FlowBox label="Citizen" />
            </div>
          </div>

          <div className="bg-brand text-primary-foreground rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="size-5" />
              <h3 className="font-semibold">Trust & Safety</h3>
            </div>
            <p className="text-sm text-primary-foreground/80 mb-4 border-b border-primary-foreground/20 pb-4">
              "Your data stays under your control"
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <p className="font-semibold uppercase tracking-wider text-primary-foreground/60 mb-2">
                  AI Can
                </p>
                <ul className="space-y-1 pl-4 list-disc marker:text-primary-foreground/50">
                  <li>Research & Compare</li>
                  <li>Verify & Validate</li>
                  <li>Prepare drafts</li>
                  <li>Monitor status</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-wider text-primary-foreground/60 mb-2">
                  AI Cannot Do Without You
                </p>
                <ul className="space-y-1 pl-4 list-disc marker:text-amber-300">
                  <li>Submit applications</li>
                  <li>Share sensitive documents</li>
                  <li>Authorize official actions</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Agent Cards */}
        <div className="xl:col-span-6 space-y-6">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2">
              AI Workforce Control Center
            </h1>
            <p className="text-muted-foreground">
              Manage and monitor specialized agents in the Sahayak ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AGENTS_DATA.map((agent) => (
              <div
                key={agent.id}
                className="bg-card rounded-xl border border-line p-5 shadow-sm hover:border-brand/50 transition-colors cursor-pointer relative overflow-hidden"
                onClick={() => setSelectedAgent(agent)}
              >
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${agent.bg.replace("bg-", "bg-").replace("100", "400")}`}
                />

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-10 place-items-center rounded-lg ${agent.bg} ${agent.color}`}
                    >
                      <agent.icon className="size-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{agent.name}</h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mt-1 ${getStatusColor(agent.status)}`}
                      >
                        {agent.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Confidence
                    </p>
                    <p className="font-semibold text-sage">{agent.confidence}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground line-clamp-1">{agent.role}</p>
                  <div className="pt-3 border-t border-line grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="block text-muted-foreground mb-0.5">Input</span>
                      <span className="font-medium line-clamp-1">{agent.input}</span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground mb-0.5">Output</span>
                      <span className="font-medium line-clamp-1">{agent.output}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Activity Stream */}
        <div className="xl:col-span-3">
          <div className="bg-card rounded-xl border border-line shadow-sm h-full max-h-[800px] flex flex-col">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-brand" />
                <h3 className="font-semibold text-sm uppercase tracking-wider">
                  Live Activity Stream
                </h3>
              </div>
              {simMode && <span className="flex size-2 rounded-full bg-rose-500 animate-pulse" />}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {events.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 py-12">
                  <Activity className="size-8 mb-2" />
                  <p className="text-sm">Listening for real-time agent events...</p>
                </div>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="animate-in fade-in slide-in-from-right-4 p-3 rounded-lg bg-ice-2 border border-line text-sm"
                  >
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                      <span className="font-semibold text-foreground">{event.agent}</span>
                      <span className="font-mono text-[11px]">{event.timestamp}</span>
                    </div>
                    <p className="font-medium text-xs leading-relaxed text-foreground/90">{event.action}</p>
                    {event.run_id && (
                      <div className="mt-1.5 pt-1.5 border-t border-line/60 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>Run: #{event.run_id.slice(0, 8)}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Side Drawer for Agent Details */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md h-full bg-card border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
            <div className="p-6 border-b border-line flex items-center justify-between bg-ice-2">
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-10 place-items-center rounded-lg ${selectedAgent.bg} ${selectedAgent.color}`}
                >
                  <selectedAgent.icon className="size-5" />
                </span>
                <div>
                  <h2 className="font-display font-semibold text-lg">{selectedAgent.name}</h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mt-0.5 ${getStatusColor(selectedAgent.status)}`}
                  >
                    {selectedAgent.status}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAgent(null)}>
                <X className="size-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Role
                </h4>
                <p className="text-foreground">{selectedAgent.role}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Current Task
                </h4>
                <div className="flex items-center gap-2 p-3 bg-ice-2 rounded-lg border border-line">
                  <Zap className="size-4 text-brand" />
                  <span className="font-medium text-sm">{selectedAgent.task}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Input
                  </h4>
                  <div className="p-3 bg-card border border-line rounded-lg text-sm">
                    {selectedAgent.input}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Output
                  </h4>
                  <div className="p-3 bg-card border border-line rounded-lg text-sm">
                    {selectedAgent.output}
                  </div>
                </div>
              </div>

              <div className="border-t border-line pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Latest Audit Record
                  </h4>
                  <span className="text-xs font-mono text-muted-foreground">20:41:05</span>
                </div>
                <div className="p-4 rounded-xl border border-line bg-card shadow-sm space-y-4">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Action</span>
                    <span className="font-medium text-sm">Checked household income criterion</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Evidence Used</span>
                    <div className="flex items-center gap-2 text-sm bg-ice-2 p-2 rounded w-fit border border-line">
                      <FileKey className="size-3.5 text-muted-foreground" /> Income Certificate
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Result Summary</span>
                    <span className="font-medium text-sm text-sage flex items-center gap-1">
                      <Bot className="size-4" /> Condition verified successfully.
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center mt-3 uppercase tracking-wider">
                  Chain-of-thought is hidden. Audit summaries only.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowBox({
  label,
  highlight = false,
  agentId,
  onClick,
  active = false,
}: {
  label: string;
  highlight?: boolean;
  agentId?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-medium text-center border-2 transition-all w-48 ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${highlight ? "bg-amber-100 border-amber-300 text-amber-900" : active ? "bg-brand text-white border-brand shadow-[0_0_15px_rgba(37,99,235,0.5)]" : agentId ? "bg-card border-brand/40 hover:border-brand" : "bg-ice-2 border-line text-muted-foreground"}`}
    >
      {label}
    </div>
  );
}

function FlowArrow({ active = false }: { active?: boolean }) {
  return (
    <div
      className={`h-6 w-0.5 my-1 flex items-end justify-center transition-colors ${active ? "bg-brand" : "bg-line"}`}
    >
      <ArrowDown
        className={`size-3 translate-y-2 transition-colors ${active ? "text-brand" : "text-line"}`}
      />
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case "ONLINE":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "PROCESSING":
      return "bg-brand/10 text-brand border-brand/20";
    case "WAITING":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "ACTION REQUIRED":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "COMPLETED":
      return "bg-purple-100 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
