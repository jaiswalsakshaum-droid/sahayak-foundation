import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Check, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressStepper } from "@/components/sahayak";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [
    { title: "Interactive demo — Sahayak" },
    { name: "description", content: "Explore how Sahayak coordinates a government benefit journey in demo mode." },
    { property: "og:title", content: "Interactive demo — Sahayak" },
    { property: "og:description", content: "Walk through a citizen's journey from need to next action." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: DemoPage,
});

function DemoPage() {
  return <div className="min-h-screen bg-ice-2 text-foreground"><header className="border-b border-line bg-card"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6"><Link to="/" className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">S</span><span className="font-display text-lg font-semibold">Sahayak</span></Link><Button asChild variant="outline"><Link to="/login">Sign in</Link></Button></div></header><main className="mx-auto max-w-5xl px-5 py-14 sm:px-6"><div className="max-w-2xl"><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-soft"><Sparkles className="size-3.5" />Demo mode</div><h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">See the workforce move a citizen forward.</h1><p className="mt-4 text-base leading-relaxed text-muted-foreground">Meet Rahul, a student in Lucknow looking for scholarship support. Follow the hand-offs from his need to the one action that unlocks his application.</p></div><div className="mt-10"><ProgressStepper /></div><Card className="mt-6 border-line bg-card shadow-none"><CardContent className="grid gap-8 p-6 md:grid-cols-[1fr_280px] md:p-8"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-soft">Scenario 01 · Student scholarship</p><h2 className="mt-3 font-display text-2xl font-semibold">“I need help paying for college.”</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">Sahayak turns a broad need into a structured journey: it learns Rahul's context, finds a match, verifies eligibility, checks his documents and prepares the next step.</p><ul className="mt-6 space-y-3 text-sm">{["3 relevant schemes matched", "Eligibility verified at 92% confidence", "5 of 6 documents ready", "1 clear action to unlock submission"].map((item) => <li className="flex items-center gap-2" key={item}><Check className="size-4 text-sage" />{item}</li>)}</ul></div><div className="flex flex-col justify-between rounded-xl bg-ice p-5"><div><div className="grid size-11 place-items-center rounded-lg bg-brand text-primary-foreground"><Play className="ml-0.5 size-5 fill-current" /></div><h3 className="mt-5 font-display text-xl font-semibold">Start the walkthrough</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Open the working dashboard with Rahul's seeded profile.</p></div><Button asChild className="mt-8 w-full"><Link to="/dashboard">Open demo dashboard <ArrowRight /></Link></Button></div></CardContent></Card></main></div>;
}