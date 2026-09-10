import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleCheck,
  LockKeyhole,
  Menu,
  SearchCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentCard, ConsentModal } from "@/components/sahayak";
import { agents, journeySteps } from "@/lib/agent-roster";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sahayak — From eligibility to action" },
      {
        name: "description",
        content:
          "An agentic AI workforce that helps citizens navigate government benefits from eligibility to action.",
      },
      { property: "og:title", content: "Sahayak — From eligibility to action" },
      {
        property: "og:description",
        content:
          "Discover benefits, verify eligibility, prepare documents, and know what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [consentOpen, setConsentOpen] = useState(false);
  return (
    <div className="min-h-screen bg-ice-2 text-foreground">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6">
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
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a href="#workforce" className="hover:text-brand">
              The workforce
            </a>
            <a href="#control" className="hover:text-brand">
              Citizen control
            </a>
            <Link to="/signup" className="hover:text-brand">
              Schemes
            </Link>
            <Link to="/login" className="hover:text-brand">
              Sign in
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild className="hidden sm:inline-flex">
              <Link to="/login">
                Login <ArrowRight />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </div>
        </div>
      </header>
      <main>
        <section className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-5 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
          <div className="lg:col-span-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-mist bg-card px-3 py-1 text-xs font-medium text-brand-soft">
              <span className="size-1.5 animate-pulse-dot rounded-full bg-sage" />
              Agentic AI Workforce · Government Scheme Navigation
            </span>
            <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              From eligibility
              <br />
              to <span className="text-brand">action.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              An agentic AI workforce that helps citizens discover government benefits, verify
              eligibility, prepare documents, complete applications, and know what to do next —
              while you stay in control of every sensitive action.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Start with your need <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-card">
                <Link to="/demo">Run interactive demo</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6 text-xs text-muted-foreground">
              <span>Works alongside myScheme</span>
              <span>UMANG</span>
              <span>DigiLocker</span>
              <span className="text-brand">Not a replacement</span>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="relative animate-floaty rounded-2xl border border-line bg-gradient-to-b from-card to-ice-2 p-6 shadow-sm">
              <div className="absolute -top-3 left-6 rounded-full border border-mist bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Live orchestration
              </div>
              <div className="mt-3 space-y-1.5">
                {journeySteps.map((step, index) => {
                  const complete = index < 4;
                  const current = step.status === "active";
                  return (
                    <div key={step.label}>
                      <div
                        className={
                          current
                            ? "flex items-center gap-3 rounded-lg border border-brand bg-brand px-3 py-2.5 text-primary-foreground"
                            : "flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5"
                        }
                      >
                        <span
                          className={
                            complete
                              ? "size-2 rounded-full bg-sage"
                              : current
                                ? "size-2 animate-flow-pulse rounded-full bg-primary-foreground"
                                : "size-2 rounded-full bg-mist"
                          }
                        />
                        <span className="text-sm font-medium">{step.label}</span>
                        <span
                          className={
                            current
                              ? "ml-auto text-[11px] text-primary-foreground/75"
                              : "ml-auto text-[11px] text-muted-foreground"
                          }
                        >
                          {complete ? "Done" : current ? "Upload cert" : "Queued"}
                        </span>
                      </div>
                      {index < journeySteps.length - 1 && (
                        <div className="ml-4 h-1.5 w-px bg-line" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        <section className="border-y border-line bg-card">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-soft">
                Not another chatbot
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                Finding a government scheme is only the beginning.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                Sahayak coordinates the journey that follows — from understanding your need to
                preparing the next action.
              </p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
              <div className="bg-ice-2 p-6">
                <p className="text-xs font-semibold text-brand">01</p>
                <h3 className="mt-3 font-display text-xl font-semibold">Discovery isn't enough</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  A list of schemes does not tell you if you qualify, what is missing, or what to do
                  next.
                </p>
              </div>
              <div className="bg-ice-2 p-6">
                <p className="text-xs font-semibold text-brand">02</p>
                <h3 className="mt-3 font-display text-xl font-semibold">
                  AI workforce, not one chatbot
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Specialized agents collaborate across every stage and hand work to each other.
                </p>
              </div>
              <div className="bg-ice-2 p-6">
                <p className="text-xs font-semibold text-brand">03</p>
                <h3 className="mt-3 font-display text-xl font-semibold">
                  AI autonomy + citizen control
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Sahayak researches, verifies, prepares and monitors. You approve what is
                  sensitive.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section id="workforce" className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-soft">
                The workforce
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                Six agents, one coordinated journey.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Each agent owns a specific step. When one finishes, the next picks up where it left
              off.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.name} {...agent} />
            ))}
          </div>
        </section>
        <section id="control" className="border-y border-line bg-brand">
          <div className="mx-auto max-w-7xl px-5 py-16 text-primary-foreground sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary-foreground/60">
                Human oversight
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">
                AI autonomy. Citizen control.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-primary-foreground/70">
                Sahayak does the busywork. You approve anything sensitive.
              </p>
            </div>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/55">
                  AI can
                </p>
                <ul className="mt-4 space-y-3">
                  {[
                    "Research and compare schemes",
                    "Verify your eligibility",
                    "Prepare documents and drafts",
                    "Monitor status continuously",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <span className="grid size-7 place-items-center rounded-md bg-primary-foreground/10">
                        <Check className="size-4" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/55">
                  You control
                </p>
                <ul className="mt-4 space-y-3">
                  {[
                    "Sensitive documents",
                    "What data gets shared",
                    "Final submission",
                    "Authorization to act",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <span className="grid size-7 place-items-center rounded-md bg-amber/25">
                        <LockKeyhole className="size-4" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-xs text-muted-foreground sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-brand font-display font-semibold text-primary-foreground">
              S
            </span>
            <span>Sahayak — Your AI workforce for government benefits.</span>
          </div>
          <div className="flex gap-5">
            <Button
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={() => setConsentOpen(true)}
            >
              Privacy & Consent
            </Button>
          </div>
        </footer>
      </main>
      <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
    </div>
  );
}
