import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Bot, ChevronRight, FileText, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/applications/")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("sahayak_auth")) {
      throw redirect({ to: "/login" });
    }
  },
  component: ApplicationsPage,
});

function ApplicationsPage() {
  const applications = [
    {
      id: "SAH-2026-004281",
      schemeName: "National Means-cum-Merit Scholarship",
      status: "Awaiting your approval",
      date: "Prepared today",
      actionReady: true,
    },
    {
      id: "SAH-2025-019922",
      schemeName: "PM Awas Yojana (Urban)",
      status: "Under Department Review",
      date: "Submitted 2 weeks ago",
      actionReady: false,
    },
  ];

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
            <Link to="/applications" className="text-foreground">
              Applications
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold mb-2">My Applications</h1>
          <p className="text-muted-foreground">Track and manage your scheme applications.</p>
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
                    className={`grid size-12 place-items-center rounded-lg mt-1 ${app.actionReady ? "bg-amber/10 text-amber" : "bg-brand/10 text-brand"}`}
                  >
                    {app.actionReady ? (
                      <FileText className="size-6" />
                    ) : (
                      <Clock className="size-6" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">ID: {app.id}</p>
                    <h3 className="text-xl font-semibold mb-1 group-hover:text-brand transition-colors">
                      {app.schemeName}
                    </h3>
                    <p className="text-sm text-foreground flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${app.actionReady ? "bg-amber/20 text-amber" : "bg-brand/20 text-brand"}`}
                      >
                        {app.status}
                      </span>
                      <span className="text-muted-foreground">{app.date}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:ml-auto pl-16 sm:pl-0">
                  {app.actionReady && (
                    <div className="flex items-center gap-2 text-sm text-brand font-medium bg-brand/5 px-3 py-1.5 rounded-lg border border-brand/20">
                      <Bot className="size-4" /> Prepared by Sahayak
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
