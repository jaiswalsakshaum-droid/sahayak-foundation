import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { User, Shield, CreditCard, Link as LinkIcon, CheckCircle2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("sahayak_auth")) {
      throw redirect({ to: "/login" });
    }
  },
  component: ProfilePage,
});

function ProfilePage() {
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
            <Link to="/documents" className="text-muted-foreground hover:text-foreground">
              Documents
            </Link>
            <Link to="/applications" className="text-muted-foreground hover:text-foreground">
              Applications
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-5 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-display font-semibold mb-2">Citizen Profile</h1>
          <p className="text-muted-foreground">
            Manage your identity, ecosystem integrations, and consent preferences.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-line p-6 shadow-sm flex items-start gap-4">
          <div className="grid size-16 place-items-center rounded-full bg-brand/10 text-brand text-2xl font-semibold">
            RS
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">Rahul Sharma</h2>
            <p className="text-sm text-muted-foreground mt-1">
              20 years old • Lucknow, Uttar Pradesh
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-ice-2 border border-line rounded text-xs font-medium">
                Undergraduate Student
              </span>
              <span className="px-2 py-1 bg-ice-2 border border-line rounded text-xs font-medium">
                Income: ₹2,10,000
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm">
            Edit Profile
          </Button>
        </div>

        <div className="bg-card rounded-xl border border-line shadow-sm overflow-hidden">
          <div className="p-5 border-b border-line bg-ice-2/50">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <LinkIcon className="size-5 text-brand" /> Ecosystem Integrations
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <IntegrationRow
              name="DigiLocker"
              status="Connected"
              desc="Import verified documents seamlessly"
              icon={Shield}
              active
            />
            <IntegrationRow
              name="UMANG API"
              status="Connected"
              desc="Sync government benefit statuses"
              icon={Bot}
              active
            />
            <IntegrationRow
              name="Bank Account"
              status="Not Connected"
              desc="Required for direct benefit transfer (DBT)"
              icon={CreditCard}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function IntegrationRow({ name, status, desc, icon: Icon, active = false }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-line bg-ice-2">
      <div className="flex items-center gap-4">
        <div
          className={`grid size-10 place-items-center rounded-lg ${active ? "bg-sage/10 text-sage" : "bg-card text-muted-foreground"}`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <h4 className="font-medium text-sm">{name}</h4>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div>
        {active ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-sage bg-sage/10 px-2.5 py-1 rounded-full border border-sage/20">
            <CheckCircle2 className="size-3.5" /> {status}
          </span>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
