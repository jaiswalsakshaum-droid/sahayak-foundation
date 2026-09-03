import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, Compass, FileCheck2, FileText, Globe2, LayoutDashboard, Menu, MessageSquareText, Search, Settings2, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsentModal } from "./components";
import { cn } from "@/lib/utils";

const primaryNav = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["AI Assistant", "/assistant", MessageSquareText],
  ["My Schemes", "/schemes", Compass],
  ["Documents", "/documents", FileText],
  ["Applications", "/applications", FileCheck2],
  ["Notifications", "/notifications", Bell],
  ["Profile", "/profile", UserRound],
] as const;

function Logo() {
  return <Link to="/" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">S</span><span><span className="block font-display text-[17px] font-semibold leading-none tracking-tight">Sahayak</span><span className="mt-1 hidden text-[10px] leading-none text-muted-foreground sm:block">Agentic civic workforce</span></span></Link>;
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <nav className="space-y-1">{primaryNav.map(([label, path, Icon]) => { const active = pathname === path || (path !== "/dashboard" && pathname.startsWith(path)); return <Link key={path} to={path} onClick={onNavigate} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-brand text-primary-foreground" : "text-muted-foreground hover:bg-ice hover:text-foreground")}><Icon className="size-4" />{label}{label === "My Schemes" && <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-ice text-brand")}>3</span>}{label === "Applications" && <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-amber/10 text-amber")}>2</span>}</Link>; })}</nav>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  return <div className="min-h-screen bg-ice-2 text-foreground">
    <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm"><div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button><Logo /><div className="hidden max-w-md flex-1 md:flex"><label className="flex h-9 w-full items-center gap-2 rounded-lg border border-line bg-card px-3 text-sm text-muted-foreground"><Search className="size-4" /><Input aria-label="Search schemes, documents and actions" placeholder="Search schemes, documents, actions…" className="h-7 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0" /></label></div><div className="ml-auto flex items-center gap-2"><Button asChild variant="ghost" size="icon" aria-label="View notifications"><Link to="/notifications"><Bell /><span className="absolute ml-4 mt-[-13px] size-1.5 rounded-full bg-coral" /></Link></Button><Button variant="outline" size="sm" className="hidden gap-1.5 bg-card sm:flex"><Globe2 className="size-3.5" />EN<ChevronDown className="size-3" /></Button><Link to="/profile" aria-label="Open Rahul Sharma profile" className="grid size-9 place-items-center rounded-lg bg-brand-soft/15 text-xs font-semibold text-brand">RS</Link></div></div></header>
    <div className="mx-auto flex max-w-[1440px] items-start gap-6 px-4 py-6 sm:px-6"><aside className="sticky top-22 hidden w-56 shrink-0 lg:block"><div className="rounded-xl border border-line bg-card p-3 shadow-sm"><Navigation /><div className="my-3 border-t border-line" /><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Workspace</p><nav className="space-y-1"><Link to="/admin/agents" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-ice hover:text-foreground"><ShieldCheck className="size-4 text-brand" />AI Workforce</Link><Link to="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-ice hover:text-foreground"><Settings2 className="size-4" />Admin</Link></nav><div className="mt-5 border-t border-line pt-3"><Button variant="ghost" className="w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground" onClick={() => setConsentOpen(true)}><ShieldCheck className="size-4" />Privacy & Consent</Button><div className="mt-2 flex items-center gap-3 px-3 text-xs text-muted-foreground"><Globe2 className="size-4" />English <span className="text-line">·</span> हिंदी</div><div className="mt-3 flex items-center gap-3 border-t border-line px-3 pt-3"><div className="grid size-8 place-items-center rounded-full bg-brand-soft/15 text-xs font-semibold text-brand">RS</div><div><p className="text-xs font-semibold">Rahul Sharma</p><p className="text-[10px] text-muted-foreground">Citizen account</p></div></div></div></div></aside><main className="min-w-0 flex-1">{children}</main></div>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><Button variant="ghost" size="icon" className="fixed right-4 top-4 z-50 bg-card" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></Button><div className="absolute inset-0 bg-foreground/30" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-[min(84vw,320px)] border-r border-line bg-card p-4 shadow-xl"><div className="mb-8"><Logo /></div><Navigation onNavigate={() => setMobileOpen(false)} /><div className="mt-8 border-t border-line pt-4"><Link to="/admin/agents" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"><ShieldCheck className="size-4" />AI Workforce</Link><Button variant="ghost" className="mt-1 w-full justify-start gap-3 px-3 text-sm font-medium text-muted-foreground" onClick={() => { setMobileOpen(false); setConsentOpen(true); }}><ShieldCheck className="size-4" />Privacy & Consent</Button></div></aside></div>}
    <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
  </div>;
}