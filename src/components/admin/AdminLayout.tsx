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
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut, getCurrentProfile, type UserProfile } from "@/lib/auth";
import { getSystemHealth, type SystemHealth } from "@/lib/admin-services";

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
    { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo & Console Title */}
          <div className="flex items-center gap-6">
            <Link to="/admin" className="flex items-center gap-3 group">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-indigo-600 shadow-md shadow-brand/20">
                <Shield className="size-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold tracking-tight text-white group-hover:text-brand transition-colors">
                    Sahayak Admin
                  </span>
                  <span className="rounded-md bg-brand/20 border border-brand/30 px-1.5 py-0.5 text-[10px] font-semibold text-brand uppercase tracking-wider">
                    Console
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">National Civic Workforce</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1 border-l border-slate-800 pl-6">
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
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-slate-800 text-white font-semibold shadow-sm border border-slate-700"
                        : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                    }`}
                  >
                    <Icon className={`size-3.5 ${isActive ? "text-brand" : "text-slate-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Real System Health Indicator */}
            <div
              className={`hidden sm:flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${
                health?.status === "healthy"
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                  : "border-amber-500/30 bg-amber-950/40 text-amber-300"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  health?.status === "healthy" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className="text-[11px]">
                {health?.status === "healthy" ? "Workforce Online" : "Service Degraded"}
              </span>
            </div>

            {/* Admin Profile & Logout */}
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 text-xs font-bold text-white shadow-inner">
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "A"}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-semibold text-white leading-tight">
                    {profile?.full_name || "Admin Officer"}
                  </p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Supervisory</p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 hover:bg-red-950/30 text-xs h-8 px-2.5 ml-1"
                title="Sign out of Admin Console"
              >
                <LogOut className="size-3.5 mr-1" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-800/60 px-2 py-1.5 bg-slate-950/95 overflow-x-auto">
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
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium shrink-0 ${
                  isActive ? "bg-slate-800 text-white font-semibold" : "text-slate-400"
                }`}
              >
                <Icon className="size-3" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        {title && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-white font-display sm:text-3xl">
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>

      {/* Footer Audit Notice */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sahayak National Civic Intelligence Platform · Administrative Console</span>
          <span className="text-[11px] text-slate-600">Zero Mock Policy Active · All queries hit live DB</span>
        </div>
      </footer>
    </div>
  );
}
