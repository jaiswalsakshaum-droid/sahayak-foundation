import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  FileText,
  CheckCircle2,
  Shield,
  AlertCircle,
  Loader2,
  Download,
  Calendar,
  Layers,
  Activity,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getApplicationsByStage,
  getDocumentVolumeByDay,
  getAgentTaskDistribution,
  getCompletionRateByMonth,
} from "@/lib/analytics-services";
import { getAdminMetrics } from "@/lib/admin-services";

export const Route = createFileRoute("/admin/analytics")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  head: () => ({
    meta: [
      { title: "Analytics & Telemetry — Sahayak Admin" },
      {
        name: "description",
        content: "Aggregated live operational intelligence, bottleneck detection, and civic workflow metrics.",
      },
    ],
  }),
  component: AdminAnalyticsPage,
});

const PIE_COLORS = ["#3b82f6", "#6366f1", "#10b981", "#f59e0b", "#a855f7", "#06b6d4"];

function AdminAnalyticsPage() {
  const [daysFilter, setDaysFilter] = useState(7);

  const metricsQuery = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: getAdminMetrics,
  });

  const stagesQuery = useQuery({
    queryKey: ["analytics", "stages"],
    queryFn: async () => {
      const res = await getApplicationsByStage();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const volumeQuery = useQuery({
    queryKey: ["analytics", "volume", daysFilter],
    queryFn: async () => {
      const res = await getDocumentVolumeByDay(daysFilter);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["analytics", "tasks"],
    queryFn: async () => {
      const res = await getAgentTaskDistribution();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const completionQuery = useQuery({
    queryKey: ["analytics", "completion"],
    queryFn: async () => {
      const res = await getCompletionRateByMonth(6);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
  });

  const exportCSV = () => {
    const rows = [
      ["Metric Category", "Metric Name", "Value"],
      ["Summary", "Active Citizens", metricsQuery.data?.active_citizens || 0],
      ["Summary", "Total Applications", metricsQuery.data?.applications_total || 0],
      ["Summary", "Documents Verified", metricsQuery.data?.documents_verified || 0],
      ["Summary", "Agent Tasks", metricsQuery.data?.agent_tasks_completed || 0],
      ...(stagesQuery.data || []).map((s) => ["Application Stage", s.name, s.count]),
      ...(tasksQuery.data || []).map((t) => ["Agent Task Distribution", t.name, t.value]),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sahayak_admin_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metrics = metricsQuery.data;

  return (
    <AdminLayout
      title="Analytics & Telemetry"
      subtitle="Operational performance charts, bottleneck analysis, and multi-agent workload distribution."
    >
      <div className="space-y-8">
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium">Time Horizon:</span>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDaysFilter(d)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                    daysFilter === d ? "bg-brand text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {d} Days
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 h-9 text-xs flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            Export CSV Audit Report
          </Button>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Applications by Stage (Funnel) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <Layers className="size-4 text-brand" />
                Applications by Workflow Stage
              </h3>
              <p className="text-xs text-slate-400">Distribution of cases across processing states</p>
            </div>

            <div className="h-64 w-full">
              {stagesQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500 text-xs">
                  <Loader2 className="size-5 animate-spin mr-2" /> Loading stages...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stagesQuery.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }}
                    />
                    <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Daily Document Volume */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <FileText className="size-4 text-emerald-400" />
                Document Ingestion & OCR Volume
              </h3>
              <p className="text-xs text-slate-400">Verified documents processed over {daysFilter} days</p>
            </div>

            <div className="h-64 w-full">
              {volumeQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500 text-xs">
                  <Loader2 className="size-5 animate-spin mr-2" /> Loading document volume...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeQuery.data || []}>
                    <defs>
                      <linearGradient id="docVolGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#10b981" fillOpacity={1} fill="url(#docVolGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: Agent Task Distribution */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <Zap className="size-4 text-amber-400" />
                AI Agent Task Distribution
              </h3>
              <p className="text-xs text-slate-400">Workload share executed per agent sub-graph</p>
            </div>

            <div className="h-64 w-full flex items-center">
              {tasksQuery.isLoading ? (
                <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs">
                  <Loader2 className="size-5 animate-spin mr-2" /> Loading task distribution...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tasksQuery.data || []}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name.split(" ")[0]} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {(tasksQuery.data || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 4: Monthly Completion Rate */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 space-y-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <CheckCircle2 className="size-4 text-cyan-400" />
                Application Sanction & Approval Rate (%)
              </h3>
              <p className="text-xs text-slate-400">Percentage of submitted applications reaching approval</p>
            </div>

            <div className="h-64 w-full">
              {completionQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500 text-xs">
                  <Loader2 className="size-5 animate-spin mr-2" /> Loading completion rates...
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completionQuery.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", color: "#fff" }}
                      formatter={(val: any) => [`${val}%`, "Approval Rate"]}
                    />
                    <Bar dataKey="rate" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
