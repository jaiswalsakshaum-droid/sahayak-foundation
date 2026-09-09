import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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
  ArrowDown,
  Send,
  FileWarning,
  Sparkles,
  AlertTriangle,
  Play,
  CheckSquare,
  Square,
  UploadCloud,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

const DEMO_STAGES = [
  "Need",
  "Understand",
  "Match",
  "Verify",
  "Documents",
  "Apply",
  "Track",
  "Next Action",
];

const MOCK_SCHEMES = [
  {
    id: "sch-1",
    name: "National Means-cum-Merit Scholarship",
    match: 94,
    benefit: "₹12,000/year",
    reqDocs: ["Income Certificate", "Enrollment Certificate", "Identity Proof"],
    summary: "Matches based on low household income and student enrollment status.",
    official: true,
  },
  {
    id: "sch-2",
    name: "UP Post-Matric Hostel Subsidy",
    match: 87,
    benefit: "Up to ₹2,400 / month",
    reqDocs: ["Domicile Certificate", "Previous Year Marksheet"],
    summary: "Matches state residency requirement.",
    official: true,
  },
  {
    id: "sch-3",
    name: "State Girls Education Grant",
    match: 82,
    benefit: "₹10,000 one-time",
    reqDocs: ["Birth Certificate", "Institution Recommendation"],
    summary: "Specific to female students pursuing higher education.",
    official: true,
  },
];

