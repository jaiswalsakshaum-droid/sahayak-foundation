import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, ChevronRight, FileText, CheckCircle2, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth, getSession } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CANONICAL_SCHEME_LIST } from "@/lib/scheme-constants";

export const Route = createFileRoute("/applications/")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: ApplicationsPage,
});

interface AppItem {
  id: string;
  schemeName: string;
  status: string;
  date: string;
  actionReady: boolean;
}

const FALLBACK_APPS: AppItem[] = [
  {
    id: "SAH-2026-004281",
    schemeName: "National Means-cum-Merit Scholarship",
    status: "Awaiting your approval",
    date: "Prepared recently",
    actionReady: true,
  },
];

function ApplicationsPage() {
  const [applications, setApplications] = useState<AppItem[]>(FALLBACK_APPS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadApplications() {
      try {
        const session = await getSession();
        if (!session?.user?.id) {
          if (active) setLoading(false);
          return;
        }

        if (!isSupabaseConfigured) {
          if (active) setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("applications")
          .select("*, schemes(name)")
          .eq("citizen_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0 && active) {
          const mapped: AppItem[] = data.map((row: any) => {
            const schemeName =
              row.schemes?.name ||
              CANONICAL_SCHEME_LIST.find((s) => s.id === row.scheme_id)?.name ||
              "Government Scheme Application";

            const isAwaitingApproval =
              row.status === "draft" || row.status === "pending_citizen_approval";

            return {
              id: row.id,
              schemeName,
              status:
                row.status === "draft"
                  ? "Awaiting your approval"
                  : row.status === "pending_citizen_approval"
                    ? "Awaiting your approval"
                    : row.status === "pending_admin_review"
                      ? "Under Department Review"
                      : row.status === "submitted"
                        ? "Submitted to Portal"
                        : row.status === "approved"
                          ? "Approved & Disbursed"
                          : row.status === "rejected"
                            ? "Action Required / Rejected"
                            : row.status,
              date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "Today",
              actionReady: isAwaitingApproval,
            };
          });
          setApplications(mapped);
        }
      } catch (err) {
        console.warn("[Sahayak] Failed to load citizen applications:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplications();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-1">My Applications</h1>
            <p className="text-muted-foreground">
              Review drafts prepared by Sahayak, provide human consent, and track official status.
            </p>
          </div>
          <Button asChild>
            <Link to="/assistant">
              <Plus className="mr-1.5 size-4" /> Start New Application
            </Link>
          </Button>
        </div>

        <div className="grid gap-4">
          {applications.map((app) => (
            <Link
              key={app.id}
              to={`/applications/${app.id}`}
              className="block bg-card rounded-xl border border-line p-6 hover:border-brand/50 transition-all group shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`grid size-12 place-items-center rounded-lg mt-1 ${
                      app.actionReady ? "bg-amber/10 text-amber" : "bg-brand/10 text-brand"
                    }`}
                  >
                    {app.actionReady ? (
                      <FileText className="size-6" />
                    ) : (
                      <Clock className="size-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-mono text-muted-foreground mb-1">ID: {app.id}</p>
                    <h3 className="text-xl font-semibold mb-1 group-hover:text-brand transition-colors">
                      {app.schemeName}
                    </h3>
                    <p className="text-sm text-foreground flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          app.actionReady
                            ? "bg-amber/20 text-amber border border-amber/30"
                            : "bg-brand/15 text-brand border border-brand/20"
                        }`}
                      >
                        {app.status}
                      </span>
                      <span className="text-muted-foreground text-xs">{app.date}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:ml-auto pl-16 sm:pl-0">
                  {app.actionReady && (
                    <div className="flex items-center gap-2 text-xs text-brand font-medium bg-brand/5 px-3 py-1.5 rounded-lg border border-brand/20">
                      <Bot className="size-4" /> Ready for your sign-off
                    </div>
                  )}
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ChevronRight className="size-5" />
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
