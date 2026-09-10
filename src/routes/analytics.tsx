import { createFileRoute, Link } from "@tanstack/react-router";
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
  LineChart,
  Line,
} from "recharts";
import { FileText, CheckCircle, Shield, AlertCircle, Loader2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import {
  getApplicationsByStage,
  getDocumentVolumeByDay,
  getAgentTaskDistribution,
  getCompletionRateByMonth,
} from "@/lib/analytics-services";
import { getAdminMetrics } from "@/lib/admin-services";

export const Route = createFileRoute("/analytics")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  component: AnalyticsDashboard,
});

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#9333ea", "#0284c7"];

function AnalyticsDashboard() {
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
    queryKey: ["analytics", "volume"],
    queryFn: async () => {
      const res = await getDocumentVolumeByDay(7);
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

  const metrics = metricsQuery.data;

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
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
            <Link to="/admin/agents" className="text-muted-foreground hover:text-foreground">
              AI Workforce
            </Link>
            <Link to="/admin/schemes" className="text-muted-foreground hover:text-foreground">
              Knowledge Base
            </Link>
            <Link to="/analytics" className="text-brand font-semibold">
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full px-5 py-8 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2">Platform Analytics</h1>
            <p className="text-muted-foreground">
              Real-time platform usage, multi-agent workforce tasks, and citizen outcome metrics.
            </p>
          </div>
        </div>

        {/* Top Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <MetricCard
            title="Applications Processed"
            value={metrics ? metrics.applications_processed.toLocaleString() : "—"}
            icon={<FileText className="size-5 text-brand" />}
            isLoading={metricsQuery.isLoading}
          />
          <MetricCard
            title="Documents Verified"
            value={metrics ? metrics.documents_verified.toLocaleString() : "—"}
            icon={<CheckCircle className="size-5 text-sage" />}
            isLoading={metricsQuery.isLoading}
          />
          <MetricCard
            title="Needs Human Review"
            value={metrics ? metrics.applications_requiring_review.toString() : "—"}
            icon={<Shield className="size-5 text-amber" />}
            highlight={Boolean(metrics && metrics.applications_requiring_review > 0)}
            isLoading={metricsQuery.isLoading}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Applications by Stage */}
          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Applications by Stage</h3>
            <div className="h-[300px]">
              {stagesQuery.isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading stage metrics...
                </div>
              ) : stagesQuery.isError ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <AlertCircle className="size-5 text-coral" />
                  <p>Unable to load stage analytics</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stagesQuery.data || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ fill: "#f3f4f6" }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Document Volume */}
          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Document Verification Volume (Trailing 7 Days)</h3>
            <div className="h-[300px]">
              {volumeQuery.isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading document volume...
                </div>
              ) : volumeQuery.isError ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <AlertCircle className="size-5 text-coral" />
                  <p>Unable to load document volume</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeQuery.data || []}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#16a34a"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Agent Task Distribution */}
          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Agent Task Distribution</h3>
            <div className="h-[300px] flex items-center justify-center">
              {tasksQuery.isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading agent tasks...
                </div>
              ) : tasksQuery.isError ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <AlertCircle className="size-5 text-coral" />
                  <p>Unable to load agent tasks</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tasksQuery.data || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(tasksQuery.data || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Completion Rate */}
          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Completion & Sanction Rate (%)</h3>
            <div className="h-[300px]">
              {completionQuery.isLoading ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <Loader2 className="size-4 animate-spin" /> Loading completion rates...
                </div>
              ) : completionQuery.isError ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <AlertCircle className="size-5 text-coral" />
                  <p>Unable to load completion rates</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={completionQuery.data || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#6b7280", fontSize: 12 }}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="#9333ea"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#9333ea" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  highlight = false,
  isLoading = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
  isLoading?: boolean;
}) {
  return (
    <div
      className={`p-6 rounded-xl border ${highlight ? "border-amber/30 bg-amber/5" : "border-line bg-card"} shadow-sm flex items-center justify-between`}
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold font-display">{isLoading ? "..." : value}</p>
      </div>
      <div className="p-3 rounded-xl bg-card shadow-sm border border-line">{icon}</div>
    </div>
  );
}
