import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  FileText,
  Landmark,
  ShieldCheck,
  SearchCheck,
  ClipboardCheck,
  FileCheck2,
  Loader2,
  Send,
  FileWarning,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/assistant")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AssistantPage,
});

const examplePrompts = [
  "I need financial help for my daughter's education.",
  "I am a farmer and need government support.",
  "I recently lost my job. What support is available?",
  "Mujhe scholarship ke liye apply karna hai.",
];

const MOCK_SCHEMES = [
  {
    id: "sch-1",
    name: "National Scholarship",
    match: 94,
    benefit: "₹25,000/year",
    reqDocs: ["Income Certificate", "Enrollment Certificate", "Identity Proof"],
    summary: "Matches based on low household income and student enrollment status.",
    official: true,
    lastVerified: "Today",
  },
  {
    id: "sch-2",
    name: "State Education Support (Sample)",
    match: 88,
    benefit: "₹15,000/year",
    reqDocs: ["Domicile Certificate", "Previous Year Marksheet"],
    summary: "Matches state residency requirement.",
    official: true,
    lastVerified: "2 days ago",
  },
  {
    id: "sch-3",
    name: "Girls Higher Education Grant",
    match: 82,
    benefit: "₹10,000 one-time",
    reqDocs: ["Birth Certificate", "Institution Recommendation"],
    summary: "Specific to female students pursuing higher education.",
    official: true,
    lastVerified: "1 week ago",
  },
];

import { useAgentRun } from "@/hooks/use-agent-run";

type JourneyStep = {
  id: string;
  agentId: string;
  name: string;
  icon: any;
  messages: string[];
  handoffMessage?: string;
};

