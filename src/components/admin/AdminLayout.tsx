import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Shield,
  LayoutDashboard,
  Bot,
  Landmark,
  BarChart3,
  LogOut,
  Activity,
  Menu,
  X,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, getCurrentProfile, type UserProfile } from "@/lib/auth";
import { getSystemHealth, type SystemHealth } from "@/lib/admin-services";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    getCurrentProfile().then(setProfile);
    getSystemHealth().then(setHealth);
    const interval = setInterval(() => {
      getSystemHealth().then(setHealth);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/admin/login" });
  };

  const navItems = [
    { label: "Overview & Review", href: "/admin", icon: LayoutDashboard },
    { label: "AI Workforce", href: "/admin/agents", icon: Bot },
    { label: "Schemes Catalog", href: "/admin/schemes", icon: Landmark },
    { label: "Analytics & Telemetry", href: "/admin/analytics", icon: BarChart3 },
  ];

  const userInitial = profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "A";

  const renderNavContent = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col justify-between p-4">
      {/* Top Header & Brand */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/admin" onClick={onNavigate} className="flex items-center gap-3 group">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-indigo-600 shadow-md shadow-brand/25 transition-transform group-hover:scale-105">
              <Shield className="size-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-white group-hover:text-brand transition-colors">
                  Sahayak
                </span>
                <span className="rounded-md bg-brand/20 border border-brand/40 px-1.5 py-0.5 text-[9px] font-bold text-brand uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                Civic Supervisory Console
              </p>
            </div>
          </Link>
          {onNavigate && (
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white md:hidden"
              onClick={onNavigate}
            >
              <X className="size-5" />
            </Button>
          )}
        </div>

        {/* Live System Health Badge */}
        <div
          className={cn(
            "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
            health?.status === "healthy"
              ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-300"
              : "border-amber-500/30 bg-amber-950/30 text-amber-300",
          )}
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                health?.status === "healthy" ? "bg-emerald-400 animate-pulse" : "bg-amber-400",
              )}
            />
            <span className="font-medium text-[11px]">
              {health?.status === "healthy" ? "Workforce Online" : "Service Degraded"}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">LIVE DB</span>
        </div>

        {/* Navigation Links */}
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Supervisory Modules
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin" || pathname === "/admin/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-brand text-white font-semibold shadow-md shadow-brand/25"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                )}
              >
                <Icon className={cn("size-4", isActive ? "text-white" : "text-slate-400")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Profile & Sign Out */}
      <div className="space-y-3 border-t border-slate-800/80 pt-4">
        {/* User Card */}
        <div className="flex items-center justify-between rounded-lg bg-slate-900/80 p-2.5 border border-slate-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-inner">
              {userInitial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {profile?.full_name || "Admin Officer"}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                Supervisory
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="size-7 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30"
            title="Sign out of Admin Console"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-brand selection:text-white flex">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-slate-800/80 bg-slate-950/95 backdrop-blur-md z-30">
        {renderNavContent()}
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/90 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-slate-300 hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-brand text-white">
              <Shield className="size-4" />
            </div>
            <span className="font-display font-bold text-white text-sm">Sahayak Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              health?.status === "healthy" ? "bg-emerald-400" : "bg-amber-400",
            )}
          />
          <div className="flex size-7 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
            {userInitial}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 shadow-2xl z-50">
            {renderNavContent(() => setMobileOpen(false))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen min-w-0 pt-16 md:pt-0">
        <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8 max-w-7xl w-full mx-auto">
          {title && (
            <div className="mb-6 pb-4 border-b border-slate-800/60">
              <h1 className="text-2xl font-bold tracking-tight text-white font-display sm:text-3xl">
                {title}
              </h1>
              {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>

        {/* Clean Admin Footer */}
        <footer className="border-t border-slate-900 bg-slate-950/90 py-4 text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Sahayak National Civic Intelligence Platform · Administrative Console</span>
            <span className="text-[11px] text-slate-500 font-mono">
              Zero Mock Policy Active · All queries hit live DB
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