function DemoPage() {
  const [activeStage, setActiveStage] = useState(0); // 0 to 7
  const [isRunning, setIsRunning] = useState(false);
  const [demoState, setDemoState] = useState<any>({
    input: "",
    citizenMsg: [],
    schemeMsg: [],
    eligibilityMsg: [],
    documentMsg: [],
    appMsg: [],
    trackerMsg: [],
    agentStatus: {
      citizen: "Waiting",
      scheme: "Waiting",
      eligibility: "Waiting",
      document: "Waiting",
      application: "Waiting",
      tracker: "Waiting",
    },
    docUploaded: false,
    docValidating: false,
    docValidated: false,
    consent: {
      info: false,
      docs: false,
      submit: false,
    },
    submitting: false,
    submitted: false,
  });

  const startDemo = () => {
    setIsRunning(true);
    setActiveStage(0); // Need
    setDemoState({
      input: "",
      citizenMsg: [],
      schemeMsg: [],
      eligibilityMsg: [],
      documentMsg: [],
      appMsg: [],
      trackerMsg: [],
      agentStatus: {
        citizen: "Waiting",
        scheme: "Waiting",
        eligibility: "Waiting",
        document: "Waiting",
        application: "Waiting",
        tracker: "Waiting",
      },
      docUploaded: false,
      docValidating: false,
      docValidated: false,
      consent: { info: false, docs: false, submit: false },
      submitting: false,
      submitted: false,
    });

    // Animate typing
    const text =
      "Mere ghar ki income kam hai aur meri beti college mein padh rahi hai. Koi government scholarship ya financial assistance mil sakti hai?";
    let i = 0;
    const typeInterval = setInterval(() => {
      setDemoState((prev: any) => ({ ...prev, input: text.substring(0, i + 1) }));
      i++;
      if (i === text.length) {
        clearInterval(typeInterval);
        setTimeout(runStep2, 1000);
      }
    }, 40);
  };

  const runStep2 = () => {
    setActiveStage(1); // Understand
    setDemoState((prev: any) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, citizen: "Processing" },
      citizenMsg: ["Understanding citizen situation..."],
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        agentStatus: { ...prev.agentStatus, citizen: "Completed" },
        citizenMsg: [...prev.citizenMsg, "Detected education + low-income household."],
      }));
      setTimeout(runStep3, 1500);
    }, 1500);
  };

  const runStep3 = () => {
    setActiveStage(2); // Match
    setDemoState((prev: any) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, scheme: "Processing" },
      schemeMsg: ["Searching relevant schemes..."],
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        agentStatus: { ...prev.agentStatus, scheme: "Completed" },
        schemeMsg: [...prev.schemeMsg, "Found 3 relevant schemes."],
      }));
      setTimeout(runStep4, 2000);
    }, 1500);
  };

  const runStep4 = () => {
    setActiveStage(3); // Verify
    setDemoState((prev: any) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, eligibility: "Processing" },
      eligibilityMsg: ["Checking structured eligibility criteria..."],
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        agentStatus: { ...prev.agentStatus, eligibility: "Waiting" },
        eligibilityMsg: [
          ...prev.eligibilityMsg,
          "Income criterion matched. Student status confirmed.",
        ],
      }));
      setTimeout(runStep5, 1500);
    }, 1500);
  };

  const runStep5 = () => {
    setActiveStage(4); // Documents
    setDemoState((prev: any) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, document: "Processing" },
      documentMsg: ["Identifying required evidence..."],
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        agentStatus: { ...prev.agentStatus, document: "Action Required" },
        documentMsg: [...prev.documentMsg, "Enrollment Certificate is missing."],
      }));
      // Wait for user to click upload
    }, 1500);
  };

  const handleUpload = () => {
    setDemoState((prev: any) => ({
      ...prev,
      docValidating: true,
      agentStatus: { ...prev.agentStatus, document: "Processing" },
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        docValidating: false,
        docValidated: true,
        documentMsg: [
          ...prev.documentMsg,
          "Document classified: Enrollment Certificate",
          "Confidence: 96%",
          "Validation: Success",
        ],
        agentStatus: { ...prev.agentStatus, document: "Completed", eligibility: "Processing" },
        eligibilityMsg: [...prev.eligibilityMsg, "Re-verifying eligibility..."],
      }));

      setTimeout(() => {
        setDemoState((prev: any) => ({
          ...prev,
          agentStatus: { ...prev.agentStatus, eligibility: "Completed" },
          eligibilityMsg: [...prev.eligibilityMsg, "Eligibility criteria verified."],
        }));
        setTimeout(runStep8, 1500);
      }, 1500);
    }, 2000);
  };

  const runStep8 = () => {
    setActiveStage(5); // Apply
    setDemoState((prev: any) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, application: "Processing" },
      appMsg: ["Preparing application..."],
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        agentStatus: { ...prev.agentStatus, application: "Waiting Approval" },
        appMsg: [...prev.appMsg, "Draft ready for human approval."],
      }));
      // Wait for human approval
    }, 1500);
  };

  const handleApprove = () => {
    setDemoState((prev: any) => ({
      ...prev,
      submitting: true,
      agentStatus: { ...prev.agentStatus, application: "Processing" },
      appMsg: [...prev.appMsg, "Preparing submission..."],
    }));
    setTimeout(() => {
      setDemoState((prev: any) => ({
        ...prev,
        appMsg: [...prev.appMsg, "Government Portal: Validating information..."],
      }));
      setTimeout(() => {
        setDemoState((prev: any) => ({
          ...prev,
          submitting: false,
          submitted: true,
          appMsg: [...prev.appMsg, "Demo submission accepted."],
          agentStatus: { ...prev.agentStatus, application: "Completed" },
        }));
        setTimeout(runStep11, 1500);
      }, 1500);
    }, 1500);
  };

  const runStep11 = () => {
    setActiveStage(6); // Track
    setDemoState((prev: any) => ({
      ...prev,
      agentStatus: { ...prev.agentStatus, tracker: "Processing" },
      trackerMsg: ["Monitoring government portal..."],
    }));
    setTimeout(() => {
      setActiveStage(7); // Next action
      setDemoState((prev: any) => ({
        ...prev,
        agentStatus: { ...prev.agentStatus, tracker: "Completed" },
        trackerMsg: [...prev.trackerMsg, "Tracking timeline updated.", "Your journey is complete."],
      }));
    }, 2000);
  };

  const getAgentColor = (status: string) => {
    if (status === "Waiting") return "text-muted-foreground bg-card border-line";
    if (status === "Processing") return "text-brand bg-brand/10 border-brand/30 animate-pulse";
    if (status === "Completed") return "text-sage bg-sage/10 border-sage/30";
    if (status === "Action Required" || status === "Waiting Approval")
      return "text-amber bg-amber/10 border-amber/30";
    return "text-muted-foreground bg-card border-line";
  };

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-5">
          <Link to="/" className="flex items-center gap-2 mr-6 text-foreground hover:text-brand">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak</span>
          </Link>
          <div className="text-sm font-medium ml-4 border-l border-line pl-4 text-muted-foreground">
            Interactive Demo
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl px-5 py-8 mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Header / Intro */}
        <div className="xl:col-span-12 flex flex-col md:flex-row items-start md:items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-semibold mb-2">
              Sahayak — Complete Journey Demo
            </h1>
            <p className="text-muted-foreground text-lg">
              Watch the AI workforce take a citizen from need to next action.
            </p>
          </div>
          {!isRunning && (
            <Button size="lg" className="mt-4 md:mt-0" onClick={startDemo}>
              <Play className="size-4 mr-2" /> Run Complete Sahayak Demo
            </Button>
          )}
        </div>

        {/* Progress UI */}
        <div className="xl:col-span-12 mb-2">
          <div className="bg-card rounded-xl border border-line p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Demo Progress
              </span>
              <span className="text-[11px] font-medium text-brand">
                Step {Math.min(activeStage + 1, 8)} of 8
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-y-3">
              {DEMO_STAGES.map((step, index) => {
                const complete = index < activeStage;
                const current = index === activeStage;
                return (
                  <div className="flex items-center" key={step}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid size-6 place-items-center rounded-full text-[10px] font-semibold transition-colors ${
                          complete
                            ? "bg-sage text-primary-foreground"
                            : current
                              ? "animate-flow-pulse bg-brand text-primary-foreground"
                              : "border border-mist bg-card text-muted-foreground"
                        }`}
                      >
                        {complete ? <Check className="size-3" /> : index + 1}
                      </span>
                      <span
                        className={`text-xs font-medium transition-colors ${
                          current
                            ? "text-brand"
                            : index > activeStage
                              ? "text-muted-foreground"
                              : "text-foreground"
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                    {index < DEMO_STAGES.length - 1 && (
                      <span
                        className={`mx-2 h-px w-5 transition-colors ${index < activeStage ? "bg-sage" : "bg-mist"}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Agent Activity Panel */}
        <div className="xl:col-span-3 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Agent Activity
          </h2>
          <div className="space-y-3">
            {[
              { id: "citizen", name: "Citizen Agent", icon: ShieldCheck },
              { id: "scheme", name: "Scheme Agent", icon: SearchCheck },
              { id: "eligibility", name: "Eligibility Agent", icon: ClipboardCheck },
              { id: "document", name: "Document Agent", icon: FileCheck2 },
              { id: "application", name: "Application Agent", icon: FileText },
              { id: "tracker", name: "Tracker Agent", icon: Landmark },
            ].map((agent) => {
              const status = demoState.agentStatus[agent.id as keyof typeof demoState.agentStatus];
              return (
                <div
                  key={agent.id}
                  className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${getAgentColor(status)}`}
                >
                  <div className="flex items-center gap-2">
                    <agent.icon className="size-4" />
                    <span className="text-sm font-medium">{agent.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider">{status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Demo Area */}
        <div className="xl:col-span-9 bg-card rounded-xl border border-line p-6 shadow-sm min-h-[500px] flex flex-col">
          {!isRunning ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Bot className="size-16 mb-4 opacity-20" />
              <p className="text-lg font-medium text-foreground">Ready to start</p>
              <p className="text-sm">Click the button above to begin the automated demo.</p>
            </div>
          ) : (
            <div className="flex-1 space-y-6 overflow-y-auto pr-2 pb-8">
              {/* Step 1: Input */}
              <div className="animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-4">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-200 font-semibold text-slate-700">
                    Cit
                  </div>
                  <div className="bg-ice-2 p-4 rounded-2xl rounded-tl-none border border-line text-sm max-w-2xl text-foreground font-medium whitespace-pre-wrap">
                    {demoState.input || "..."}
                  </div>
                </div>
              </div>

              {/* Step 2: Citizen Agent */}
              {demoState.citizenMsg.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pl-14 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-1">
                    <ShieldCheck className="size-4" /> Citizen Agent
                  </div>
                  {demoState.citizenMsg.map((msg: string, i: number) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      {msg}
                    </div>
                  ))}
                </div>
              )}

              {/* Step 3: Scheme Agent */}
              {demoState.schemeMsg.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pl-14 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-1">
                    <SearchCheck className="size-4" /> Scheme Agent
                  </div>
                  {demoState.schemeMsg.map((msg: string, i: number) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      {msg}
                    </div>
                  ))}

                  {demoState.schemeMsg.length > 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      {MOCK_SCHEMES.slice(0, 2).map((scheme) => (
                        <div key={scheme.id} className="p-4 rounded-xl border border-line bg-ice-2">
                          <h3 className="font-semibold text-sm mb-1 line-clamp-1">{scheme.name}</h3>
                          <p className="text-brand font-medium text-xs mb-2">{scheme.benefit}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {scheme.summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Eligibility Agent */}
              {demoState.eligibilityMsg.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pl-14 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-1">
                    <ClipboardCheck className="size-4" /> Eligibility Agent
                  </div>
                  {demoState.eligibilityMsg.map((msg: string, i: number) => (
                    <div
                      key={i}
                      className={`text-sm ${msg.includes("verified") ? "text-sage font-medium" : "text-muted-foreground"}`}
                    >
                      {msg}
                    </div>
                  ))}
                </div>
              )}

              {/* Step 5 & 6: Document Agent & Upload */}
              {demoState.documentMsg.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pl-14 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-1">
                    <FileCheck2 className="size-4" /> Document Agent
                  </div>
                  {demoState.documentMsg.map((msg: string, i: number) => (
                    <div
                      key={i}
                      className={`text-sm ${msg.includes("missing") ? "text-amber font-medium flex items-center gap-2" : "text-muted-foreground"}`}
                    >
                      {msg.includes("missing") && <AlertTriangle className="size-4" />}
                      {msg}
                    </div>
                  ))}

                  {!demoState.docUploaded && demoState.documentMsg.length > 1 && (
                    <div className="mt-4 p-6 border-2 border-dashed border-line rounded-xl flex flex-col items-center justify-center text-center bg-ice-2">
                      <UploadCloud className="size-8 text-muted-foreground mb-3" />
                      <p className="font-medium text-sm mb-4">
                        Please upload Enrollment Certificate to continue.
                      </p>
                      <Button
                        onClick={() => {
                          setDemoState((p: any) => ({ ...p, docUploaded: true }));
                          handleUpload();
                        }}
                      >
                        Upload Demo Document
                      </Button>
                    </div>
                  )}

                  {demoState.docValidating && (
                    <div className="flex items-center gap-2 text-sm text-brand font-medium">
                      <Loader2 className="size-4 animate-spin" /> Validating document...
                    </div>
                  )}
                </div>
              )}

              {/* Step 8 & 9: Application Agent & Approval */}
              {demoState.appMsg.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pl-14 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-1">
                    <FileText className="size-4" /> Application Agent
                  </div>
                  {demoState.appMsg.map((msg: string, i: number) => (
                    <div key={i} className="text-sm text-muted-foreground">
                      {msg}
                    </div>
                  ))}

                  {demoState.appMsg.length > 1 && !demoState.submitting && !demoState.submitted && (
                    <div className="mt-4 p-6 bg-card border-2 border-brand/30 rounded-xl shadow-sm">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-brand">
                        <ShieldCheck className="size-5" /> Your approval is required
                      </h3>
                      <div className="space-y-3 mb-6">
                        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-ice-2">
                          <button
                            onClick={() =>
                              setDemoState((p: any) => ({
                                ...p,
                                consent: { ...p.consent, info: !p.consent.info },
                              }))
                            }
                            className="mt-0.5 shrink-0 text-brand"
                          >
                            {demoState.consent.info ? (
                              <CheckSquare className="size-5" />
                            ) : (
                              <Square className="size-5" />
                            )}
                          </button>
                          <span className="text-sm font-medium">
                            I have reviewed my information.
                          </span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-ice-2">
                          <button
                            onClick={() =>
                              setDemoState((p: any) => ({
                                ...p,
                                consent: { ...p.consent, submit: !p.consent.submit },
                              }))
                            }
                            className="mt-0.5 shrink-0 text-brand"
                          >
                            {demoState.consent.submit ? (
                              <CheckSquare className="size-5" />
                            ) : (
                              <Square className="size-5" />
                            )}
                          </button>
                          <span className="text-sm font-medium">
                            I approve this application for final submission.
                          </span>
                        </label>
                      </div>
                      <Button
                        disabled={!demoState.consent.info || !demoState.consent.submit}
                        onClick={handleApprove}
                      >
                        Approve & Continue
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 11: Tracker & Final Result */}
              {demoState.trackerMsg.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 pl-14 space-y-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-brand uppercase tracking-wider mb-1">
                      <Landmark className="size-4" /> Tracker Agent
                    </div>
                    {demoState.trackerMsg.map((msg: string, i: number) => (
                      <div key={i} className="text-sm text-muted-foreground mb-1">
                        {msg}
                      </div>
                    ))}
                  </div>

                  {demoState.trackerMsg.length > 1 && (
                    <div className="p-6 bg-sage/10 border border-sage/30 rounded-xl">
                      <h3 className="font-display text-2xl font-semibold mb-4 text-sage flex items-center gap-2">
                        <CheckCircle2 className="size-6" /> Your journey is complete.
                      </h3>

                      <div className="flex flex-wrap gap-4 mb-6">
                        <span className="text-sm font-medium text-sage flex items-center gap-1">
                          <Check className="size-4" /> Need
                        </span>
                        <span className="text-sm font-medium text-sage flex items-center gap-1">
                          <Check className="size-4" /> Eligibility
                        </span>
                        <span className="text-sm font-medium text-sage flex items-center gap-1">
                          <Check className="size-4" /> Documents
                        </span>
                        <span className="text-sm font-medium text-sage flex items-center gap-1">
                          <Check className="size-4" /> Application
                        </span>
                        <span className="text-sm font-medium text-sage flex items-center gap-1">
                          <Check className="size-4" /> Tracking
                        </span>
                      </div>

                      <div className="pt-4 border-t border-sage/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-sage/70 font-bold mb-1">
                            Next action
                          </p>
                          <p className="font-medium text-sage">
                            No action required. Application is under department review.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          className="bg-white border-sage/30 text-sage hover:bg-sage/5"
                        >
                          View Application
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
