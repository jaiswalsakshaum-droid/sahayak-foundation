import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Compass,
  FileCheck2,
  FileText,
  Globe2,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
  LogOut,
} from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsentModal, LanguageSwitcher } from "./components";
import { cn } from "@/lib/utils";
import { signOut, getCurrentProfile, type UserProfile } from "@/lib/auth";

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
        S
      </span>
      <span>
        <span className="block font-display text-[17px] font-semibold leading-none tracking-tight">
          Sahayak
        </span>
        <span className="mt-1 hidden text-[10px] leading-none text-muted-foreground sm:block">
          Agentic civic workforce
        </span>
      </span>
    </Link>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const primaryNav = [
    [t("nav.dashboard", "Dashboard"), "/dashboard", LayoutDashboard],
    [t("nav.assistant", "AI Assistant"), "/assistant", MessageSquareText],
    [t("nav.schemes", "Schemes"), "/schemes", Compass],
    [t("nav.documents", "Documents"), "/documents", FileText],
    [t("nav.applications", "Applications"), "/applications", FileCheck2],
    [t("nav.notifications", "Notifications"), "/notifications", Bell],
    [t("nav.profile", "Profile"), "/profile", UserRound],
  ] as const;

  return (
    <nav className="space-y-1">
      {primaryNav.map(([label, path, Icon]) => {
        const active = pathname === path || (path !== "/dashboard" && pathname.startsWith(path));
        return (
          <Link
            key={path}
            to={path}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand text-primary-foreground"
                : "text-muted-foreground hover:bg-ice hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p) setProfile(p);
    });
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const userInitials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CT";

  return (
    <div className="min-h-screen bg-ice-2 text-foreground">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
          <Logo />
          <div className="hidden max-w-md flex-1 md:flex">
            <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm text-muted-foreground">
              <Search className="size-4" />
              <Input
                aria-label="Search schemes, documents and actions"
                placeholder={t("schemes.searchPlaceholder", "Search schemes, documents, actions…")}
                className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              />
            </label>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="ghost" size="icon" aria-label="View notifications">
              <Link to="/notifications">
                <Bell />
                <span className="absolute ml-4 mt-[-13px] size-1.5 rounded-full bg-coral" />
              </Link>
            </Button>
            <LanguageSwitcher />
            <Link
              to="/profile"
              aria-label={`Open ${profile?.full_name || "citizen"} profile`}
              className="grid size-9 place-items-center rounded-lg bg-brand-soft/15 text-xs font-semibold text-brand"
            >
              {userInitials}
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1440px] items-start gap-6 px-4 py-6 sm:px-6">
        <aside className="sticky top-22 hidden w-56 shrink-0 lg:block">
          <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
            <Navigation />
            <div className="mt-4 border-t border-line pt-3">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
                onClick={() => setConsentOpen(true)}
              >
                <ShieldCheck className="size-4" />
                Privacy & Consent
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Logout
              </Button>
              <div className="mt-3 flex items-center gap-3 border-t border-line px-3 pt-3">
                <div className="grid size-8 place-items-center rounded-full bg-brand-soft/15 text-xs font-semibold text-brand">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {profile?.full_name || t("dashboard.citizenDefault", "Citizen")}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {profile?.role || "Citizen"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="fixed right-4 top-4 z-50 bg-card"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </Button>
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative h-full w-[min(84vw,320px)] border-r border-line bg-card p-4 shadow-xl">
            <div className="mb-8">
              <Logo />
            </div>
            <Navigation onNavigate={() => setMobileOpen(false)} />
            <div className="mt-8 border-t border-line pt-4">
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
                onClick={() => {
                  setMobileOpen(false);
                  setConsentOpen(true);
                }}
              >
                <ShieldCheck className="size-4" />
                Privacy & Consent
              </Button>
              <Button
                variant="ghost"
                className="mt-1 w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </aside>
        </div>
      )}
      <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
