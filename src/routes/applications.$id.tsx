import { createFileRoute, Link, useParams, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  FileText,
  AlertTriangle,
  FileWarning,
  Clock,
  Landmark,
  ShieldCheck,
  CheckSquare,
  Square,
  Pencil,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/applications/$id")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !localStorage.getItem("sahayak_auth")) {
      throw redirect({ to: "/login" });
    }
  },
  component: ApplicationDetailPage,
});

function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const [viewState, setViewState] = useState<"review" | "submitting" | "tracking">("review");
  const [checks, setChecks] = useState({
    info: false,
    docs: false,
    submit: false,
  });

  const canSubmit = checks.info && checks.docs && checks.submit;

  const handleApprove = () => {
    if (!canSubmit) return;
    setViewState("submitting");

    // Simulate submission flow
    setTimeout(() => {
      setViewState("tracking");
    }, 4500);
  };

  const fields = [
    {
      section: "Applicant Information",
      items: [
        { label: "Full Name", value: "Sakshi Kumari", status: "verified" },
        { label: "Date of Birth", value: "15-08-2003", status: "verified" },
      ],
    },
    {
      section: "Education Information",
      items: [
        { label: "Education Level", value: "Undergraduate", status: "verified" },
        { label: "Institution", value: "State University", status: "verified" },
      ],
    },
    {
      section: "Income Information",
      items: [{ label: "Annual Income", value: "₹2,10,000", status: "verified" }],
    },
    {
      section: "Bank Information",
      items: [
        { label: "Account Number", value: "XXXX-XXXX-9876", status: "needs_review" },
        { label: "IFSC Code", value: "SBIN0001234", status: "needs_review" },
      ],
    },
  ];

  const documents = [
    { name: "Aadhaar Card", status: "verified" },
    { name: "Income Certificate", status: "verified" },
    { name: "Enrollment Certificate", status: "verified" },
  ];

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <Link
            to="/applications"
            className="flex items-center gap-2 mr-6 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-5" /> Back to Applications
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-brand text-sm font-semibold text-primary-foreground">
              <Bot className="size-4" />
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak Workspace</span>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Timeline & Status */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-card rounded-xl border border-line p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Application Journey
            </h2>

            <div className="relative pl-6 border-l-2 border-line space-y-6 py-2 ml-2">
              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full bg-sage text-white">
                  <Check className="size-3.5" />
                </span>
                <p className="text-sm font-medium">Need understood</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full bg-sage text-white">
                  <Check className="size-3.5" />
                </span>
                <p className="text-sm font-medium">Scheme matched</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full bg-sage text-white">
                  <Check className="size-3.5" />
                </span>
                <p className="text-sm font-medium">Eligibility verified</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full bg-sage text-white">
                  <Check className="size-3.5" />
                </span>
                <p className="text-sm font-medium">Documents checked</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full bg-sage text-white">
                  <Check className="size-3.5" />
                </span>
                <p className="text-sm font-medium">Application prepared</p>
              </div>

              <div className="relative">
                <span
                  className={`absolute -left-[35px] grid size-6 place-items-center rounded-full border-2 ${viewState === "review" ? "border-amber bg-amber/20 text-amber" : "bg-sage border-sage text-white"}`}
                >
                  {viewState === "review" ? (
                    <div className="size-2 rounded-full bg-amber animate-pulse" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                </span>
                <p
                  className={`text-sm font-medium ${viewState === "review" ? "text-amber" : "text-foreground"}`}
                >
                  {viewState === "review" ? "Awaiting citizen approval" : "Citizen approved"}
                </p>
              </div>

              <div className="relative">
                <span
                  className={`absolute -left-[35px] grid size-6 place-items-center rounded-full border-2 ${viewState === "submitting" ? "border-brand bg-brand/20" : viewState === "tracking" ? "bg-sage border-sage text-white" : "border-line bg-ice-2"}`}
                >
                  {viewState === "submitting" ? (
                    <div className="size-2 rounded-full bg-brand animate-pulse" />
                  ) : viewState === "tracking" ? (
                    <Check className="size-3.5" />
                  ) : null}
                </span>
                <p
                  className={`text-sm font-medium ${viewState === "submitting" ? "text-brand" : viewState === "tracking" ? "text-foreground" : "text-muted-foreground"}`}
                >
                  Submission
                </p>
              </div>

              <div className="relative">
                <span
                  className={`absolute -left-[35px] grid size-6 place-items-center rounded-full border-2 ${viewState === "tracking" ? "border-amber bg-amber/20" : "border-line bg-ice-2"}`}
                >
                  {viewState === "tracking" && (
                    <div className="size-2 rounded-full bg-amber animate-pulse" />
                  )}
                </span>
                <p
                  className={`text-sm font-medium ${viewState === "tracking" ? "text-amber" : "text-muted-foreground"}`}
                >
                  Department review
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full border-2 border-line bg-ice-2" />
                <p className="text-sm font-medium text-muted-foreground">Decision</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[35px] grid size-6 place-items-center rounded-full border-2 border-line bg-ice-2" />
                <p className="text-sm font-medium text-muted-foreground">Benefit disbursement</p>
              </div>
            </div>
          </div>

          {viewState === "tracking" && (
            <div className="bg-card rounded-xl border border-line p-5 shadow-sm animate-in fade-in zoom-in duration-500">
              <h3 className="font-semibold mb-2">What happens next?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Your application is currently under review by the department. No action is required
                from you at this time.
              </p>
              <div className="p-3 bg-ice-2 rounded-lg text-sm border border-line flex gap-2">
                <Clock className="size-4 text-brand shrink-0 mt-0.5" />
                <span>Expected update in 7-10 business days.</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Content Area */}
        <div className="lg:col-span-8 space-y-6">
          {viewState === "submitting" ? (
            <div className="bg-card rounded-xl border border-brand p-12 shadow-sm text-center flex flex-col items-center justify-center min-h-[500px]">
              <Bot className="size-12 text-brand animate-bounce mb-6" />
              <h2 className="text-2xl font-semibold mb-2">Simulating Submission</h2>
              <p className="text-muted-foreground mb-8">Securely transferring verified data...</p>

              <div className="w-full max-w-sm space-y-4 text-left">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-ice-2 border border-line animate-pulse">
                  <Bot className="size-5 text-brand" />
                  <span className="text-sm font-medium">
                    Application Agent: Preparing submission...
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-ice-2 border border-line animate-pulse delay-150">
                  <Landmark className="size-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Government Portal: Validating information...
                  </span>
                </div>
              </div>
            </div>
          ) : viewState === "tracking" ? (
            <div className="bg-card rounded-xl border border-sage p-10 shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="flex items-center justify-center mb-6">
                <div className="grid size-16 place-items-center rounded-full bg-sage/20 text-sage">
                  <CheckCircle2 className="size-8" />
                </div>
              </div>
              <h2 className="text-3xl font-display font-semibold text-center mb-2">
                Application submitted successfully 🎉
              </h2>
              <p className="text-center text-muted-foreground mb-8">
                Your information has been securely transmitted.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-ice-2 rounded-xl border border-line">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Application ID
                  </p>
                  <p className="font-mono font-medium text-lg">{id}</p>
                </div>
                <div className="p-4 bg-ice-2 rounded-xl border border-line">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Status
                  </p>
                  <p className="font-medium text-lg text-sage">Submitted & Under Review</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Prepared by Sahayak Header */}
              <div className="bg-brand text-primary-foreground rounded-xl p-6 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="size-5" />
                    <span className="font-semibold tracking-wide">Prepared by Sahayak</span>
                  </div>
                  <h1 className="text-2xl font-display font-semibold">
                    National Means-cum-Merit Scholarship
                  </h1>
                  <p className="text-primary-foreground/80 text-sm mt-1">Application ID: {id}</p>
                </div>
                <Button
                  variant="outline"
                  className="bg-transparent border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground"
                >
                  <Pencil className="size-4 mr-2" /> Edit Info
                </Button>
              </div>

              {/* Data Fields */}
              <div className="bg-card rounded-xl border border-line shadow-sm overflow-hidden">
                <div className="p-5 border-b border-line bg-ice-2/50">
                  <h3 className="font-semibold text-lg">Application Details</h3>
                </div>

                <div className="p-5 space-y-8">
                  {fields.map((section, idx) => (
                    <div key={idx}>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b border-line pb-2">
                        {section.section}
                      </h4>
                      <div className="grid sm:grid-cols-2 gap-y-4 gap-x-8">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.value}</span>
                              {item.status === "verified" && (
                                <CheckCircle2 className="size-4 text-sage" />
                              )}
                              {item.status === "needs_review" && (
                                <AlertTriangle className="size-4 text-amber" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 border-b border-line pb-2">
                      Attached Documents
                    </h4>
                    <div className="space-y-3">
                      {documents.map((doc, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg border border-line bg-ice-2"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="size-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{doc.name}</span>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full border border-sage/30 bg-sage/10 px-2 py-0.5 text-xs font-medium text-sage">
                            <CheckCircle2 className="size-3" /> Verified
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Card */}
              <div className="bg-card rounded-xl border-2 border-brand/50 shadow-md p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand" />

                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="size-6 text-brand" />
                  <h2 className="text-xl font-display font-semibold">Your approval is required</h2>
                </div>

                <p className="text-muted-foreground text-sm mb-6 max-w-2xl">
                  Sahayak has prepared this application using information you provided and documents
                  you approved.
                  <strong className="text-foreground font-medium ml-1">
                    Nothing will be submitted or shared without your permission.
                  </strong>
                </p>

                <div className="space-y-3 mb-8">
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-ice-2 transition-colors border border-transparent hover:border-line">
                    <button
                      onClick={() => setChecks((c) => ({ ...c, info: !c.info }))}
                      className="mt-0.5 shrink-0 text-brand"
                    >
                      {checks.info ? (
                        <CheckSquare className="size-5" />
                      ) : (
                        <Square className="size-5" />
                      )}
                    </button>
                    <span className="text-sm font-medium select-none">
                      I have reviewed my information and confirm it is accurate.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-ice-2 transition-colors border border-transparent hover:border-line">
                    <button
                      onClick={() => setChecks((c) => ({ ...c, docs: !c.docs }))}
                      className="mt-0.5 shrink-0 text-brand"
                    >
                      {checks.docs ? (
                        <CheckSquare className="size-5" />
                      ) : (
                        <Square className="size-5" />
                      )}
                    </button>
                    <span className="text-sm font-medium select-none">
                      I approve sharing these attached documents with the scholarship department.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-ice-2 transition-colors border border-transparent hover:border-line">
                    <button
                      onClick={() => setChecks((c) => ({ ...c, submit: !c.submit }))}
                      className="mt-0.5 shrink-0 text-brand"
                    >
                      {checks.submit ? (
                        <CheckSquare className="size-5" />
                      ) : (
                        <Square className="size-5" />
                      )}
                    </button>
                    <span className="text-sm font-medium select-none">
                      I approve this application for final submission.
                    </span>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-line">
                  <Button variant="outline" className="sm:w-auto w-full">
                    Review again
                  </Button>
                  <Button
                    className="sm:w-auto w-full sm:ml-auto"
                    disabled={!canSubmit}
                    onClick={handleApprove}
                  >
                    Approve & Continue
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
