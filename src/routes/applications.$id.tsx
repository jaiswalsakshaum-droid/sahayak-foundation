import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  AlertTriangle,
  FileWarning,
  Clock,
  ShieldCheck,
  CheckSquare,
  Square,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth, getCurrentProfile, type UserProfile } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { recordConsent, submitApplication, getApplicationStatus } from "@/lib/services";
import { AppShell } from "@/components/sahayak";

export const Route = createFileRoute("/applications/$id")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: ApplicationDetailPage,
});

export function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [timeline, setTimeline] = useState<
    { step: string; status: "completed" | "current" | "pending" }[]
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadApplication() {
      try {
        const userProfile = await getCurrentProfile();
        if (!isMounted) return;
        setProfile(userProfile);

        if (isSupabaseConfigured) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

          let appQuery = supabase.from("applications").select(
            `
              id,
              tracking_id,
              status,
              applicant_info,
              created_at,
              updated_at,
              scheme_id,
              schemes (
                id,
                name,
                benefit,
                category,
                document_requirements (
                  document_type,
                  is_mandatory
                )
              )
            `,
          );

          if (isUuid) {
            appQuery = appQuery.or(`id.eq.${id},tracking_id.eq.${id}`);
          } else {
            appQuery = appQuery.eq("tracking_id", id);
          }

          const { data: appData } = await appQuery.maybeSingle();

          if (appData && isMounted) {
            setApplication(appData);

            // Fetch citizen's verified documents to check for missing proofs
            if (userProfile?.id) {
              const { data: citizenDocs } = await supabase
                .from("documents")
                .select("document_type, status")
                .eq("citizen_id", userProfile.id);

              const verifiedTypes = new Set(
                (citizenDocs || [])
                  .filter((d) => d.status === "verified")
                  .map((d) => d.document_type.toLowerCase()),
              );

              const reqs = (appData.schemes as any)?.document_requirements || [];
              const missing = reqs
                .filter(
                  (r: any) => r.is_mandatory && !verifiedTypes.has(r.document_type.toLowerCase()),
                )
                .map((r: any) => r.document_type);

              setMissingRequirements(missing);
            }

            const statusInfo = await getApplicationStatus(appData.tracking_id || appData.id);
            setTimeline(statusInfo.timeline);
          }
        }
      } catch (err) {
        console.error("[Applications] Failed to load application details:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadApplication();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const isSubmitted =
    application?.status === "submitted" ||
    application?.status === "under_review" ||
    application?.status === "approved";

  const handleApproveAndSubmit = async () => {
    if (!application?.id || !profile?.id) return;
    setSubmitting(true);

    try {
      // 1. Record explicit citizen consent
      await recordConsent(
        application.id,
        "I authorize Sahayak AI to submit this application with verified credentials on my behalf.",
      );

      // 2. Submit application
      const submitRes = await submitApplication(application.id);

      if (submitRes.ok) {
        toast.success("Application submitted successfully!", {
          description: `Tracking ID: ${submitRes.data.trackingId}`,
        });

        setApplication((prev: any) => ({
          ...prev,
          status: "submitted",
          tracking_id: submitRes.data.trackingId,
        }));

        const statusInfo = await getApplicationStatus(submitRes.data.trackingId);
        setTimeline(statusInfo.timeline);
      } else {
        toast.error("Submission failed", {
          description: submitRes.error,
        });
      }
    } catch (err: any) {
      toast.error("Error submitting application", {
        description: err.message || "Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const schemeName = (application?.schemes as any)?.name || "National Means-cum-Merit Scholarship";
  const schemeBenefit = (application?.schemes as any)?.benefit || "₹12,000 / year";
  const trackingRef = application?.tracking_id || id;

  const applicantInfoData = application?.applicant_info || {
    "Full Name": { value: profile?.full_name || "Citizen Applicant", status: "verified" },
    Age: { value: profile?.age ? `${profile.age}` : "20", status: "verified" },
    Location: { value: profile?.location || "Lucknow, Uttar Pradesh", status: "verified" },
    "Annual Income": {
      value: profile?.annual_income
        ? `₹${Number(profile.annual_income).toLocaleString()}`
        : "₹2,10,000",
      status: "verified",
    },
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to="/applications"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-ice hover:text-foreground transition-colors shadow-sm"
            >
              <ChevronLeft className="size-3.5" /> Back to Applications
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-ice hover:text-foreground transition-colors shadow-sm"
            >
              <ArrowLeft className="size-3.5" /> Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-brand-soft">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-sage" />
            Human-in-the-Loop Sign-off
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: Summary & Progress Timeline */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card rounded-xl border border-line p-5 shadow-none space-y-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-soft">
                  {t("applications.scheme", "Scheme")}
                </p>
                <h2 className="font-semibold text-base mt-1">{schemeName}</h2>
                <p className="text-sm font-medium text-brand mt-0.5">{schemeBenefit}</p>
              </div>

              <div className="pt-3 border-t border-line space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tracking ID</span>
                  <span className="font-mono font-medium">{trackingRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("applications.currentStage", "Current Stage")}
                  </span>
                  <span className="font-medium capitalize text-brand">
                    {application?.status?.replace(/_/g, " ") || "Awaiting Approval"}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Timeline */}
            <div className="bg-card rounded-xl border border-line p-5 shadow-none">
              <h3 className="text-sm font-semibold mb-4 font-display">
                {t("dashboard.progressTimeline", "Progress timeline")}
              </h3>
              <div className="relative pl-6 border-l border-line space-y-6 py-2 ml-2">
                {timeline.map((item, index) => {
                  const isComplete = item.status === "completed";
                  const isCurrent = item.status === "current";
                  return (
                    <div key={index} className="relative">
                      <span
                        className={`absolute -left-[31px] grid size-4 place-items-center rounded-full border-2 ${
                          isComplete
                            ? "bg-sage border-sage text-primary-foreground"
                            : isCurrent
                              ? "bg-brand border-brand text-primary-foreground animate-pulse"
                              : "bg-card border-line"
                        }`}
                      />
                      <p
                        className={`text-xs ${
                          isCurrent
                            ? "font-semibold text-brand"
                            : isComplete
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                        }`}
                      >
                        {item.step}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Application Review & Submission */}
          <div className="lg:col-span-8 space-y-6">
            {/* Header Banner */}
            <div className="bg-brand text-primary-foreground rounded-xl p-6 shadow-none flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <div className="flex items-center gap-2 mb-1.5 text-xs text-primary-foreground/80">
                  <Bot className="size-4" />
                  <span>Prepared by Sahayak Workforce</span>
                </div>
                <h1 className="text-2xl font-display font-semibold">{schemeName}</h1>
                <p className="text-primary-foreground/80 text-xs mt-1">
                  {t("applications.trackingId", { id: trackingRef })}
                </p>
              </div>
            </div>

            {/* Missing Documents Warning Banner */}
            {missingRequirements.length > 0 && !isSubmitted && (
              <div className="rounded-xl border border-amber/30 bg-amber/10 p-4 flex items-start gap-3">
                <FileWarning className="size-5 text-amber shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-semibold text-amber uppercase tracking-wider">
                    Missing Mandatory Proofs
                  </h4>
                  <p className="text-xs text-foreground mt-0.5">
                    {t(
                      "applications.missingDocsWarning",
                      "Cannot submit yet: Please upload and verify all mandatory documents first.",
                    )}{" "}
                    ({missingRequirements.join(", ")})
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2.5 text-xs h-7 gap-1 border-amber/40 bg-card text-foreground hover:bg-amber/10"
                    onClick={() =>
                      navigate({
                        to: "/documents",
                        search: {
                          scheme: application?.scheme_id,
                          required: missingRequirements[0],
                        },
                      })
                    }
                  >
                    Upload {missingRequirements[0]} <ArrowRight className="size-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Extracted Applicant Information */}
            <div className="bg-card rounded-xl border border-line shadow-none overflow-hidden">
              <div className="p-4 border-b border-line bg-ice-2/40">
                <h3 className="font-semibold text-sm">
                  {t("applications.applicantData", "Applicant Information (AI Extracted)")}
                </h3>
              </div>

              <div className="p-5 grid sm:grid-cols-2 gap-4">
                {Object.entries(applicantInfoData).map(([key, item]: [string, any]) => (
                  <div key={key} className="p-3 rounded-lg border border-line bg-ice-2/30">
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wider block mb-1">
                      {key}
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {typeof item === "object" && item !== null
                          ? item.value !== undefined && item.value !== null && item.value !== ""
                            ? String(item.value)
                            : "—"
                          : String(item ?? "—")}
                      </span>
                      {typeof item === "object" && item?.status === "verified" && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-sage font-medium">
                          <CheckCircle2 className="size-3.5" /> Verified
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Citizen Authorization & Consent Submission Box */}
            {isSubmitted ? (
              <div className="bg-card rounded-xl border border-sage/40 p-6 text-center space-y-3">
                <div className="grid size-12 place-items-center rounded-full bg-sage/20 text-sage mx-auto">
                  <CheckCircle2 className="size-6" />
                </div>
                <h3 className="text-xl font-display font-semibold">
                  {t("applications.submissionSuccess", "Application submitted successfully!")}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Your application has been forwarded to the department. Tracker Agent is monitoring
                  verification milestones.
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border-2 border-brand/40 p-6 space-y-5">
                <div className="flex items-center gap-2 text-brand">
                  <ShieldCheck className="size-5" />
                  <h3 className="font-display font-semibold text-base text-foreground">
                    {t("applications.consentTitle", "Citizen Authorization & Consent")}
                  </h3>
                </div>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg bg-ice-2/60 border border-line hover:bg-ice transition-colors">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="mt-1 size-4 rounded border-line text-brand focus:ring-brand"
                  />
                  <span className="text-xs leading-relaxed text-foreground select-none">
                    {t(
                      "applications.consentCheckbox",
                      "I have reviewed the information above and hereby authorize Sahayak to submit this application to the designated department on my behalf.",
                    )}
                  </span>
                </label>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    className="w-full sm:w-auto ml-auto"
                    disabled={!consentChecked || missingRequirements.length > 0 || submitting}
                    onClick={handleApproveAndSubmit}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        {t("applications.submitting", "Submitting...")}
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 size-4" />
                        {t("applications.approveAndSubmit", "Approve & Submit Application")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Ecosystem Connection Footer */}
        <div className="rounded-xl border border-line bg-card p-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2 mt-8">
          <span className="font-medium text-foreground">
            {t(
              "dashboard.connectedEcosystem",
              "Your connected ecosystem: Sahayak works alongside myScheme, UMANG and DigiLocker — it never replaces them.",
            )}
          </span>
          <Button asChild variant="link" size="sm" className="px-1 text-xs text-brand">
            <Link to="/profile">
              {t("dashboard.manageConnections", "Manage connections")}{" "}
              <ChevronRight className="size-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
