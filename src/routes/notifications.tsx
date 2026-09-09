import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/notifications")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: NotificationsPage,
});

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
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
    id: 2,
    title: "Document Expiring Soon",
    message: "Your Income Certificate expires in 15 days. Please prepare a new one.",
    type: "warning",
    time: "2 hours ago",
    actionLabel: "View Details",
    actionLink: "/documents",
    unread: true,
  },
  {
    id: 3,
    title: "Application Status Update",
    message: "Your application (SAH-2026-004281) moved to department review.",
    type: "update",
    time: "Yesterday",
    actionLabel: "Track Status",
    actionLink: "/applications/SAH-2026-004281",
    unread: false,
  },
  {
    id: 4,
    title: "Document Verified",
    message: "Your PAN Card was successfully verified by Sahayak AI.",
    type: "success",
    time: "Yesterday",
    actionLabel: "View Document",
    actionLink: "/documents",
    unread: false,
  },
];

function NotificationsPage() {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, unread: false })));
  };

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2">Notifications</h1>
            <p className="text-muted-foreground">
              Stay updated on your applications and documents.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={markAllAsRead}
            disabled={notifications.every((n) => !n.unread)}
          >
            Mark all as read
          </Button>
        </div>

        <div className="space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`p-5 rounded-xl border ${notif.unread ? "bg-card border-brand/30 shadow-sm" : "bg-ice-2 border-line"} relative overflow-hidden`}
            >
              {notif.unread && <div className="absolute top-0 left-0 w-1 h-full bg-brand" />}

              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex gap-4">
                  <div className="shrink-0 mt-1">
                    {notif.type === "critical" && <FileWarning className="size-6 text-amber" />}
                    {notif.type === "warning" && <AlertTriangle className="size-6 text-amber/70" />}
                    {notif.type === "update" && <Bell className="size-6 text-brand" />}
                    {notif.type === "success" && <CheckCircle2 className="size-6 text-sage" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3
                        className={`font-semibold ${notif.unread ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {notif.title}
                      </h3>
                      <span className="text-xs text-muted-foreground">{notif.time}</span>
                    </div>
                    <p
                      className={`text-sm mb-4 ${notif.unread ? "text-muted-foreground" : "text-muted-foreground/80"}`}
                    >
                      {notif.message}
                    </p>

                    {notif.actionLabel && (
                      <Link to={notif.actionLink}>
                        <Button
                          variant={notif.type === "critical" ? "default" : "outline"}
                          size="sm"
                          className="h-8"
                        >
                          {notif.actionLabel} <ArrowRight className="size-3 ml-2" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
