import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  ArrowRight,
  Info,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { requireAuth, getSession } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: NotificationsPage,
});

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "critical" | "warning" | "info" | "success";
  time: string;
  unread: boolean;
  actionLabel?: string;
  actionLink?: string;
};

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "demo-1",
    title: "Action Required: Missing Document",
    message:
      "Your enrollment certificate is missing for the National Scholarship application. Please upload it to continue.",
    type: "critical",
    time: "12 min ago",
    actionLabel: "Upload Document",
    actionLink: "/documents",
    unread: true,
  },
  {
    id: "demo-2",
    title: "Document Expiring Soon",
    message: "Your Income Certificate expires in 15 days. Please prepare a new one.",
    type: "warning",
    time: "2 hours ago",
    actionLabel: "View Details",
    actionLink: "/documents",
    unread: true,
  },
  {
    id: "demo-3",
    title: "Application Status Update",
    message: "Your application (SAH-2026-004281) moved to department review.",
    type: "info",
    time: "Yesterday",
    actionLabel: "Track Status",
    actionLink: "/applications",
    unread: false,
  },
];

function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    isSupabaseConfigured ? [] : DEMO_NOTIFICATIONS,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      try {
        const session = await getSession();
        if (!session?.user?.id) {
          if (active) setLoading(false);
          return;
        }
        if (active) setCurrentUserId(session.user.id);

        if (!isSupabaseConfigured) {
          if (active) {
            setNotifications(DEMO_NOTIFICATIONS);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("citizen_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!error && active) {
          const mapped: NotificationItem[] = (data || []).map((n: any) => ({
            id: n.id,
            title: n.title,
            message: n.body || "",
            type: (n.type as any) || "info",
            time: n.created_at ? new Date(n.created_at).toLocaleDateString() : "Recently",
            unread: !n.is_read,
            actionLink: "/applications",
            actionLabel: "View Details",
          }));
          setNotifications(mapped);
        }
      } catch (err) {
        console.warn("[Notifications] Error loading notifications:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadNotifications();
    return () => {
      active = false;
    };
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`citizen-notifs-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `citizen_id=eq.${currentUserId}`,
        },
        (payload) => {
          const n = payload.new as any;
          const newItem: NotificationItem = {
            id: n.id,
            title: n.title,
            message: n.body || "",
            type: (n.type as any) || "info",
            time: "Just now",
            unread: !n.is_read,
            actionLink: "/applications",
            actionLabel: "View Details",
          };
          setNotifications((prev) => [newItem, ...prev.filter((item) => item.id !== newItem.id)]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));

    if (isSupabaseConfigured && currentUserId) {
      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("citizen_id", currentUserId)
          .eq("is_read", false);
        toast.success("All notifications marked as read");
      } catch (err) {
        console.error("[Notifications] Failed to mark as read:", err);
      }
    }
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <Link to="/" className="flex items-center gap-2 mr-6 text-foreground hover:text-brand">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/assistant" className="text-muted-foreground hover:text-foreground">
              Assistant
            </Link>
            <Link to="/schemes" className="text-muted-foreground hover:text-foreground">
              Schemes
            </Link>
            <Link to="/documents" className="text-muted-foreground hover:text-foreground">
              Documents
            </Link>
            <Link to="/applications" className="text-muted-foreground hover:text-foreground">
              Applications
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-5 py-10">
        {!isSupabaseConfigured && (
          <div className="mb-6 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber flex items-center justify-between">
            <span>Demo mode active — displaying sample notification feed.</span>
            <span className="font-semibold uppercase tracking-wider text-[10px]">Demo</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-1">Notifications</h1>
            <p className="text-muted-foreground text-sm">
              Stay updated on your applications, verification milestones, and AI workforce actions.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="gap-1.5"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="bg-card rounded-xl border border-line p-10 text-center text-sm text-muted-foreground shadow-sm">
            <Loader2 className="size-6 animate-spin mx-auto mb-2 text-brand" />
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-line p-12 text-center shadow-sm">
            <Bell className="size-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground text-base">No notifications yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              You are all caught up. Updates on your document validations and application progress will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-xl border ${
                  notif.unread
                    ? "bg-card border-brand/40 shadow-sm"
                    : "bg-ice-2/60 border-line"
                } relative overflow-hidden transition-all`}
              >
                {notif.unread && (
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand" />
                )}

                <div className="flex gap-3.5 items-start">
                  <div className="shrink-0 mt-0.5">
                    {notif.type === "critical" && <FileWarning className="size-5 text-coral" />}
                    {notif.type === "warning" && <AlertTriangle className="size-5 text-amber" />}
                    {notif.type === "info" && <Info className="size-5 text-brand" />}
                    {notif.type === "success" && <CheckCircle2 className="size-5 text-sage" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3
                        className={`text-sm font-semibold truncate ${
                          notif.unread ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {notif.title}
                      </h3>
                      <span className="text-[11px] text-muted-foreground shrink-0">{notif.time}</span>
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        notif.unread ? "text-muted-foreground" : "text-muted-foreground/80"
                      }`}
                    >
                      {notif.message}
                    </p>

                    {notif.actionLabel && notif.actionLink && (
                      <div className="mt-3">
                        <Link to={notif.actionLink}>
                          <Button
                            variant={notif.type === "critical" ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                          >
                            {notif.actionLabel} <ArrowRight className="size-3 ml-1.5" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
