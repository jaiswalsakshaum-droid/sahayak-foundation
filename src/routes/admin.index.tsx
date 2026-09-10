import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  FileText,
  CheckCircle,
  Clock,
  Activity,
  Shield,
  Check,
  X,
  Loader2,
  RefreshCw,
  Eye,
  AlertCircle,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminMetrics,
  getPendingReviewApplications,
  reviewApplication,
  type PendingReviewApplication,
} from "@/lib/admin-services";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<PendingReviewApplication | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isSweeping, setIsSweeping] = useState(false);

  // Queries
  const metricsQuery = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: getAdminMetrics,
  });

  const queueQuery = useQuery({
    queryKey: ["admin", "queue"],
    queryFn: getPendingReviewApplications,
  });

  // Review Mutations
  const approveMutation = useMutation({
    mutationFn: async (appId: string) => {
      const res = await reviewApplication(appId, "approved", "Approved by human reviewer.");
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("Application Approved", {
        description: "Application approved and recorded in immutable audit log.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      setSelectedApp(null);
    },
    onError: (err: any) => {
      toast.error("Approval Failed", { description: err.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ appId, reason }: { appId: string; reason: string }) => {
      const res = await reviewApplication(appId, "rejected", reason);
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("Application Rejected", {
        description: "Status updated and reason logged to audit trail.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedApp(null);
    },
    onError: (err: any) => {
      toast.error("Rejection Failed", { description: err.message });
    },
  });

  const triggerTrackerSweep = async () => {
    setIsSweeping(true);
    try {
      if (isSupabaseConfigured) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/tracker-sweep`;
        const { data: sessionData } = await supabase.auth.getSession();

        const res = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData?.session?.access_token || ""}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({}),
        });

        if (res.ok) {
          toast.success("Tracker Sweep Triggered", {
            description:
              "Tracker Agent is scanning active review SLAs and writing timeline events.",
          });
        } else {
          toast.info("Tracker Sweep Dispatched", {
            description: "Sweep command transmitted to workforce runtime.",
          });
        }
      } else {
        toast.info("Local Demo Tracker Sweep", {
          description: "Tracker agent simulated scan completed.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (e: any) {
      toast.error("Tracker sweep dispatch notice", { description: e.message });
    } finally {
      setIsSweeping(false);
    }
  };

  const metrics = metricsQuery.data;
  const queue = queueQuery.data || [];

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
            <Link to="/admin" className="text-brand font-semibold">
              Overview & Queue
            </Link>
            <Link to="/admin/agents" className="text-muted-foreground hover:text-foreground">
              AI Workforce
            </Link>
            <Link to="/admin/schemes" className="text-muted-foreground hover:text-foreground">
              Knowledge Base
            </Link>
            <Link to="/analytics" className="text-muted-foreground hover:text-foreground">
              Analytics
            </Link>
          </nav>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={triggerTrackerSweep}
              disabled={isSweeping}
              className="gap-1.5 bg-card text-xs font-medium"
            >
              {isSweeping ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5 text-brand" />
              )}
              <span>Trigger Tracker Sweep</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-5 py-8 mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-display font-semibold mb-2">Control Center</h1>
          <p className="text-muted-foreground">
            Monitor real-time AI workforce metrics and perform human supervisory approvals.
          </p>
        </div>

        {/* Aggregate Live Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <MetricCard
            title="Active Citizens"
            value={metrics ? metrics.active_citizens.toLocaleString() : "—"}
            icon={<Users className="size-4 text-brand" />}
          />
          <MetricCard
            title="Applications"
            value={metrics ? metrics.applications_processed.toLocaleString() : "—"}
            icon={<FileText className="size-4 text-brand" />}
          />
          <MetricCard
            title="Docs Verified"
            value={metrics ? metrics.documents_verified.toLocaleString() : "—"}
            icon={<CheckCircle className="size-4 text-sage" />}
          />
          <MetricCard
            title="Agent Tasks"
            value={metrics ? metrics.agent_tasks_completed.toLocaleString() : "—"}
            icon={<Activity className="size-4 text-brand" />}
          />
          <MetricCard
            title="Avg Workflow"
            value={metrics ? metrics.avg_workflow_time : "—"}
            icon={<Clock className="size-4 text-brand-soft" />}
          />
          <MetricCard
            title="Needs Review"
            value={metrics ? `${metrics.applications_requiring_review}` : "0"}
            icon={<Shield className="size-4 text-amber" />}
            highlight={Boolean(metrics && metrics.applications_requiring_review > 0)}
          />
        </div>

        {/* Human Supervisory Review Queue */}
        <div className="bg-card rounded-xl border border-line p-6 shadow-none space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold font-display">Human Supervisory Review Queue</h2>
              <p className="text-xs text-muted-foreground">
                Submitted applications awaiting human verification before final sanction. Decisions
                are written to immutable audit logs.
              </p>
            </div>
            <span className="text-xs font-semibold bg-amber/10 text-amber px-2.5 py-1 rounded-full border border-amber/20">
              {queue.length} Pending
            </span>
          </div>

          {queueQuery.isLoading ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading review queue...
            </div>
          ) : queue.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground border-2 border-dashed border-line rounded-xl">
              <CheckCircle className="size-8 mx-auto text-sage mb-2 opacity-60" />
              <p className="font-medium text-foreground">Review Queue is Empty</p>
              <p className="text-xs mt-1">All citizen applications are processed and up to date.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-line overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-ice-2 text-muted-foreground border-b border-line">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tracking ID</th>
                    <th className="px-4 py-3 font-semibold">Applicant</th>
                    <th className="px-4 py-3 font-semibold">Scheme</th>
                    <th className="px-4 py-3 font-semibold">Stage</th>
                    <th className="px-4 py-3 font-semibold">Submitted</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-card">
                  {queue.map((app) => (
                    <tr key={app.id} className="hover:bg-ice-2/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-brand">
                        {app.tracking_id}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{app.citizen_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{app.scheme_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber/10 text-amber px-2 py-0.5 text-[10px] font-medium border border-amber/20">
                          {app.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {app.created_at ? new Date(app.created_at).toLocaleDateString() : "Today"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => setSelectedApp(app)}
                          >
                            <Eye className="size-3.5" /> Details
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1 bg-sage hover:bg-sage/90 text-primary-foreground"
                            disabled={approveMutation.isPending}
                            onClick={() => approveMutation.mutate(app.id)}
                          >
                            <Check className="size-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs gap-1 border-coral/30 text-coral hover:bg-coral/10"
                            onClick={() => {
                              setSelectedApp(app);
                              setRejectDialogOpen(true);
                            }}
                          >
                            <X className="size-3.5" /> Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Detail View Modal */}
      <Dialog open={!!selectedApp && !rejectDialogOpen} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="max-w-xl">
          {selectedApp && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-display">
                  Review Application: {selectedApp.tracking_id}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedApp.scheme_name} · {selectedApp.citizen_name}
                </p>
              </DialogHeader>

              <div className="mt-4 space-y-4 text-xs">
                <div className="rounded-lg border border-line bg-ice-2/40 p-4 space-y-2">
                  <h4 className="font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Extracted Applicant Data
                  </h4>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {Object.entries(selectedApp.applicant_info).map(([k, v]: [string, any]) => (
                      <div key={k} className="p-2 rounded bg-card border border-line">
                        <span className="text-muted-foreground block text-[10px]">{k}</span>
                        <span className="font-medium text-foreground">
                          {typeof v === "object" ? v.value : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedApp.source_run_id && (
                  <div className="p-3 rounded border border-line bg-card text-muted-foreground flex items-center justify-between">
                    <span>Source Agent Run ID</span>
                    <span className="font-mono text-brand text-[11px]">
                      {selectedApp.source_run_id}
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 pt-4">
                <Button variant="outline" size="sm" onClick={() => setSelectedApp(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  className="bg-sage hover:bg-sage/90 text-primary-foreground"
                  onClick={() => approveMutation.mutate(selectedApp.id)}
                >
                  <Check className="size-3.5 mr-1" /> Approve Application
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-coral/30 text-coral hover:bg-coral/10"
                  onClick={() => setRejectDialogOpen(true)}
                >
                  <X className="size-3.5 mr-1" /> Reject Application
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg text-coral flex items-center gap-2">
              <AlertCircle className="size-5" /> Reject Application
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Please enter the official rejection reason. This will be written to the immutable
              audit log and notified to the citizen.
            </p>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <Textarea
              placeholder="e.g., Annual income exceeds maximum permissible scheme threshold..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="text-xs min-h-[100px]"
            />
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" size="sm" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-coral text-primary-foreground hover:bg-coral/90"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (selectedApp) {
                  rejectMutation.mutate({ appId: selectedApp.id, reason: rejectReason });
                }
              }}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  highlight = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border ${
        highlight ? "border-amber/30 bg-amber/5" : "border-line bg-card"
      } shadow-none flex items-center justify-between`}
    >
      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{title}</p>
        <p className="text-xl font-bold font-display">{value}</p>
      </div>
      <div className="p-2 rounded-lg bg-ice text-brand">{icon}</div>
    </div>
  );
}
