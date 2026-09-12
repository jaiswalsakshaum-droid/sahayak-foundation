import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { requireAuth } from "@/lib/auth";
import { useAgentRun } from "@/hooks/use-agent-run";
import {
  findRelevantSchemes,
  understandCitizenNeed,
  checkEligibility,
  type SchemeMatch,
} from "@/lib/services";
import { LanguageSwitcher } from "@/components/sahayak";

export const Route = createFileRoute("/assistant")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: AssistantPage,
});

type JourneyStep = {
  id: string;
  agentId: string;
  name: string;
  icon: any;
  messages: string[];
};

export function AssistantPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [candidateSchemes, setCandidateSchemes] = useState<SchemeMatch[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<SchemeMatch | null>(null);
  const [schemeCriteria, setSchemeCriteria] = useState<any[]>([]);

  const { runId, events, status, activeAgentIndex, latestData, isReconnecting, startRun } =
    useAgentRun();

  const [journeySteps, setJourneySteps] = useState<JourneyStep[]>([
    {
      id: "s1",
      agentId: "citizen",
      name: "Citizen Agent",
      icon: ShieldCheck,
      messages: [],
    },
    {
      id: "s2",
      agentId: "scheme",
      name: "Scheme Agent",
      icon: SearchCheck,
      messages: [],
    },
    {
      id: "s3",
      agentId: "eligibility",
      name: "Eligibility Agent",
      icon: ClipboardCheck,
      messages: [],
    },
    {
      id: "s4",
      agentId: "document",
      name: "Document Agent",
      icon: FileCheck2,
      messages: [],
    },
    {
      id: "s5",
      agentId: "application",
      name: "Application Agent",
      icon: FileText,
      messages: [],
    },
    {
      id: "s6",
      agentId: "tracker",
      name: "Tracker Agent",
      icon: Landmark,
      messages: [],
    },
  ]);

  const examplePrompts = [
    "I need financial help for my daughter's education.",
    "I am a farmer and need government support.",
    "I recently lost my job. What support is available?",
    "Mujhe scholarship ke liye apply karna hai.",
  ];

  // Sync incoming Realtime events into journey step messages
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
      else if (agentLower.includes("tracker")) stepIdx = 5;

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

    // Process candidate schemes payload if returned in event details
    if (latestData?.candidate_schemes && Array.isArray(latestData.candidate_schemes)) {
      setCandidateSchemes(
        latestData.candidate_schemes.map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category || "General",
          benefit: s.benefit || "Government Support",
          matchScore: s.match_score || 90,
          description: s.reasoning || s.description || "",
          official: true,
          reqDocs: ["Aadhaar Card", "Income Certificate"],
          lastVerified: "Today",
        })),
      );
    }

    if (status === "ACTION_REQUIRED" || status === "COMPLETED") {
      setShowResults(true);
    }
  }, [events, activeAgentIndex, status, latestData]);

  // Load criteria when a scheme is selected in dialog
  useEffect(() => {
    if (selectedScheme) {
      checkEligibility(selectedScheme.id).then((res) => {
        setSchemeCriteria(res.criteria);
      });
    } else {
      setSchemeCriteria([]);
    }
  }, [selectedScheme]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    setInput(text);
    setHasStarted(true);
    setActiveStepIndex(0);
    setShowResults(false);
    setCandidateSchemes([]);
    setJourneySteps((prev) => prev.map((s) => ({ ...s, messages: [] })));

    // 1. Fetch matching schemes catalog via live service
    const intent = await understandCitizenNeed(text);
    const matched = await findRelevantSchemes(intent);

    // 2. Trigger real backend LangGraph orchestration run
    const resRunId = await startRun(text);
    if (resRunId) {
      setCandidateSchemes(matched);
    }
  };

  const handleRetry = () => {
    if (input) {
      handleSend(input);
    }
  };

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <div className="flex items-center gap-4 w-full">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
              <span className="grid size-8 place-items-center rounded-lg bg-card border border-line">
                <ArrowRight className="size-4 rotate-180" />
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-primary-foreground">
                <Bot className="size-4" />
              </span>
              <span className="font-display font-semibold hidden sm:block">
                {t("assistant.badge", "Citizen AI Workforce")}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {isReconnecting && (
                <span className="text-xs text-amber flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Reconnecting...
                </span>
              )}
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8 flex flex-col">
        {!hasStarted ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full text-center py-20">
            <h1 className="text-4xl font-display font-semibold mb-4">
              {t("assistant.title", "What benefit or support are you looking for today?")}
            </h1>
            <p className="text-muted-foreground mb-8 text-base">
              {t(
                "assistant.subtitle",
                "Speak or type in your language. 6 specialized AI agents will verify rules, check documents, and draft applications with your consent.",
              )}
            </p>

            <div className="w-full relative mb-8">
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-line bg-card p-4 pr-12 text-base resize-none focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
                placeholder={t(
                  "assistant.inputPlaceholder",
                  "e.g., I am a college student from UP needing scholarship support...",
                )}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <Button
                size="icon"
                className="absolute bottom-3 right-3 rounded-lg"
                onClick={() => handleSend(input)}
                disabled={!input.trim()}
              >
                <Send className="size-4" />
              </Button>
            </div>

            <div className="w-full text-left mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {t("assistant.suggestedPrompts", "Suggested queries:")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {examplePrompts.map((p, i) => (
                  <button
                    key={i}
                    className="p-3 text-sm rounded-lg border border-line bg-card hover:border-brand/50 hover:bg-brand/5 transition-colors text-left text-muted-foreground hover:text-foreground"
                    onClick={() => handleSend(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-8">
            {/* Workforce execution column */}
            <div className="flex-1 lg:max-w-[450px]">
              <div className="mb-6 rounded-xl border border-line bg-card p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Your Query
                </p>
                <p className="text-base font-medium">{input}</p>
              </div>

              {/* Error State with Retry Button */}
              {status === "ERROR" && (
                <div className="mb-6 rounded-xl border border-coral/30 bg-coral/10 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-coral shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-coral text-sm">
                        {t("assistant.errorTitle", "Assistant Encountered an Issue")}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t(
                          "assistant.errorDesc",
                          "Unable to complete agent workflow. Please check your connection and try again.",
                        )}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetry}
                        className="mt-3 gap-1.5 border-coral/40 text-coral hover:bg-coral/10"
                      >
                        <RefreshCw className="size-3.5" />
                        {t("assistant.retry", "Retry Run")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 font-display">
                  <Sparkles className="size-5 text-brand" />
                  Workforce Orchestration
                </h2>

                <div className="relative pl-6 border-l-2 border-line space-y-8 py-2 ml-4">
                  {journeySteps.map((step, index) => {
                    const isCurrent = index === activeStepIndex && status === "PROCESSING";
                    const isPast = index < activeStepIndex || showResults;

                    if (index > activeStepIndex && !showResults && activeStepIndex !== -1) {
                      return null;
                    }
                    if (showResults && step.messages.length === 0) return null;

                    return (
                      <div key={step.id} className="relative">
                        <span
                          className={`absolute -left-[41px] grid size-8 place-items-center rounded-full border-2 ${
                            isCurrent
                              ? "bg-brand border-brand text-primary-foreground animate-pulse shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                              : isPast
                                ? "bg-sage border-sage text-primary-foreground"
                                : "bg-card border-line text-muted-foreground"
                          }`}
                        >
                          <step.icon className="size-4" />
                        </span>

                        <div className="pl-2">
                          <h3
                            className={`font-medium text-sm ${
                              isCurrent
                                ? "text-brand font-semibold"
                                : isPast
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {step.name}
                          </h3>

                          {step.messages.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {step.messages.map((msg, i) => (
                                <div
                                  key={i}
                                  className="text-xs rounded-md bg-card p-2.5 border border-line text-muted-foreground shadow-none"
                                >
                                  {msg}
                                </div>
                              ))}
                            </div>
                          )}

                          {isCurrent && step.messages.length === 0 && (
                            <div className="mt-2 text-xs text-brand flex items-center gap-2">
                              <Loader2 className="size-3.5 animate-spin" />
                              {t("assistant.waitingAgent", { agent: step.name })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Schemes Results Column */}
            <div className="flex-1">
              {status === "ERROR" ? (
                <div className="flex h-[450px] flex-col items-center justify-center rounded-xl border border-coral/30 bg-card p-8 text-center shadow-sm">
                  <AlertCircle className="size-12 text-coral mb-3" />
                  <h3 className="text-lg font-semibold text-foreground font-display">
                    {t("assistant.errorTitle", "Assistant Encountered an Issue")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    {t(
                      "assistant.errorDesc",
                      "Unable to complete agent workflow. Please check your connection and try again.",
                    )}
                  </p>
                  <Button
                    onClick={handleRetry}
                    className="mt-5 gap-1.5 bg-brand hover:bg-brand/90"
                    size="sm"
                  >
                    <RefreshCw className="size-3.5" />
                    {t("assistant.retry", "Retry Run")}
                  </Button>
                </div>
              ) : showResults || candidateSchemes.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-display font-semibold">
                      {t("assistant.matchedSchemes", "Discovered Matching Schemes")}
                    </h2>
                    <span className="text-xs bg-brand/10 text-brand px-3 py-1 rounded-full font-medium">
                      Verified Catalog
                    </span>
                  </div>

                  <div className="grid gap-4">
                    {candidateSchemes.map((scheme) => (
                      <div
                        key={scheme.id}
                        className="rounded-xl border border-line bg-card p-5 hover:border-brand/40 transition-colors shadow-none"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-soft">
                              {scheme.category}
                            </span>
                            <h3 className="font-semibold text-lg flex items-center gap-2 mt-0.5">
                              {scheme.name}
                              {scheme.official && <CheckCircle2 className="size-4 text-brand" />}
                            </h3>
                            <p className="text-brand font-medium text-sm mt-1">{scheme.benefit}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold font-display text-sage">
                              {scheme.matchScore}%
                            </div>
                            <div className="text-[11px] text-muted-foreground">Match</div>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                          {scheme.description}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-brand hover:bg-brand/5 p-0 h-auto font-medium"
                            onClick={() => setSelectedScheme(scheme)}
                          >
                            {t("assistant.viewEligibility", "View Eligibility Breakdown")}{" "}
                            <ChevronRight className="size-3.5 ml-0.5" />
                          </Button>

                          <Button
                            size="sm"
                            onClick={() =>
                              navigate({ to: "/documents", search: { scheme: scheme.id } })
                            }
                          >
                            {t("assistant.startApplication", {
                              docCount: scheme.reqDocs?.length || 3,
                            })}
                            <ArrowRight className="size-3.5 ml-1.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="hidden lg:flex h-[500px] items-center justify-center border-2 border-dashed border-line rounded-xl text-muted-foreground bg-card/50">
                  <div className="text-center p-8">
                    <Loader2 className="size-10 mx-auto mb-4 text-brand animate-spin" />
                    <p className="font-medium text-foreground">
                      {t("assistant.processing", "Orchestrating AI workforce...")}
                    </p>
                    <p className="text-xs mt-1 max-w-xs mx-auto text-muted-foreground">
                      Evaluating profile criteria, scheme rules, and required proofs in real time.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Scheme Eligibility Breakdown Dialog */}
      <Dialog open={!!selectedScheme} onOpenChange={() => setSelectedScheme(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedScheme && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-display">{selectedScheme.name}</DialogTitle>
                <p className="text-xs text-muted-foreground">
                  {selectedScheme.category} · {selectedScheme.benefit}
                </p>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                <div>
                  <h3 className="font-semibold text-sm mb-1">
                    {t("assistant.criteriaHeader", "Eligibility Criteria Evaluation")}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Rules evaluated automatically by Eligibility Agent and Document Agent.
                  </p>
                </div>

                <div className="rounded-lg border border-line overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-ice-2 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">{t("assistant.rule", "Rule")}</th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("assistant.yourInfo", "Your Profile Data")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("assistant.requirement", "Scheme Requirement")}
                        </th>
                        <th className="px-3 py-2.5 font-medium text-center">
                          {t("assistant.status", "Status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-card">
                      {schemeCriteria.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                            <Loader2 className="size-4 animate-spin inline mr-2" /> Evaluating
                            rules...
                          </td>
                        </tr>
                      ) : (
                        schemeCriteria.map((crit, idx) => (
                          <tr key={idx} className={crit.status === "missing" ? "bg-amber/5" : ""}>
                            <td className="px-3 py-3 font-medium text-foreground">{crit.name}</td>
                            <td className="px-3 py-3 text-muted-foreground">{crit.citizenInfo}</td>
                            <td className="px-3 py-3 text-muted-foreground">{crit.requirement}</td>
                            <td className="px-3 py-3 text-center">
                              {crit.status === "verified" ? (
                                <CheckCircle2 className="size-4 text-sage inline" />
                              ) : (
                                <FileWarning className="size-4 text-amber inline" />
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-line">
                  <Button variant="outline" size="sm" onClick={() => setSelectedScheme(null)}>
                    {t("common.close", "Close")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const schemeId = selectedScheme.id;
                      setSelectedScheme(null);
                      navigate({ to: "/documents", search: { scheme: schemeId } });
                    }}
                  >
                    {t("assistant.uploadMissingDoc", "Upload Missing Document")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
