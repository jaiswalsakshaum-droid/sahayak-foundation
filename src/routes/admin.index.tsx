import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";
import { Users, FileText, CheckCircle, Clock, Activity, Shield } from "lucide-react";
import { MOCK_ADMIN_METRICS } from "@/lib/admin-services";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea'];

const appsByStageData = [
  { name: 'Matched', count: 4200 },
  { name: 'Verifying', count: 2800 },
  { name: 'Drafted', count: 1500 },
  { name: 'Submitted', count: 3100 },
  { name: 'Approved', count: 1800 },
];

const docVolumeData = [
  { name: 'Mon', count: 1200 },
  { name: 'Tue', count: 1900 },
  { name: 'Wed', count: 1500 },
  { name: 'Thu', count: 2200 },
  { name: 'Fri', count: 2800 },
  { name: 'Sat', count: 1100 },
  { name: 'Sun', count: 900 },
];

const agentTaskData = [
  { name: 'Scheme Agent', value: 35 },
  { name: 'Eligibility Agent', value: 25 },
  { name: 'Document Agent', value: 20 },
  { name: 'Application Agent', value: 15 },
  { name: 'Tracker Agent', value: 5 },
];

function AdminDashboard() {
  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full items-center px-5">
           <Link to="/" className="flex items-center gap-2 mr-8 text-foreground hover:text-brand">
             <span className="grid size-8 place-items-center rounded-lg bg-slate-900 font-display text-sm font-semibold text-white">S</span>
             <span className="font-display font-semibold hidden sm:block">Sahayak Admin</span>
           </Link>
           <nav className="flex items-center gap-6 text-sm font-medium">
             <Link to="/admin" className="text-foreground">Overview</Link>
             <Link to="/admin/agents" className="text-muted-foreground hover:text-foreground">AI Workforce</Link>
             <Link to="/admin/schemes" className="text-muted-foreground hover:text-foreground">Knowledge Base</Link>
           </nav>
        </div>
      </header>

      <main className="flex-1 w-full px-5 py-8 mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2">Control Center</h1>
            <p className="text-muted-foreground">Monitor AI workforce performance and platform metrics.</p>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
           <MetricCard title="Active Citizens" value={MOCK_ADMIN_METRICS.active_citizens.toLocaleString()} icon={<Users className="size-5 text-brand" />} />
           <MetricCard title="Applications Processed" value={MOCK_ADMIN_METRICS.applications_processed.toLocaleString()} icon={<FileText className="size-5 text-sage" />} />
           <MetricCard title="Documents Verified" value={MOCK_ADMIN_METRICS.documents_verified.toLocaleString()} icon={<CheckCircle className="size-5 text-emerald-600" />} />
           <MetricCard title="Agent Tasks Completed" value={MOCK_ADMIN_METRICS.agent_tasks_completed.toLocaleString()} icon={<Activity className="size-5 text-violet-600" />} />
           <MetricCard title="Avg Workflow Time" value={MOCK_ADMIN_METRICS.avg_workflow_time} icon={<Clock className="size-5 text-amber" />} />
           <MetricCard title="Needs Human Review" value={MOCK_ADMIN_METRICS.applications_requiring_review.toString()} icon={<Shield className="size-5 text-rose-500" />} highlight />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Applications by Stage</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appsByStageData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Document Verification Volume</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={docVolumeData}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Area type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-line p-6 shadow-sm">
            <h3 className="font-semibold mb-6">Agent Task Distribution</h3>
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentTaskData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {agentTaskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col gap-2 pointer-events-none">
                {agentTaskData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="size-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
        
      </main>
    </div>
  );
}

function MetricCard({ title, value, icon, highlight = false }: { title: string, value: string, icon: React.ReactNode, highlight?: boolean }) {
  return (
    <div className={`p-6 rounded-xl border ${highlight ? 'border-rose-200 bg-rose-50/50' : 'border-line bg-card'} shadow-sm flex items-center justify-between`}>
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className="p-3 rounded-xl bg-white shadow-sm border border-line">
        {icon}
      </div>
    </div>
  )
}
