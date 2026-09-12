import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  FileText,
  CheckCircle2,
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
  FileCheck2,
  Search,
  Filter,
  ScrollText,
  AlertTriangle,
  Send,
  MessageSquareQuote,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  getAdminMetrics,
  getPendingReviewApplications,
  reviewApplication,
  getAuditLogs,
  type PendingReviewApplication,
  type AuditLogEntry,
} from "@/lib/admin-services";

export const Route = createFileRoute("/admin/")({
  beforeLoad: async () => {
    await requireAdmin();
  },
  head: () => ({
    meta: [
      { title: "Control Center — Sahayak Admin Console" },
      {
        name: "description",
        content: "Live supervisory metrics, AI agent tracking, and human review queue.",
      },
    ],
  }),
  component: AdminControlCenter,
});

function AdminControlCenter() {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<PendingReviewApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | "request_info" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Queries
  const metricsQuery = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: getAdminMetrics,
    refetchInterval: 10000,
  });

  const queueQuery = useQuery({
    queryKey: ["admin", "queue", statusFilter],
    queryFn: () => getPendingReviewApplications(statusFilter),
    refetchInterval: 10000,
  });

  const auditQuery = useQuery({
    queryKey: ["admin", "auditLogs"],
    queryFn: () => getAuditLogs(30),
    enabled: showAuditLogs,
  });

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: async ({
      appId,
      action,
      notes,
    }: {
      appId: string;
      action: "approved" | "rejected" | "request_info";
      notes: string;
    }) => {
      const res = await reviewApplication(appId, action, notes);
      if (!res.ok) throw new Error(res.error);
      return { appId, action };
    },
    onSuccess: (data) => {
      const actionText =
        data.action === "approved" ? "Approved" : data.action === "rejected" ? "Rejected" : "Information Requested";
      toast.success(`Application ${actionText}`, {
        description: "Application decision committed to database and recorded in immutable audit log.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      setReviewAction(null);
      setActionReason("");
      setSelectedApp(null);
    },
    onError: (err: any) => {
      toast.error("Action Failed", { description: err.message });
    },
  });

  const handleOpenReviewModal = (app: PendingReviewApplication, action: "approved" | "rejected" | "request_info") => {
    setSelectedApp(app);
    setReviewAction(action);
    setActionReason(
      action === "approved"
        ? "Verified applicant eligibility criteria and validated required supporting documents."
        : "",
    );
  };

  const handleCommitReview = () => {
    if (!selectedApp || !reviewAction) return;
    if (!actionReason.trim()) {
      toast.error("Mandatory Justification Required", {
        description: "Please enter a specific reason or note for this supervisory decision.",
      });
      return;
    }
    reviewMutation.mutate({
      appId: selectedApp.id,
      action: reviewAction,
      notes: actionReason.trim(),
    });
  };

  const metrics = metricsQuery.data;
  const queue = queueQuery.data || [];

  const filteredQueue = queue.filter((item) => {
    const matchesSearch =
      item.tracking_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.citizen_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.scheme_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <AdminLayout
      title="Administrative Control Center"
      subtitle="Supervise civic workflows, resolve flagged applications, and monitor live AI workforce operations."
    >
      <div className="space-y-8">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Card 1: Active Citizens */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Active Citizens</span>
              <Users className="size-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold font-display text-white">
              {metricsQuery.isLoading ? "—" : metrics?.active_citizens.toLocaleString() || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Registered profiles</p>
          </div>

          {/* Card 2: Total Applications */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Applications</span>
              <FileText className="size-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-bold font-display text-white">
              {metricsQuery.isLoading ? "—" : metrics?.applications_total.toLocaleString() || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics?.applications_by_status.approved || 0} approved · {metrics?.applications_by_status.rejected || 0} rejected
            </p>
          </div>

          {/* Card 3: Documents Verified */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Docs Verified</span>
              <FileCheck2 className="size-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold font-display text-white">
              {metricsQuery.isLoading ? "—" : metrics?.documents_verified.toLocaleString() || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Via Gemini Vision OCR</p>
          </div>

          {/* Card 4: Agent Tasks */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Agent Tasks</span>
              <Activity className="size-4 text-purple-400" />
            </div>
            <p className="text-2xl font-bold font-display text-white">
              {metricsQuery.isLoading ? "—" : metrics?.agent_tasks_completed.toLocaleString() || 0}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Executed across runs</p>
          </div>

          {/* Card 5: Avg Workflow Duration */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Avg Dwell Time</span>
              <Clock className="size-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold font-display text-white">
              {metricsQuery.isLoading ? "—" : metrics?.avg_workflow_time || "0s"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Start to completion</p>
          </div>

          {/* Card 6: Needing Review */}
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 shadow-sm">
            <div className="flex items-center justify-between text-rose-300 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Needs Review</span>
              <AlertCircle className="size-4 text-rose-400" />
            </div>
            <p className="text-2xl font-bold font-display text-rose-200">
              {metricsQuery.isLoading ? "—" : metrics?.applications_requiring_review || 0}
            </p>
            <p className="text-[11px] text-rose-400/80 mt-1">Awaiting human sign-off</p>
          </div>
        </div>

        {/* Action Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
              <Shield className="size-5 text-brand" />
              Human Supervisory Review Queue
            </h2>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
              {filteredQueue.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search citizen or scheme..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand"
            >
              <option value="all">All Pending</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="awaiting_approval">Awaiting Approval</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin"] })}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 h-8 text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1.5 ${queueQuery.isRefetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 h-8 text-xs"
            >
              <ScrollText className="size-3.5 mr-1.5 text-indigo-400" />
              {showAuditLogs ? "Hide Audit Log" : "Audit Trail"}
            </Button>
          </div>
        </div>

        {/* Audit Log Drawer if open */}
        {showAuditLogs && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ScrollText className="size-4 text-indigo-400" />
                Immutable System & Human Audit Trail
              </h3>
              <span className="text-[11px] text-slate-400">Cryptographically ordered & persisted</span>
            </div>

            {auditQuery.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-slate-400" />
              </div>
            ) : (auditQuery.data || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No audit log entries found.</p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {(auditQuery.data || []).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{entry.agent_name}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                          {entry.action}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            entry.result === "APPROVED" || entry.result === "ACTIVE"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : entry.result === "REJECTED"
                              ? "bg-rose-950 text-rose-300 border border-rose-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {entry.result}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">{entry.evidence}</p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                      {new Date(entry.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Review Queue Table / List */}
        {queueQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
            <Loader2 className="size-8 animate-spin text-brand" />
            <p className="text-sm">Loading live review queue from database...</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
            <CheckCircle2 className="size-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">Review Queue Clear</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              All submitted applications have been processed or no pending cases match your active filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQueue.map((app) => (
              <div
                key={app.id}
                className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm hover:border-slate-700 transition-all space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded">
                      {app.tracking_id}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white">{app.citizen_name}</h4>
                      <p className="text-xs text-slate-400">
                        {app.citizen_location || "Location not specified"} {app.citizen_phone ? `· ${app.citizen_phone}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                        app.status === "approved"
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50"
                          : app.status === "rejected"
                          ? "bg-rose-950/80 text-rose-300 border border-rose-800/50"
                          : "bg-amber-950/80 text-amber-300 border border-amber-800/50"
                      }`}
                    >
                      {app.status.replace("_", " ")}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {new Date(app.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Scheme & Applicant Info Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Landmark className="size-3.5 text-indigo-400" />
                      Applied Welfare Scheme
                    </span>
                    <p className="font-bold text-white text-sm">{app.scheme_name}</p>
                    {app.scheme_category && (
                      <p className="text-slate-400 text-[11px]">Category: {app.scheme_category}</p>
                    )}
                  </div>

                  <div className="space-y-1.5 rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileCheck2 className="size-3.5 text-emerald-400" />
                      Applicant Attributes & Extracted Fields
                    </span>
                    <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                      {Object.keys(app.applicant_info || {}).length > 0 ? (
                        Object.entries(app.applicant_info).map(([k, v]) => (
                          <div key={k} className="flex justify-between text-[11px]">
                            <span className="text-slate-400">{k}:</span>
                            <span className="text-slate-200 font-medium">{String(v)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-500 italic">No custom fields extracted.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Admin Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <MessageSquareQuote className="size-3 text-slate-500" />
                    <span>Supervisory sign-off required for final civic sanction.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenReviewModal(app, "request_info")}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 h-8 text-xs font-medium"
                    >
                      <Send className="size-3.5 mr-1 text-amber-400" />
                      Request Info
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenReviewModal(app, "rejected")}
                      className="bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 h-8 text-xs font-medium"
                    >
                      <X className="size-3.5 mr-1" />
                      Reject
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleOpenReviewModal(app, "approved")}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm h-8 text-xs font-medium"
                    >
                      <Check className="size-3.5 mr-1" />
                      Approve Scheme
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Confirmation Modal with Mandatory Reason Field */}
      <Dialog
        open={Boolean(selectedApp && reviewAction)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedApp(null);
            setReviewAction(null);
            setActionReason("");
          }
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2 font-display">
              {reviewAction === "approved" ? (
                <>
                  <CheckCircle2 className="size-5 text-emerald-400" />
                  Approve Application
                </>
              ) : reviewAction === "rejected" ? (
                <>
                  <AlertTriangle className="size-5 text-rose-400" />
                  Reject Application
                </>
              ) : (
                <>
                  <Send className="size-5 text-amber-400" />
                  Request More Information
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {selectedApp && (
                <span>
                  Case Tracking ID: <strong className="text-slate-200 font-mono">{selectedApp.tracking_id}</strong> (
                  {selectedApp.citizen_name})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Mandatory Reviewer Notes / Justification:</span>
                <span className="text-[10px] text-amber-400">Audit Logged</span>
              </label>
              <Textarea
                placeholder={
                  reviewAction === "approved"
                    ? "Enter validation notes regarding eligibility confirmation and verified records..."
                    : reviewAction === "rejected"
                    ? "Specify the regulatory grounds for rejection (e.g., income ceiling exceeded, invalid documents)..."
                    : "Specify the exact missing documents or clarifications required from the citizen..."
                }
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 text-xs min-h-[100px] focus-visible:ring-brand"
              />
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              This action will update the citizen's application state in real-time, generate a citizen portal notification, and write an immutable audit log record.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              disabled={reviewMutation.isPending}
              onClick={() => {
                setSelectedApp(null);
                setReviewAction(null);
              }}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={reviewMutation.isPending}
              onClick={handleCommitReview}
              className={`text-white font-medium ${
                reviewAction === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : reviewAction === "rejected"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-amber-600 hover:bg-amber-500"
              }`}
            >
              {reviewMutation.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Recording Decision...
                </>
              ) : (
                "Confirm & Commit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
