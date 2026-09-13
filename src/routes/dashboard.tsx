import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, MessageSquareText, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  ActivityList,
  ApplicationRow,
  ApplicationTimeline,
  NextBestAction,
  SectionHeading,
  MetricCard,
  NotificationCard,
  EmptyState,
  AppShell,
  type Status,
} from "@/components/sahayak";
import { requireAuth, getCurrentProfile, type UserProfile } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Sahayak" },
      {
        name: "description",
        content: "Track your citizen benefits journey and next recommended AI actions.",
      },
    ],
  }),
  beforeLoad: async () => {
    await requireAuth();
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [applicationsList, setApplicationsList] = useState<any[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [docsVerifiedCount, setDocsVerifiedCount] = useState(0);
  const [docsTotalCount, setDocsTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        const userProfile = await getCurrentProfile();
        if (!isMounted) return;
        setProfile(userProfile);

        if (isSupabaseConfigured && userProfile?.id) {
          const [appsRes, docsRes, eventsRes, notifsRes] = await Promise.all([
            supabase
              .from("applications")
              .select(
                "id, tracking_id, status, applicant_info, updated_at, created_at, schemes(name)",
              )
              .eq("citizen_id", userProfile.id)
              .order("updated_at", { ascending: false }),
            supabase.from("documents").select("id, status").eq("citizen_id", userProfile.id),
            supabase
              .from("agent_events")
              .select("id, agent_name, action, created_at, details, agent_runs!inner(citizen_id)")
              .eq("agent_runs.citizen_id", userProfile.id)
              .order("created_at", { ascending: false })
              .limit(6),
            supabase
              .from("notifications")
              .select("id, title, body, type, is_read, created_at")
              .eq("citizen_id", userProfile.id)
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

          if (isMounted) {
            // Process applications
            const rawApps = appsRes.data || [];
            const mappedApps = rawApps.map((a: any) => {
              const schemeName = a.schemes?.name || "Government Benefit Scheme";
              const isApproved = a.status === "approved";
              const isActionReq = a.status === "awaiting_approval";
              const tone: Status = isApproved ? "complete" : isActionReq ? "warning" : "active";
              const progress = isApproved
                ? 100
                : a.status === "under_review"
                  ? 75
                  : a.status === "submitted"
                    ? 60
                    : 40;
              const stepLabel =
                a.status === "approved"
                  ? "Approved & Sanctioned"
                  : a.status === "under_review"
                    ? "Under Department Review"
                    : a.status === "submitted"
                      ? "Submitted to Portal"
                      : a.status === "awaiting_approval"
                        ? "Awaiting Citizen Approval"
                        : "Draft Application";

              return {
                id: a.tracking_id || a.id,
                name: schemeName,
                status: a.status
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c: string) => c.toUpperCase()),
                tone,
                progress,
                step: stepLabel,
                updated: a.updated_at ? new Date(a.updated_at).toLocaleDateString() : "Today",
              };
            });

            // Deduplicate applications by name
            const dedupedApps: any[] = [];
            const seenSchemeNames = new Set<string>();
            for (const app of mappedApps) {
              const key = app.name.toLowerCase().trim();
              if (!seenSchemeNames.has(key)) {
                seenSchemeNames.add(key);
                dedupedApps.push(app);
              }
            }

            setApplicationsList(dedupedApps);

            // Process documents
            const docs = docsRes.data || [];
            const verified = docs.filter((d: any) => d.status === "verified").length;
            setDocsVerifiedCount(verified);
            setDocsTotalCount(docs.length);

            // Process activity
            const rawEvents = eventsRes.data || [];
            const mappedActivity = rawEvents.map((e: any) => ({
              agent: e.agent_name || "Citizen Agent",
              text: e.action || "Executed task",
              time: e.created_at
                ? new Date(e.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Just now",
              tone: (e.agent_name?.toLowerCase().includes("doc") ? "warning" : "active") as Status,
            }));
            setActivityList(mappedActivity);

            // Process notifications
            const rawNotifs = notifsRes.data || [];
            const mappedNotifs = rawNotifs.map((n: any) => ({
              title: n.title,
              time: n.created_at ? new Date(n.created_at).toLocaleDateString() : "Today",
              tone: (n.type === "critical"
                ? "critical"
                : n.type === "warning"
                  ? "warning"
                  : "active") as Status,
              unread: !n.is_read,
            }));
            setNotificationsList(mappedNotifs);
          }
        }
      } catch (err) {
        console.warn("[Dashboard] Error loading live citizen dashboard data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Time of day greeting according to Indian Standard Time (IST) system
  // Morning: 04:00 - 11:59 | Afternoon: 12:00 - 16:59 | Evening: 17:00 - 03:59
  const istHour = (() => {
    try {
      const istString = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: false,
      });
      return new Date(istString).getHours();
    } catch {
      return new Date().getHours();
    }
  })();

  const firstName = profile?.full_name?.split(" ")[0] || t("dashboard.citizenDefault", "Citizen");
  const greetingText =
    istHour >= 4 && istHour < 12
      ? t("dashboard.greetingMorning", { name: firstName })
      : istHour >= 12 && istHour < 17
        ? t("dashboard.greetingAfternoon", { name: firstName })
        : t("dashboard.greetingEvening", { name: firstName });

  // Subtitle items
  const subtitleItems = [
    profile?.age ? `${profile.age}` : null,
    profile?.location || null,
    profile?.occupation || null,
    profile?.annual_income ? `₹${Number(profile.annual_income).toLocaleString()}` : null,
  ].filter(Boolean);

  const subtitleText =
    subtitleItems.length > 0
      ? subtitleItems.join(" · ")
      : t("dashboard.completeProfile", "Please complete your profile");

  // Dynamic aggregates for logged-in citizen
  const appsInProgressCount = applicationsList.filter(
    (a) => a.status !== "Approved" && a.status !== "Rejected",
  ).length;
  const actionsRequiredCount = applicationsList.filter(
    (a) => a.tone === "warning" || a.status === "Awaiting Approval",
  ).length;
  const benefitsDiscoveredCount = Math.max(
    applicationsList.length,
    applicationsList.length > 0 ? applicationsList.length + 1 : 0,
  );
  const docRatio = docsTotalCount > 0 ? `${docsVerifiedCount}/${docsTotalCount}` : "0/0";
  const docProgress =
    docsTotalCount > 0 ? Math.round((docsVerifiedCount / docsTotalCount) * 100) : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        {profile?.role === "admin" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-md">
            <div className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-lg bg-brand/20 text-brand">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs font-bold font-display">Administrator Mode Active</p>
                <p className="text-[11px] text-slate-300">
                  You have supervisory privileges. Switch to the administrative control center to
                  review flagged applications and live workforce telemetry.
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand/90 shrink-0"
            >
              Open Admin Console
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 text-[11px] text-brand-soft">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-sage" />
            {t("dashboard.liveOrchestration", "Live orchestration · 6 agents coordinated")}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            {greetingText}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitleText}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label={t("dashboard.metrics.benefitsDiscovered", "Benefits discovered")}
            value={`${benefitsDiscoveredCount}`}
            detail={benefitsDiscoveredCount > 0 ? "+1 matching" : "0 discovered"}
          />
          <MetricCard
            label={t("dashboard.metrics.appsInProgress", "Applications in progress")}
            value={`${appsInProgressCount}`}
            detail={
              actionsRequiredCount > 0
                ? `${actionsRequiredCount} ${t("dashboard.metrics.needsAction", "needs action")}`
                : t("dashboard.metrics.allGood", "All up to date")
            }
            tone={actionsRequiredCount > 0 ? "warning" : "brand"}
          />
          <MetricCard
            label={t("dashboard.metrics.docsVerified", "Documents verified")}
            value={docRatio}
            detail=""
            tone="success"
            progress={docProgress}
          />
          <MetricCard
            label={t("dashboard.metrics.actionsRequired", "Actions required")}
            value={`${actionsRequiredCount}`}
            detail={
              actionsRequiredCount > 0
                ? t("dashboard.metrics.dueSoon", "Action needed")
                : t("dashboard.metrics.allGood", "All up to date")
            }
            tone={actionsRequiredCount > 0 ? "critical" : "brand"}
          />
        </div>

        <NextBestAction />

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-6">
            <section>
              <SectionHeading
                title={t("dashboard.activeApps", "Active applications")}
                action={
                  <Button asChild variant="link" size="sm" className="text-brand">
                    <Link to="/applications">
                      {t("dashboard.viewAll", "View all")} <ArrowRight />
                    </Link>
                  </Button>
                }
              />
              {applicationsList.length === 0 ? (
                <EmptyState
                  title={t("dashboard.emptyAppsTitle", "No active applications yet")}
                  description={t(
                    "dashboard.emptyAppsDesc",
                    "Talk with Sahayak AI Assistant to discover matching schemes and start your first application.",
                  )}
                  action={
                    <Button asChild size="sm">
                      <Link to="/assistant">
                        <MessageSquareText className="mr-2 size-4" />
                        {t("dashboard.startAssistant", "Ask Assistant")}
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {applicationsList.map((application) => (
                    <ApplicationRow key={application.id} application={application} />
                  ))}
                </div>
              )}
            </section>
            <section>
              <SectionHeading title={t("dashboard.progressTimeline", "Progress timeline")} />
              <ApplicationTimeline />
            </section>
          </div>

          <div className="space-y-6">
            <section>
              <SectionHeading title={t("dashboard.recentActivity", "Recent AI activity")} />
              {activityList.length === 0 ? (
                <div className="rounded-xl border border-line bg-card p-6 text-center text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">
                    {t("dashboard.emptyActivityTitle", "No activity yet")}
                  </p>
                  <p className="text-xs">
                    {t(
                      "dashboard.emptyActivityDesc",
                      "Your AI workforce activity will appear here once you interact with the assistant.",
                    )}
                  </p>
                </div>
              ) : (
                <ActivityList items={activityList} />
              )}
            </section>
            <section>
              <SectionHeading
                title={t("dashboard.notifications", "Notifications")}
                action={
                  <Button asChild variant="link" size="sm" className="text-brand">
                    <Link to="/notifications">{t("dashboard.viewAll", "View all")}</Link>
                  </Button>
                }
              />
              <div className="rounded-xl border border-line bg-card p-4 shadow-none">
                {notificationsList.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    {t(
                      "dashboard.emptyNotifications",
                      "You are all caught up. No new notifications.",
                    )}
                  </p>
                ) : (
                  notificationsList.map((notification, idx) => (
                    <NotificationCard key={`${notification.title}-${idx}`} {...notification} />
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card p-4 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t(
              "dashboard.connectedEcosystem",
              "Your connected ecosystem: Sahayak works alongside myScheme, UMANG and DigiLocker — it never replaces them.",
            )}
          </span>
          <Button asChild variant="link" size="sm" className="ml-1 px-1 text-brand">
            <Link to="/profile">
              {t("dashboard.manageConnections", "Manage connections")} <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