function AssistantPage() {
  const [input, setInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<(typeof MOCK_SCHEMES)[0] | null>(null);

  const { runId, events, status, activeAgentIndex, startRun } = useAgentRun();

  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([
    {
      id: "s1",
      agentId: "citizen",
      name: "Citizen Agent",
      icon: ShieldCheck,
      messages: [],
      handoffMessage: "Passing citizen context...",
    },
    {
      id: "s2",
      agentId: "scheme",
      name: "Scheme Agent",
      icon: SearchCheck,
      messages: [],
      handoffMessage: "Passing matched schemes...",
    },
    {
      id: "s3",
      agentId: "eligibility",
      name: "Eligibility Agent",
      icon: ClipboardCheck,
      messages: [],
      handoffMessage: "Passing criteria requirements...",
    },
    {
      id: "s4",
      agentId: "document",
      name: "Document Agent",
      icon: FileCheck2,
      messages: [],
      handoffMessage: "Passing missing document flags...",
    },
    {
      id: "s5",
      agentId: "application",
      name: "Application Agent",
      icon: FileText,
      messages: [],
    },
  ]);

  // Sync Realtime events into journey step messages
  useEffect(() => {
    if (events.length === 0) return;

    events.forEach((ev) => {
      const agentLower = ev.agent_name.toLowerCase();
      let stepIdx = -1;
      if (agentLower.includes("citizen")) stepIdx = 0;
      else if (agentLower.includes("scheme")) stepIdx = 1;
      else if (agentLower.includes("eligibility")) stepIdx = 2;
      else if (agentLower.includes("document")) stepIdx = 3;
      else if (agentLower.includes("application")) stepIdx = 4;

      if (stepIdx !== -1) {
        setJourneySteps((prev) => {
          const copy = [...prev];
          if (!copy[stepIdx].messages.includes(ev.action)) {
            copy[stepIdx] = {
              ...copy[stepIdx],
              messages: [...copy[stepIdx].messages, ev.action],
            };
          }
          return copy;
        });
      }
    });

    if (activeAgentIndex >= 0) {
      setActiveStepIndex(activeAgentIndex);
    }

    if (status === "ACTION_REQUIRED" || status === "COMPLETED") {
      setShowResults(true);
    }
  }, [events, activeAgentIndex, status]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput(text);
    setHasStarted(true);
    setActiveStepIndex(0);
    setShowResults(false);
    setJourneySteps((prev) => prev.map((s) => ({ ...s, messages: [] })));

    // Trigger backend LangGraph orchestration via Edge Function / Realtime
    await startRun(text);

    // Fallback simulation timer to guarantee smooth UI reveal if offline
    setTimeout(() => {
      setJourneySteps((prev) => {
        const copy = [...prev];
        if (copy[0].messages.length === 0) {
          copy[0].messages = [
            "Understanding citizen situation...",
            "Detected education + low-income household.",
          ];
        }
        return copy;
      });
      setActiveStepIndex(1);
    }, 2000);

    setTimeout(() => {
      setJourneySteps((prev) => {
        const copy = [...prev];
        if (copy[1].messages.length === 0) {
          copy[1].messages = [
            "Scanning schemes catalog...",
            "4 potentially relevant schemes found.",
          ];
        }
        return copy;
      });
      setActiveStepIndex(2);
    }, 4500);

    setTimeout(() => {
      setJourneySteps((prev) => {
        const copy = [...prev];
        if (copy[2].messages.length === 0) {
          copy[2].messages = ["Evaluating household income and enrollment criteria..."];
        }
        return copy;
      });
      setActiveStepIndex(3);
    }, 7000);

    setTimeout(() => {
      setJourneySteps((prev) => {
        const copy = [...prev];
        if (copy[3].messages.length === 0) {
          copy[3].messages = ["1 required document missing (Enrollment Certificate)."];
        }
        return copy;
      });
      setShowResults(true);
    }, 9500);
  };

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <div className="flex items-center gap-4 w-full">
            <Link to="/" className="text-muted-foreground hover:text-foreground">
              <span className="grid size-8 place-items-center rounded-lg bg-card border border-line">
                <ArrowRight className="size-4 rotate-180" />
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-primary-foreground">
                <Bot className="size-4" />
              </span>
              <span className="font-display font-semibold hidden sm:block">Sahayak Workforce</span>
            </div>
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(examplePrompts[0]);
                  startWorkforce();
                }}
              >
                Start Orchestration
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8 flex flex-col">
        {!hasStarted ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full text-center py-20">
            <h1 className="text-4xl font-display font-semibold mb-4">How can we help you today?</h1>
            <p className="text-muted-foreground mb-8 text-lg">
              Tell us your need, and our AI workforce will find and verify the best schemes for you.
            </p>

            <div className="w-full relative mb-8">
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-line bg-card p-4 pr-12 text-base resize-none focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
                placeholder="E.g. I need financial help for my daughter's education..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button
                size="icon"
                className="absolute bottom-3 right-3 rounded-lg"
                onClick={() => handleSend(input)}
              >
                <Send className="size-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
              {examplePrompts.map((p, i) => (
                <button
                  key={i}
                  className="p-3 text-sm rounded-lg border border-line bg-card hover:border-brand/50 hover:bg-brand/5 transition-colors text-left"
                  onClick={() => handleSend(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-8">
            <div className="flex-1 lg:max-w-[450px]">
              <div className="mb-6 rounded-xl border border-line bg-card p-5 shadow-sm">
                <p className="text-sm text-muted-foreground mb-1">Your Request</p>
                <p className="text-base font-medium">{input}</p>
              </div>

              <div className="space-y-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="size-5 text-brand" />
                  Workforce Execution
                </h2>

                <div className="relative pl-6 border-l-2 border-line space-y-10 py-4 ml-4">
                  {journeySteps.map((step, index) => {
                    // Only show steps that have been reached
                    if (index > activeStepIndex && !showResults && activeStepIndex !== -1)
                      return null;

                    // Hide future steps when showing results if they haven't been processed
                    if (showResults && step.messages.length === 0) return null;

                    const isCurrent = index === activeStepIndex;
                    const isPast = index < activeStepIndex || showResults;

                    return (
                      <div key={step.id} className="relative">
                        <span
                          className={`absolute -left-[41px] grid size-8 place-items-center rounded-full border-2 ${isCurrent ? "bg-brand border-brand text-primary-foreground animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.5)]" : "bg-card border-line text-muted-foreground"}`}
                        >
                          <step.icon className="size-4" />
                        </span>

                        <div className="pl-2">
                          <h3
                            className={`font-medium ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {step.name}
                          </h3>

                          {step.messages.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {step.messages.map((msg, i) => (
                                <div
                                  key={i}
                                  className="text-sm rounded-md bg-ice-2 p-2.5 border border-line text-muted-foreground shadow-sm"
                                >
                                  {msg}
                                </div>
                              ))}
                            </div>
                          )}

                          {isCurrent && step.messages.length === 0 && (
                            <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                              <Loader2 className="size-3 animate-spin" /> Starting...
                            </div>
                          )}
                        </div>

                        {/* Animated handoff arrow between agents if past */}
                        {isPast && step.handoffMessage && (
                          <div className="absolute -bottom-[38px] -left-[30px] flex items-center gap-4 text-xs font-medium text-brand/70">
                            <ArrowDown className="size-5 animate-bounce text-brand" />
                            <span className="bg-brand/10 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                              {step.handoffMessage}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1">
              {showResults ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-display font-semibold">Matched Schemes</h2>
                    <span className="text-sm bg-brand/10 text-brand px-3 py-1 rounded-full font-medium">
                      96% evidence confidence
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground bg-card p-3 rounded-lg border border-line shadow-sm">
                    Match score is a prioritization aid and is not an official government
                    eligibility decision.
                  </p>

                  <div className="grid gap-4">
                    {MOCK_SCHEMES.map((scheme) => (
                      <div
                        key={scheme.id}
                        className="rounded-xl border border-line bg-card p-5 hover:border-brand/50 transition-colors cursor-pointer shadow-sm"
                        onClick={() => setSelectedScheme(scheme)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                              {scheme.name}
                              {scheme.official && <CheckCircle2 className="size-4 text-brand" />}
                            </h3>
                            <p className="text-brand font-medium mt-1">{scheme.benefit}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-sage">{scheme.match}%</div>
                            <div className="text-xs text-muted-foreground">Match</div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{scheme.summary}</p>

                        <div className="flex gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground block mb-1">Required</span>
                            <span className="font-medium">{scheme.reqDocs.length} Documents</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Last Verified</span>
                            <span className="font-medium">{scheme.lastVerified}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="hidden lg:flex h-[600px] items-center justify-center border-2 border-dashed border-line rounded-xl text-muted-foreground bg-card/50">
                  <div className="text-center p-8">
                    <Bot className="size-12 mx-auto mb-4 opacity-20" />
                    <p>
                      Results will appear here once the workforce completes its initial matching.
                    </p>
                    <p className="text-sm mt-2 max-w-xs mx-auto">
                      Evaluating citizen context, schemes, and determining eligibility.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!selectedScheme} onOpenChange={() => setSelectedScheme(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedScheme && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedScheme.name}</DialogTitle>
              </DialogHeader>

              <div className="mt-6 space-y-8">
                <div>
                  <h3 className="font-semibold mb-2 text-lg">
                    Why Sahayak thinks this scheme matches
                  </h3>
                  <p className="text-muted-foreground">4 of 5 criteria are currently verified.</p>
                </div>

                <div className="rounded-lg border border-line overflow-hidden shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-ice-2 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">Criterion</th>
                        <th className="px-4 py-3 font-medium">Citizen information</th>
                        <th className="px-4 py-3 font-medium">Requirement</th>
                        <th className="px-4 py-3 font-medium">Evidence</th>
                        <th className="px-4 py-3 font-medium text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-card">
                      <tr>
                        <td className="px-4 py-4 font-medium">Age</td>
                        <td className="px-4 py-4 text-muted-foreground">20</td>
                        <td className="px-4 py-4 text-muted-foreground">18–25</td>
                        <td className="px-4 py-4 text-muted-foreground">Profile</td>
                        <td className="px-4 py-4 text-center">
                          <CheckCircle2 className="size-5 text-sage inline" />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 font-medium">Student status</td>
                        <td className="px-4 py-4 text-muted-foreground">Undergraduate</td>
                        <td className="px-4 py-4 text-muted-foreground">Undergraduate</td>
                        <td className="px-4 py-4 text-muted-foreground">Profile</td>
                        <td className="px-4 py-4 text-center">
                          <CheckCircle2 className="size-5 text-sage inline" />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 font-medium">Household income</td>
                        <td className="px-4 py-4 text-muted-foreground">₹2.1L</td>
                        <td className="px-4 py-4 text-muted-foreground">Below ₹3L</td>
                        <td className="px-4 py-4 text-muted-foreground">Income Certificate</td>
                        <td className="px-4 py-4 text-center">
                          <CheckCircle2 className="size-5 text-sage inline" />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-4 font-medium">Residence</td>
                        <td className="px-4 py-4 text-muted-foreground">Uttar Pradesh</td>
                        <td className="px-4 py-4 text-muted-foreground">Applicable</td>
                        <td className="px-4 py-4 text-muted-foreground">Profile</td>
                        <td className="px-4 py-4 text-center">
                          <CheckCircle2 className="size-5 text-sage inline" />
                        </td>
                      </tr>
                      <tr className="bg-amber/5">
                        <td className="px-4 py-4 font-medium">Enrollment certificate</td>
                        <td className="px-4 py-4 text-amber font-medium">Missing</td>
                        <td className="px-4 py-4 text-muted-foreground">Required</td>
                        <td className="px-4 py-4 text-muted-foreground">—</td>
                        <td className="px-4 py-4 text-center">
                          <FileWarning className="size-5 text-amber inline" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-line">
                  <Button variant="outline" onClick={() => setSelectedScheme(null)}>
                    Close
                  </Button>
                  <Button>Upload Missing Document</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
