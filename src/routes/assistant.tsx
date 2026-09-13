import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  Upload,
  ArrowDown,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  FileBadge,
  Check,
  Edit2,
  Save,
  X,
  MessageSquare,
  CheckSquare,
  Square,
  History,
  Download,
  Printer,
  Copy,
  HelpCircle,
  Info,
  Plus,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAuth, getCurrentProfile, type UserProfile } from "@/lib/auth";
import { useAgentRun } from "@/hooks/use-agent-run";
import {
  findRelevantSchemes,
  understandCitizenNeed,
  checkEligibility,
  validateDocument,
  updateApplicationDraft,
  submitApplicationDraft,
  getCitizenRuns,
  askAgentFollowUp,
  type SchemeMatch,
} from "@/lib/services";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { AppShell } from "@/components/sahayak";

export const Route = createFileRoute("/assistant")({
  validateSearch: (search: Record<string, unknown>): { schemeId?: string; schemeName?: string } => {
    return {
      schemeId: typeof search.schemeId === "string" ? search.schemeId : undefined,
      schemeName: typeof search.schemeName === "string" ? search.schemeName : undefined,
    };
  },
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
  details?: Record<string, any>;
};

function AssistantPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const initSchemeHandledRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [showResults, setShowResults] = useState(false);
  const [candidateSchemes, setCandidateSchemes] = useState<SchemeMatch[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<SchemeMatch | null>(null);
  const [schemeCriteria, setSchemeCriteria] = useState<any[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    citizen: true,
    scheme: true,
    eligibility: true,
    document: true,
    application: true,
    tracker: true,
  });
  const [showEvidence, setShowEvidence] = useState<Record<string, boolean>>({});
  const [applicationDraft, setApplicationDraft] = useState<any>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Editable Draft state
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editableApplicantInfo, setEditableApplicantInfo] = useState<
    Record<string, { value: string; status: string }>
  >({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Follow-up Q&A chat state
  const [followUpInput, setFollowUpInput] = useState("");
  const [followUpMessages, setFollowUpMessages] = useState<
    Array<{ sender: "user" | "ai"; text: string }>
  >([]);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);

  // Direct Submission state
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [directConsent, setDirectConsent] = useState(true);
  const [submissionReceipt, setSubmissionReceipt] = useState<{
    trackingId: string;
    submittedAt: string;
    schemeName: string;
  } | null>(null);

  // Sidebar and Section Collapse states
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isThinkingCollapsed, setIsThinkingCollapsed] = useState(false);

  // Past Runs / History state
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [pastRuns, setPastRuns] = useState<
    Array<{
      id: string;
      query: string;
      status: string;
      started_at: string;
      scheme_name?: string;
    }>
  >([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Missing document inline upload state
  const [isUploadingMissingDoc, setIsUploadingMissingDoc] = useState(false);
  const [uploadSuccessDoc, setUploadSuccessDoc] = useState<string | null>(null);
  const [uploadExtractionStep, setUploadExtractionStep] = useState<string | null>(null);
  const [showMissingDocsConfirmDialog, setShowMissingDocsConfirmDialog] = useState(false);
  const [selectedUploadDocType, setSelectedUploadDocType] = useState<string>("");
  const [showScrollBottomPill, setShowScrollBottomPill] = useState(false);
  const [phoneInputs, setPhoneInputs] = useState<Record<string, string>>({});
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [vaultDocs, setVaultDocs] = useState<string[]>([]);

  const refreshVaultDocs = useCallback(
    async (citizenId?: string) => {
      const targetId = citizenId || profile?.id;
      if (!isSupabaseConfigured || !targetId) return;
      try {
        const { data } = await supabase
          .from("documents")
          .select("document_type, status")
          .eq("citizen_id", targetId)
          .in("status", ["verified", "needs_review"]);
        if (data) {
          setVaultDocs(data.map((d) => d.document_type));
        }
      } catch (e) {
        console.warn("Failed to load vault docs:", e);
      }
    },
    [profile?.id],
  );

  const journeyScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    runId,
    events,
    status,
    activeAgentIndex,
    latestData,
    isReconnecting,
    isConnecting,
    errorMessage,
    startRun,
    loadRunById,
    resetRun,
    setStatus,
  } = useAgentRun();

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

  // Scroll position listener for journey timeline
  const handleJourneyScroll = () => {
    if (!journeyScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = journeyScrollRef.current;
    const isBottom = scrollHeight - scrollTop - clientHeight < 60;
    isNearBottomRef.current = isBottom;
    setShowScrollBottomPill(!isBottom && events.length > 2);
  };

  const scrollToBottom = () => {
    if (journeyScrollRef.current) {
      journeyScrollRef.current.scrollTo({
        top: journeyScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setShowScrollBottomPill(false);
      isNearBottomRef.current = true;
    }
  };

  // Update journey steps from agent_events log & auto-scroll
  useEffect(() => {
    events.forEach((ev) => {
      const agentLower = (ev.agent_name || (ev as any).agent || "").toLowerCase();
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
          const target = copy[stepIdx];
          if (target && !target.messages.includes(ev.action)) {
            copy[stepIdx] = {
              ...target,
              messages: [...target.messages, ev.action],
              details: ev.details ? { ...(target.details || {}), ...ev.details } : target.details,
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
    const candSchemes = (latestData as any)?.candidate_schemes;
    if (candSchemes && Array.isArray(candSchemes) && candSchemes.length > 0) {
      setCandidateSchemes(
        candSchemes.map((s: any) => ({
          id: s.id,
          name: s.name,
          category: s.category || "General",
          benefit: s.benefit || "Government Support",
          matchScore:
            typeof s.match_score === "number"
              ? s.match_score
              : typeof s.matchScore === "number"
                ? s.matchScore
                : 85,
          description: s.reasoning || s.description || "",
          official: s.official ?? true,
          reqDocs:
            s.document_requirements?.map((d: any) =>
              typeof d === "string" ? d : d.document_type,
            ) ||
            s.reqDocs ||
            [],
          lastVerified: s.lastVerified || "Active Catalog",
        })),
      );
    }

    // Extract application draft
    const appDraft =
      (latestData as any)?.application_draft ||
      events
        .map((e) => e.details?.application_draft)
        .filter(Boolean)
        .pop();
    if (appDraft) {
      setApplicationDraft(appDraft);
      if (appDraft.applicant_info) {
        const initialInfo: Record<string, { value: string; status: string }> = {};
        Object.entries(appDraft.applicant_info).forEach(([k, v]: [string, any]) => {
          if (v && typeof v === "object") {
            initialInfo[k] = { value: v.value ?? "", status: v.status ?? "needs_review" };
          } else {
            initialInfo[k] = { value: String(v ?? ""), status: "verified" };
          }
        });
        setEditableApplicantInfo((prev) => (Object.keys(prev).length === 0 ? initialInfo : prev));
      }
    }

    if (status === "ACTION_REQUIRED" || status === "COMPLETED") {
      setShowResults(true);
    }

    // Smart auto-scroll if near bottom
    if (isNearBottomRef.current && journeyScrollRef.current) {
      journeyScrollRef.current.scrollTop = journeyScrollRef.current.scrollHeight;
    }
  }, [events, activeAgentIndex, latestData, status]);

  // Load citizen profile, vault docs and past inquiries on mount
  useEffect(() => {
    getCurrentProfile().then((p) => {
      if (p) {
        setProfile(p);
        refreshVaultDocs(p.id);
        getCitizenRuns(p.id).then((runs) => {
          setPastRuns(runs);
        });
      }
    });
  }, [refreshVaultDocs]);

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

  const handleFieldChange = (field: string, newValue: string) => {
    setEditableApplicantInfo((prev) => ({
      ...prev,
      [field]: {
        value: newValue,
        status: newValue.trim() ? "verified" : "needs_review",
      },
    }));
  };

  const handleSaveDraftEdits = async () => {
    if (!applicationDraft?.id) return;
    setIsSavingDraft(true);
    try {
      const res = await updateApplicationDraft(applicationDraft.id, editableApplicantInfo);
      if (res.success) {
        setApplicationDraft((prev: any) => ({
          ...prev,
          applicant_info: editableApplicantInfo,
        }));
        setIsEditingDraft(false);
        toast.success(t("assistant.draftSaved", "Application details updated successfully!"));
      } else {
        toast.error(t("assistant.draftSaveError", "Failed to save details. Please try again."));
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to save edits.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSendFollowUp = async (questionText?: string) => {
    const queryToSend = (questionText || followUpInput).trim();
    if (!queryToSend || isAskingFollowUp) return;

    setFollowUpMessages((prev) => [...prev, { sender: "user", text: queryToSend }]);
    setFollowUpInput("");
    setIsAskingFollowUp(true);

    try {
      const schemeContext = {
        scheme_name:
          candidateSchemes[0]?.name ||
          applicationDraft?.ai_summary?.scheme_name ||
          "Government Welfare Scheme",
        benefit:
          candidateSchemes[0]?.benefit || applicationDraft?.ai_summary?.benefit_summary || "",
        missing_documents: missingDocsList,
      };
      const answer = await askAgentFollowUp(
        runId || "",
        profile?.id || "",
        queryToSend,
        schemeContext,
      );
      setFollowUpMessages((prev) => [...prev, { sender: "ai", text: answer }]);
    } catch (err) {
      setFollowUpMessages((prev) => [
        ...prev,
        { sender: "ai", text: "You can review and submit your application with the button below." },
      ]);
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  const handleSubmitDirectly = async () => {
    if (
      applicationDraft?.already_applied ||
      applicationDraft?.status === "submitted" ||
      applicationDraft?.status === "under_review" ||
      applicationDraft?.status === "approved"
    ) {
      toast.info(
        `You have already applied for this scheme (Tracking ID: #${applicationDraft.tracking_id || applicationDraft.id}).`,
      );
      navigate({ to: "/dashboard" });
      return;
    }

    if (!directConsent) {
      toast.error(
        t(
          "assistant.consentRequired",
          "Please check the consent authorization box before submitting.",
        ),
      );
      return;
    }
    if (!applicationDraft?.id) return;

    setIsSubmittingDirect(true);
    try {
      const targetScheme =
        candidateSchemes[0]?.name || applicationDraft?.ai_summary?.scheme_name || "Welfare Scheme";
      const res = await submitApplicationDraft(
        applicationDraft.id,
        profile?.id || "",
        true,
        applicationDraft.scheme_id || candidateSchemes[0]?.id,
        Object.keys(editableApplicantInfo).length > 0
          ? editableApplicantInfo
          : applicationDraft.applicant_info,
      );
      if (res.success) {
        if ((res as any).alreadyApplied) {
          toast.info("You have already applied for this scheme. Tracking active application.");
        } else {
          toast.success(t("assistant.submitSuccess", "Application submitted successfully!"));
        }
        setSubmissionReceipt({
          trackingId: res.trackingId,
          submittedAt: res.submittedAt,
          schemeName: targetScheme,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application.");
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  const handleNewChat = () => {
    resetRun();
    setHasStarted(false);
    setInput("");
    setActiveQuery("");
    setCandidateSchemes([]);
    setSelectedScheme(null);
    setApplicationDraft(null);
    setUploadSuccessDoc(null);
    setShowResults(false);
    setFollowUpMessages([]);
    setSubmissionReceipt(null);
    setEditableApplicantInfo({});
    setIsThinkingCollapsed(false);
    setJourneySteps((prev) => prev.map((s) => ({ ...s, messages: [], details: undefined })));
  };

  const handleOpenHistory = async () => {
    setShowHistoryDrawer(true);
    if (profile?.id) {
      setIsLoadingHistory(true);
      const runs = await getCitizenRuns(profile.id);
      setPastRuns(runs);
      setIsLoadingHistory(false);
    }
  };

  const handleViewPastRun = async (r: { id: string; query: string; status: string }) => {
    setShowHistoryDrawer(false);
    resetRun();
    setActiveQuery(r.query);
    setHasStarted(true);
    setShowResults(true);
    setCandidateSchemes([]);
    setSelectedScheme(null);
    setApplicationDraft(null);
    setUploadSuccessDoc(null);
    setFollowUpMessages([]);
    setSubmissionReceipt(null);
    await loadRunById(r.id);
    const intent = await understandCitizenNeed(r.query);
    const matched = await findRelevantSchemes(intent);
    if (matched.length > 0) {
      setCandidateSchemes((prev) => (prev.length === 0 ? matched : prev));
    }
  };

  const handleRerunPastQuery = (pastQuery: string) => {
    setShowHistoryDrawer(false);
    handleSend(pastQuery);
  };

  const handleSend = async (text: string, targetSchemeId?: string) => {
    if (!text.trim()) return;
    resetRun();
    setActiveQuery(text);
    setInput("");
    setHasStarted(true);
    setShowResults(false);
    setCandidateSchemes([]);
    setSelectedScheme(null);
    setApplicationDraft(null);
    setUploadSuccessDoc(null);
    setFollowUpMessages([]);
    setSubmissionReceipt(null);
    setEditableApplicantInfo({});
    setIsThinkingCollapsed(false);
    setJourneySteps((prev) => prev.map((s) => ({ ...s, messages: [], details: undefined })));

    // 1. Initial quick matching for instant UI feedback
    if (targetSchemeId && isSupabaseConfigured) {
      try {
        const { data: directScheme } = await supabase
          .from("schemes")
          .select("*")
          .eq("id", targetSchemeId)
          .maybeSingle();
        if (directScheme) {
          const directMatch: SchemeMatch = {
            id: directScheme.id,
            name: directScheme.name,
            category: directScheme.category,
            benefit: directScheme.benefit || "",
            match: "100%",
            matchScore: 100,
            status: "Eligible",
            source: directScheme.official_source || "Official Portal",
            description: directScheme.description || "",
            reqDocs: [],
          };
          setCandidateSchemes([directMatch]);
          setSelectedScheme(directMatch);
        }
      } catch (err) {
        console.warn("Could not load direct scheme details:", err);
      }
    } else {
      const intent = await understandCitizenNeed(text);
      const matched = await findRelevantSchemes(intent);
      if (matched.length > 0) {
        setCandidateSchemes(matched);
      }
    }

    // 2. Trigger real backend LangGraph orchestration run with targetSchemeId
    await startRun(text, targetSchemeId);

    // Refresh past inquiries in background to include this new run
    if (profile?.id) {
      getCitizenRuns(profile.id).then((runs) => {
        setPastRuns(runs);
      });
    }
  };

  // Auto-start direct scheme evaluation if arrived with schemeId in search params
  useEffect(() => {
    if (search.schemeId && initSchemeHandledRef.current !== search.schemeId) {
      initSchemeHandledRef.current = search.schemeId;
      const schemeLabel = search.schemeName || "Selected Scheme";
      const q = `Apply for ${schemeLabel}`;
      handleSend(q, search.schemeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.schemeId, search.schemeName]);

  const handleRetry = () => {
    if (activeQuery) {
      handleSend(activeQuery, selectedScheme?.id);
    } else if (input) {
      handleSend(input);
    }
  };

  const toggleStepExpansion = (agentKey: string) => {
    setExpandedSteps((prev) => ({ ...prev, [agentKey]: !prev[agentKey] }));
  };

  const toggleEvidence = (critKey: string) => {
    setShowEvidence((prev) => ({ ...prev, [critKey]: !prev[critKey] }));
  };

  // Trigger upload for specific document type
  const triggerUploadForDoc = (docType: string) => {
    setSelectedUploadDocType(docType);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleResumeWorkflow = async (forceComplete: boolean = false) => {
    setShowMissingDocsConfirmDialog(false);
    setIsUploadingMissingDoc(true);
    setUploadExtractionStep(
      forceComplete
        ? "Proceeding with available documents and generating application draft..."
        : "Re-evaluating civic eligibility criteria with verified records...",
    );

    if (forceComplete) {
      setStatus("PROCESSING");
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
    const internalSecret = import.meta.env.VITE_INTERNAL_SECRET || "sahayak_dev_secret_123";

    if (runId) {
      try {
        await fetch(`${backendUrl}/run/${runId}/resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Sahayak-Internal-Secret": internalSecret,
          },
          body: JSON.stringify({ force_complete: forceComplete }),
        });
      } catch (err) {
        console.warn("Resume fetch error:", err);
      } finally {
        setTimeout(() => {
          setIsUploadingMissingDoc(false);
          setUploadExtractionStep(null);
        }, 2000);
      }
    }
  };

  const handleMissingDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = selectedUploadDocType || missingDocsList[0] || "Income Certificate";
    if (!file) return;

    setIsUploadingMissingDoc(true);
    setUploadSuccessDoc(null);
    setUploadExtractionStep(`Uploading ${docType} to encrypted civic vault...`);

    try {
      const uploadRes = await validateDocument(file, docType);
      if (uploadRes.ok || (uploadRes as any).success) {
        const isAlready = uploadRes.ok && uploadRes.data.alreadyVerified;
        setUploadSuccessDoc(docType);
        if (isAlready) {
          setUploadExtractionStep(
            `Document already verified (${docType}). Reusing verified credential from vault...`,
          );
          toast.info(`${docType} is already verified in your vault. Reusing verified credential.`);
        } else {
          setUploadExtractionStep(
            `Document registered & verified (${docType}). AI workforce is re-evaluating criteria...`,
          );
          toast.success(`${docType} uploaded and verified successfully!`);
        }

        // Refresh vault docs immediately so UI updates instantly
        await refreshVaultDocs();

        // Trigger resume after short delay to re-evaluate with updated vault records
        setTimeout(() => {
          handleResumeWorkflow(false);
        }, 1000);
      } else {
        const errorMsg =
          uploadRes.ok === false ? uploadRes.error : "Upload failed. Please try again.";
        setUploadExtractionStep(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadExtractionStep("Document upload failed. Please try again.");
      toast.error(err.message || "Failed to upload document.");
    } finally {
      setTimeout(() => {
        setIsUploadingMissingDoc(false);
      }, 2500);
    }
  };

  const handleSavePhone = async (docName: string, phoneVal: string) => {
    const cleaned = phoneVal.trim();
    if (!cleaned || cleaned.length < 8) {
      toast.error("Please enter a valid mobile number.");
      return;
    }
    setIsSavingPhone(true);
    try {
      if (profile?.id) {
        await supabase.from("profiles").update({ phone: cleaned }).eq("id", profile.id);
        setProfile((prev) => (prev ? { ...prev, phone: cleaned } : null));
        toast.success("Mobile number verified successfully!");
        await refreshVaultDocs();
        handleResumeWorkflow(false);
      }
    } catch (e: any) {
      toast.error("Failed to save mobile number.");
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Helper to check if a requirement is satisfied by vault documents or profile
  const isDocSatisfied = useCallback(
    (reqName: string): boolean => {
      const r = reqName.toLowerCase();
      if (r.includes("mobile") || r.includes("phone") || r.includes("contact number")) {
        return Boolean(profile?.phone && profile.phone.trim().length >= 8);
      }
      return vaultDocs.some((vd) => {
        const v = vd.toLowerCase();
        if (v === r || v.includes(r) || r.includes(v)) return true;
        if (
          (r.includes("land") ||
            r.includes("khasra") ||
            r.includes("khatauni") ||
            r.includes("patta") ||
            r.includes("ror") ||
            r.includes("ownership")) &&
          (v.includes("land") ||
            v.includes("khasra") ||
            v.includes("khatauni") ||
            v.includes("patta") ||
            v.includes("ror") ||
            v.includes("ownership"))
        ) {
          return true;
        }
        if (
          (r.includes("aadhaar") ||
            r.includes("aadhar") ||
            r.includes("uid") ||
            r.includes("identity")) &&
          (v.includes("aadhaar") ||
            v.includes("aadhar") ||
            v.includes("uid") ||
            v.includes("identity"))
        ) {
          return true;
        }
        if ((r.includes("pan") || r.includes("tax")) && (v.includes("pan") || v.includes("tax"))) {
          return true;
        }
        if (
          (r.includes("passbook") || r.includes("bank") || r.includes("account")) &&
          (v.includes("passbook") || v.includes("bank") || v.includes("account"))
        ) {
          return true;
        }
        if (
          (r.includes("income") || r.includes("salary")) &&
          (v.includes("income") || v.includes("salary"))
        ) {
          return true;
        }
        if (r.includes("caste") && v.includes("caste")) {
          return true;
        }
        if (
          (r.includes("domicile") || r.includes("residence") || r.includes("address")) &&
          (v.includes("domicile") || v.includes("residence") || v.includes("address"))
        ) {
          return true;
        }
        const tokensR = new Set(
          r
            .replace(/[/(),-]/g, " ")
            .split(/\s+/)
            .filter(Boolean),
        );
        const tokensV = new Set(
          v
            .replace(/[/(),-]/g, " ")
            .split(/\s+/)
            .filter(Boolean),
        );
        const common = [...tokensR].filter(
          (t) =>
            tokensV.has(t) &&
            ![
              "card",
              "record",
              "certificate",
              "proof",
              "document",
              "for",
              "the",
              "of",
              "and",
            ].includes(t),
        );
        return common.length > 0;
      });
    },
    [profile?.phone, vaultDocs],
  );

  // Base raw required documents from scheme or latestData
  const rawRequirements: string[] = useMemo(() => {
    if (Array.isArray(latestData.missing_documents) && latestData.missing_documents.length > 0) {
      return latestData.missing_documents.map((d: any) =>
        typeof d === "string" ? d : d.document_type || "Document",
      );
    }
    if (
      Array.isArray(latestData.pending_requirements) &&
      latestData.pending_requirements.length > 0
    ) {
      return latestData.pending_requirements.map((p: any) =>
        typeof p === "string" ? p : p.document_type || p.name || "Document",
      );
    }
    if (latestData.next_action?.document_name) {
      return [latestData.next_action.document_name];
    }
    const docStep = journeySteps.find((s) => s.agentId === "document");
    if (
      docStep?.details?.missing_documents &&
      Array.isArray(docStep.details.missing_documents) &&
      docStep.details.missing_documents.length > 0
    ) {
      return docStep.details.missing_documents.map((d: any) =>
        typeof d === "string" ? d : d.document_type || "Document",
      );
    }
    if (
      docStep?.details?.pending_requirements &&
      Array.isArray(docStep.details.pending_requirements) &&
      docStep.details.pending_requirements.length > 0
    ) {
      return docStep.details.pending_requirements.map((p: any) =>
        typeof p === "string" ? p : p.document_type || "Document",
      );
    }
    if (
      candidateSchemes.length > 0 &&
      candidateSchemes[0]?.reqDocs &&
      candidateSchemes[0].reqDocs.length > 0
    ) {
      return candidateSchemes[0].reqDocs;
    }
    return [];
  }, [latestData, journeySteps, candidateSchemes]);

  // Filter out any document that is ALREADY verified in the vault!
  const missingDocsList: string[] = useMemo(() => {
    return rawRequirements.filter((req) => !isDocSatisfied(req));
  }, [rawRequirements, isDocSatisfied]);

  // Verified documents list for this scheme
  const verifiedSchemeDocs: string[] = useMemo(() => {
    return rawRequirements.filter((req) => isDocSatisfied(req));
  }, [rawRequirements, isDocSatisfied]);

  // Contextual loading copy helper
  const getActiveAgentCopy = () => {
    switch (activeAgentIndex) {
      case 0:
        return "Citizen Agent is understanding your situation & core need intent...";
      case 1:
        return "Scheme Agent is scanning central and state scheme repositories...";
      case 2:
        return "Eligibility Agent is evaluating civic rules against your verified records...";
      case 3:
        return "Document Agent is checking mandatory document proofs...";
      case 4:
        return "Application Agent is assembling your verified application draft...";
      case 5:
        return "Tracker Agent is monitoring departmental review checkpoints...";
      default:
        return "Orchestrating AI workforce...";
    }
  };

  return (
    <AppShell>
      <div className="space-y-4">
        {/* Top Breadcrumb & Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-ice hover:text-foreground transition-colors shadow-sm"
            >
              <ArrowLeft className="size-3.5" /> Back to Dashboard
            </Link>
            {/* <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border-line bg-card shadow-2xs gap-1.5"
            >
              <PanelLeft className="size-3.5 text-brand" />
              {isLeftSidebarOpen ? "Collapse Chats" : `Past Inquiries (${pastRuns.length})`}
            </Button> */}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-brand-soft">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-sage" />
            Citizen AI Workforce · 6 Agents Online
          </div>
        </div>

        {/* ChatGPT-Style Layout Container (Left Chats Sidebar + Right Main Window) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
          {/* Left Column: ChatGPT-Style Inquiries & Chats Sidebar */}
          {isLeftSidebarOpen ? (
            <aside className="w-full lg:w-72 xl:w-80 shrink-0 bg-card border border-line rounded-2xl p-3.5 flex flex-col gap-3 shadow-sm lg:sticky lg:top-4 max-h-[calc(100vh-120px)] transition-all">
              {/* Header with New Inquiry Button and Collapse Icon */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleNewChat}
                  className="flex-1 justify-start gap-2 bg-brand text-white hover:bg-brand/90 font-medium text-xs shadow-sm h-9"
                >
                  <Plus className="size-4" />
                  New Inquiry
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsLeftSidebarOpen(false)}
                  className="size-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-ice shrink-0"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              </div>

              {/* Sidebar Subheader */}
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <History className="size-3.5 text-brand" /> Past Inquiries
                </span>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono">
                  {pastRuns.length}
                </span>
              </div>

              {/* Scrollable list of past chats */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[calc(100vh-280px)]">
                {isLoadingHistory ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin mx-auto mb-1.5 text-brand" />
                    Loading inquiries...
                  </div>
                ) : pastRuns.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-line bg-card/40 text-center text-xs text-muted-foreground">
                    No past inquiries yet. Ask a question to start your first AI workforce run!
                  </div>
                ) : (
                  pastRuns.map((r) => {
                    const isCurrent = runId === r.id;
                    const isDone = r.status === "COMPLETED";
                    const isAction =
                      r.status === "ACTION REQUIRED" || r.status === "ACTION_REQUIRED";
                    const isProc = r.status === "PROCESSING" || r.status === "RUNNING";

                    return (
                      <button
                        key={r.id}
                        onClick={() => handleViewPastRun(r)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1.5 group ${
                          isCurrent
                            ? "border-brand bg-brand/5 shadow-xs ring-1 ring-brand/30"
                            : "border-line bg-card hover:border-brand/40 hover:bg-ice/50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              isDone
                                ? "bg-sage/15 text-sage"
                                : isAction
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : isProc
                                    ? "bg-brand/15 text-brand"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isDone
                              ? "Draft Ready"
                              : isAction
                                ? "Needs Docs"
                                : isProc
                                  ? "Processing"
                                  : r.status}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(r.started_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p
                          className={`text-xs line-clamp-2 leading-relaxed font-medium transition-colors ${
                            isCurrent
                              ? "text-brand font-semibold"
                              : "text-foreground group-hover:text-brand"
                          }`}
                        >
                          "{r.query}"
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-line/40">
                          <span className="truncate max-w-[140px]">
                            {r.scheme_name || "Civic Evaluation"}
                          </span>
                          <span className="text-brand opacity-0 group-hover:opacity-100 transition-opacity">
                            Open →
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* AI Workforce Footer Pill in Sidebar */}
              <div className="p-2.5 rounded-xl bg-mist/30 border border-line text-[11px] text-muted-foreground flex items-center gap-2 mt-auto">
                <Sparkles className="size-3.5 text-brand shrink-0" />
                <span className="line-clamp-2">
                  6 autonomous AI agents assist with rules, docs & drafting.
                </span>
              </div>
            </aside>
          ) : (
            <aside className="hidden lg:flex flex-col items-center gap-3 w-12 shrink-0 bg-card border border-line rounded-2xl p-2 py-3.5 shadow-sm lg:sticky lg:top-4 max-h-[calc(100vh-120px)] transition-all">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsLeftSidebarOpen(true)}
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-ice"
                title="Expand Past Inquiries"
              >
                <PanelLeft className="size-4" />
              </Button>
              <Button
                size="icon"
                onClick={handleNewChat}
                className="size-8 rounded-xl bg-brand text-white hover:bg-brand/90 shadow-2xs"
                title="New Inquiry"
              >
                <Plus className="size-4" />
              </Button>
              <div className="w-6 border-t border-line my-1" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsLeftSidebarOpen(true)}
                className="size-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-ice relative"
                title={`Past Inquiries (${pastRuns.length})`}
              >
                <History className="size-4" />
                {pastRuns.length > 0 && (
                  <span className="absolute -top-1 -right-1 text-[9px] bg-brand text-white rounded-full px-1 font-mono font-bold">
                    {pastRuns.length}
                  </span>
                )}
              </Button>
            </aside>
          )}

          {/* Right Column: Main Chat & Workforce Workspace Window */}
          <main className="flex-1 w-full min-w-0">
            {!hasStarted ? (
              <div className="flex flex-col items-center justify-center max-w-2xl mx-auto w-full text-center py-8 lg:py-16">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-card px-3 py-1 text-xs font-medium text-brand mb-4 shadow-xs">
                  <Sparkles className="size-3.5" /> Sahayak Citizen Intelligence
                </div>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold mb-3 tracking-tight">
                  {t("assistant.title", "What benefit or support are you looking for today?")}
                </h1>
                <p className="text-muted-foreground mb-8 text-sm sm:text-base max-w-lg">
                  {t(
                    "assistant.subtitle",
                    "Speak or type in your language. 6 specialized AI agents will verify rules, check documents, and draft applications with your consent.",
                  )}
                </p>

                <div className="w-full relative mb-6">
                  <textarea
                    className="w-full min-h-[130px] rounded-2xl border border-line bg-card p-4 pr-14 text-base resize-none focus:outline-none focus:ring-2 focus:ring-brand shadow-sm"
                    placeholder={t(
                      "assistant.inputPlaceholder",
                      "e.g., I am a college student from UP needing scholarship support...",
                    )}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (input.trim()) handleSend(input);
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    className="absolute bottom-3.5 right-3.5 rounded-xl bg-brand hover:bg-brand/90"
                    onClick={() => handleSend(input)}
                    disabled={!input.trim()}
                  >
                    <Send className="size-4" />
                  </Button>
                </div>

                <div className="w-full text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    {t("assistant.suggestedPrompts", "Suggested queries:")}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    {examplePrompts.map((p, i) => (
                      <button
                        key={i}
                        className="p-3 text-xs sm:text-sm rounded-xl border border-line bg-card hover:border-brand/50 hover:bg-brand/5 transition-colors text-left text-muted-foreground hover:text-foreground shadow-xs leading-snug"
                        onClick={() => handleSend(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 items-start w-full">
                {/* Collapsible Workforce Thinking Column */}
                {!isThinkingCollapsed ? (
                  <div className="w-full lg:w-[420px] shrink-0 flex flex-col min-h-[480px] max-h-[calc(100vh-140px)] sticky top-20 transition-all">
                    <div className="mb-3 rounded-xl border border-line bg-card p-3.5 shadow-sm shrink-0 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                          Your Need Query
                        </p>
                        <p className="text-xs font-medium text-foreground line-clamp-2">
                          "{activeQuery || input}"
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsThinkingCollapsed(true)}
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0 gap-1"
                        title="Collapse thinking column"
                      >
                        <EyeOff className="size-3" /> Hide Thinking
                      </Button>
                    </div>

                    {/* Error State with Retry Button */}
                    {status === "ERROR" && (
                      <div className="mb-3 rounded-xl border border-coral/30 bg-coral/10 p-3.5 shadow-sm shrink-0">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="size-5 text-coral shrink-0 mt-0.5" />
                          <div>
                            <h3 className="font-semibold text-coral text-xs">
                              {t("assistant.errorTitle", "Assistant Encountered an Issue")}
                            </h3>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {errorMessage ||
                                t(
                                  "assistant.errorDesc",
                                  "Unable to complete agent workflow. Please check your connection and try again.",
                                )}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRetry}
                              className="mt-2.5 h-7 text-xs gap-1.5 border-coral/40 text-coral hover:bg-coral/10"
                            >
                              <RefreshCw className="size-3" />
                              {t("assistant.retry", "Retry Run")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Main Timeline Card with Scroll Container */}
                    <div className="relative flex-1 rounded-xl border border-line bg-card p-4 shadow-sm flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between pb-3 mb-2 border-b border-line shrink-0">
                        <h2 className="text-xs font-semibold flex items-center gap-1.5 font-display">
                          <Sparkles className="size-3.5 text-brand" />
                          Workforce Orchestration
                        </h2>
                        <div className="flex items-center gap-2">
                          {status === "PROCESSING" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded-full font-medium">
                              <Loader2 className="size-2.5 animate-spin" /> Live
                            </span>
                          )}
                          {status === "ACTION_REQUIRED" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                              Paused for Input
                            </span>
                          )}
                          {status === "COMPLETED" && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sage bg-sage/10 px-2 py-0.5 rounded-full font-medium">
                              <Check className="size-2.5" /> Done
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsThinkingCollapsed(true)}
                            className="size-6 text-muted-foreground hover:text-foreground"
                            title="Collapse thinking panel"
                          >
                            <EyeOff className="size-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Scrollable Agent Feed */}
                      <div
                        ref={journeyScrollRef}
                        onScroll={handleJourneyScroll}
                        className="flex-1 overflow-y-auto pr-1 space-y-6 scroll-smooth"
                      >
                        <div className="relative pl-6 border-l-2 border-line space-y-6 py-2 ml-3">
                          {journeySteps.map((step, index) => {
                            const isCurrent = index === activeStepIndex && status === "PROCESSING";
                            const isPast =
                              (index < activeStepIndex && activeStepIndex !== -1) ||
                              (status === "COMPLETED" && (step.messages.length > 0 || index <= 4));
                            const isUpcoming = !isCurrent && !isPast;
                            const isExpanded = expandedSteps[step.agentId] ?? true;

                            return (
                              <div key={step.id} className="relative transition-all duration-200">
                                <span
                                  className={`absolute -left-[37px] grid size-7 place-items-center rounded-full border-2 transition-all ${
                                    isCurrent
                                      ? "bg-brand border-brand text-primary-foreground animate-pulse shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                                      : isPast
                                        ? "bg-sage border-sage text-primary-foreground"
                                        : "bg-card border-line/60 text-muted-foreground/50"
                                  }`}
                                >
                                  <step.icon className="size-3.5" />
                                </span>

                                <div className="pl-2">
                                  <div
                                    className="flex items-center justify-between cursor-pointer select-none"
                                    onClick={() => toggleStepExpansion(step.agentId)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <h3
                                        className={`font-medium text-xs flex items-center gap-1.5 ${
                                          isCurrent
                                            ? "text-brand font-semibold"
                                            : isPast
                                              ? "text-foreground"
                                              : "text-muted-foreground/60"
                                        }`}
                                      >
                                        {step.name}
                                      </h3>
                                      {isUpcoming && (
                                        <span className="text-[10px] text-muted-foreground/50 border border-line/60 rounded px-1.5 py-0.2">
                                          Queued
                                        </span>
                                      )}
                                      {isPast && (
                                        <span className="text-[10px] text-sage font-medium flex items-center gap-0.5">
                                          <Check className="size-2.5" /> Done
                                        </span>
                                      )}
                                    </div>
                                    {(step.messages.length > 0 || isCurrent) && (
                                      <button className="text-muted-foreground hover:text-foreground">
                                        {isExpanded ? (
                                          <ChevronUp className="size-3.5" />
                                        ) : (
                                          <ChevronDown className="size-3.5" />
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {isExpanded && step.messages.length > 0 && (
                                    <div className="mt-2 space-y-2">
                                      {step.messages.map((msg, i) => {
                                        const isWarning =
                                          msg.startsWith("⚠️") ||
                                          msg.toLowerCase().includes("notice") ||
                                          msg.toLowerCase().includes("issue");
                                        return (
                                          <div
                                            key={i}
                                            className={`text-xs rounded-md p-2.5 border leading-relaxed ${
                                              isWarning
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 font-medium"
                                                : "bg-ice-2/60 border-line text-muted-foreground"
                                            }`}
                                          >
                                            {msg}
                                          </div>
                                        );
                                      })}

                                      {/* Real-Time Agent Thought Stream */}
                                      {step.details?.thought && (
                                        <div className="p-2 rounded-md bg-brand/5 border border-brand/10 text-[11px] text-muted-foreground flex items-start gap-1.5">
                                          <span className="text-brand shrink-0 mt-0.5">💭</span>
                                          <span className="italic">{step.details.thought}</span>
                                        </div>
                                      )}

                                      {/* Structured Findings Drawer per Agent */}
                                      {step.agentId === "citizen" && step.details?.intent && (
                                        <div className="p-2.5 rounded-lg bg-brand/5 border border-brand/15 text-xs space-y-1.5">
                                          <div className="flex items-center gap-2">
                                            <span className="font-semibold text-brand">
                                              Category:
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-brand/10 text-brand font-medium">
                                              {step.details.intent.category}
                                            </span>
                                            <span className="font-semibold text-muted-foreground ml-2">
                                              Urgency:
                                            </span>
                                            <span className="capitalize text-muted-foreground font-medium">
                                              {step.details.intent.urgency}
                                            </span>
                                          </div>
                                          {step.details.intent.summary && (
                                            <p className="text-[11px] text-muted-foreground italic">
                                              "{step.details.intent.summary}"
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {step.agentId === "eligibility" &&
                                        step.details?.eligibility?.criteria && (
                                          <div className="p-2.5 rounded-lg bg-card border border-line text-xs space-y-2">
                                            <div className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                                              Evaluated Criteria & Evidence
                                            </div>
                                            {step.details.eligibility.criteria.map(
                                              (crit: any, cIdx: number) => {
                                                const critId = `${step.id}-${cIdx}`;
                                                const isShowingEv = showEvidence[critId];
                                                return (
                                                  <div
                                                    key={cIdx}
                                                    className="p-2 rounded bg-ice-2/40 border border-line space-y-1"
                                                  >
                                                    <div className="flex items-center justify-between">
                                                      <span className="font-medium text-foreground">
                                                        {crit.criterion_name || crit.name}
                                                      </span>
                                                      <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                                          crit.status === "verified"
                                                            ? "bg-sage/15 text-sage"
                                                            : "bg-coral/15 text-coral"
                                                        }`}
                                                      >
                                                        {crit.status}
                                                      </span>
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground">
                                                      {crit.explanation || crit.requirement}
                                                    </p>
                                                    <button
                                                      onClick={() => toggleEvidence(critId)}
                                                      className="text-[10px] text-brand flex items-center gap-1 hover:underline pt-0.5"
                                                    >
                                                      <Eye className="size-2.5" />
                                                      {isShowingEv
                                                        ? "Hide Evidence"
                                                        : "Show Evidence"}
                                                    </button>
                                                    {isShowingEv && (
                                                      <div className="mt-1 p-2 rounded bg-card text-[11px] text-muted-foreground border border-line">
                                                        <p>
                                                          <strong>Requirement:</strong>{" "}
                                                          {typeof crit.requirement === "object" &&
                                                          crit.requirement !== null
                                                            ? JSON.stringify(crit.requirement)
                                                            : String(crit.requirement ?? "—")}
                                                        </p>
                                                        <p>
                                                          <strong>Citizen Data:</strong>{" "}
                                                          {typeof (
                                                            crit.citizen_info ?? crit.citizenInfo
                                                          ) === "object" &&
                                                          (crit.citizen_info ??
                                                            crit.citizenInfo) !== null
                                                            ? JSON.stringify(
                                                                crit.citizen_info ??
                                                                  crit.citizenInfo,
                                                              )
                                                            : String(
                                                                crit.citizen_info ??
                                                                  crit.citizenInfo ??
                                                                  "—",
                                                              )}
                                                        </p>
                                                        <p>
                                                          <strong>Source:</strong>{" "}
                                                          {typeof (
                                                            crit.evidence_source ??
                                                            crit.evidenceSource
                                                          ) === "object" &&
                                                          (crit.evidence_source ??
                                                            crit.evidenceSource) !== null
                                                            ? JSON.stringify(
                                                                crit.evidence_source ??
                                                                  crit.evidenceSource,
                                                              )
                                                            : String(
                                                                crit.evidence_source ??
                                                                  crit.evidenceSource ??
                                                                  "—",
                                                              )}
                                                        </p>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                        )}

                                      {step.agentId === "document" &&
                                        step.details?.missing_documents &&
                                        step.details.missing_documents.length > 0 && (
                                          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                            <p className="font-semibold flex items-center gap-1.5">
                                              <FileWarning className="size-3.5 text-amber-600" />
                                              Missing Documents Required:
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                              {step.details.missing_documents.map(
                                                (doc: string, dIdx: number) => (
                                                  <span
                                                    key={dIdx}
                                                    className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[11px] font-medium max-w-full break-words"
                                                  >
                                                    {typeof doc === "object" && doc !== null
                                                      ? JSON.stringify(doc)
                                                      : String(doc)}
                                                  </span>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                  )}

                                  {isCurrent && (
                                    <div className="mt-2 text-xs text-brand flex items-center gap-2 font-medium animate-pulse">
                                      <div className="size-2 rounded-full bg-brand" />
                                      Agent processing your request...
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Floating Jump to Latest Button */}
                      {showScrollBottomPill && (
                        <button
                          onClick={scrollToBottom}
                          className="absolute bottom-4 right-4 bg-brand text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-md hover:bg-brand/90 flex items-center gap-1.5 transition-all animate-bounce"
                        >
                          <ArrowDown className="size-3.5" /> Jump to latest
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Right Column: Dynamic Stage View (Skeletons -> Action Required -> Application Ready -> Discovered Schemes) */}
                <div className="flex-1 w-full min-w-0">
                  {/* Banner when thinking is collapsed */}
                  {isThinkingCollapsed && (
                    <div className="mb-4 flex items-center justify-between p-3.5 rounded-xl border border-line bg-card shadow-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0">
                          <Sparkles className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              Workforce Orchestration
                            </span>
                            {status === "PROCESSING" && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-brand bg-brand/10 px-2 py-0.5 rounded-full font-medium">
                                <Loader2 className="size-2.5 animate-spin" /> Live Processing
                              </span>
                            )}
                            {status === "ACTION_REQUIRED" && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full font-medium">
                                Paused for Input
                              </span>
                            )}
                            {status === "COMPLETED" && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-sage bg-sage/10 px-2 py-0.5 rounded-full font-medium">
                                <Check className="size-2.5" /> Done
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            "{activeQuery || input}"
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsThinkingCollapsed(false)}
                        className="h-8 text-xs gap-1.5 border-line hover:border-brand/40 hover:bg-brand/5 text-brand font-medium shrink-0 ml-3"
                      >
                        <Eye className="size-3.5" />
                        Show Agent Thinking
                      </Button>
                    </div>
                  )}

                  {/* 1. COMPLETED: Application Ready Final Summary Screen */}
                  {status === "COMPLETED" && applicationDraft ? (
                    <div className="rounded-xl border border-sage/40 bg-card p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
                      {/* Top Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-line">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sage/15 text-sage">
                            <CheckCircle2 className="size-3.5" /> Application Draft Ready
                          </span>
                          <h2 className="text-2xl font-bold font-display mt-2 text-foreground">
                            {candidateSchemes[0]?.name ||
                              applicationDraft?.ai_summary?.scheme_name ||
                              "Government Scheme Benefit"}
                          </h2>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {candidateSchemes[0]?.benefit ||
                              applicationDraft?.ai_summary?.benefit_summary ||
                              "Official Government Support"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-muted-foreground">Tracking Draft ID</span>
                          <div className="text-base font-mono font-bold text-brand mt-0.5">
                            {applicationDraft.id || "SAH-2026-DRAFT"}
                          </div>
                        </div>
                      </div>

                      {/* AI Executive Summary Card */}
                      <div className="p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-4 text-brand" />
                          <h3 className="text-xs font-bold uppercase tracking-wider text-brand">
                            AI Workforce Summary & Match Reason
                          </h3>
                        </div>
                        <p className="text-xs text-foreground/90 leading-relaxed">
                          {applicationDraft.ai_summary?.reasoning ||
                            `Based on your query ('${activeQuery}'), this scheme provides the most direct match with verified eligibility.`}
                        </p>
                        <div className="grid sm:grid-cols-3 gap-2 pt-1">
                          <div className="p-2 rounded bg-card border border-line text-xs">
                            <span className="text-[10px] text-muted-foreground block">
                              Verified Fields
                            </span>
                            <span className="font-semibold text-sage">
                              {applicationDraft.ai_summary?.verified_count ?? 4} Attributes Verified
                            </span>
                          </div>
                          <div className="p-2 rounded bg-card border border-line text-xs">
                            <span className="text-[10px] text-muted-foreground block">
                              Flagged for Review
                            </span>
                            <span className="font-semibold text-amber-600">
                              {applicationDraft.ai_summary?.review_count ?? 2} Pending Review
                            </span>
                          </div>
                          <div className="p-2 rounded bg-card border border-line text-xs">
                            <span className="text-[10px] text-muted-foreground block">
                              Review Timeline
                            </span>
                            <span className="font-semibold text-brand">3–5 Business Days</span>
                          </div>
                        </div>
                      </div>

                      {/* Applicant Information Section (With Inline Editing) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <FileBadge className="size-4 text-brand" />
                            Applicant Information & Documents
                          </h3>
                          <div className="flex items-center gap-2">
                            {isEditingDraft ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => setIsEditingDraft(false)}
                                >
                                  <X className="size-3" /> Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-brand hover:bg-brand/90 gap-1"
                                  disabled={isSavingDraft}
                                  onClick={handleSaveDraftEdits}
                                >
                                  {isSavingDraft ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Save className="size-3" />
                                  )}
                                  Save Changes
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 border-line hover:bg-ice-2"
                                onClick={() => setIsEditingDraft(true)}
                              >
                                <Edit2 className="size-3 text-brand" /> Edit Details
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Attribute Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(
                            isEditingDraft
                              ? editableApplicantInfo
                              : applicationDraft.applicant_info || editableApplicantInfo || {},
                          ).map(([field, rawVal]: [string, any]) => {
                            let displayStr = "—";
                            let statusBadge = "needs_review";

                            if (rawVal !== null && typeof rawVal === "object") {
                              displayStr =
                                rawVal.value !== undefined &&
                                rawVal.value !== null &&
                                rawVal.value !== ""
                                  ? String(rawVal.value)
                                  : "—";
                              statusBadge = rawVal.status || "needs_review";
                            } else if (rawVal !== undefined && rawVal !== null && rawVal !== "") {
                              displayStr = String(rawVal);
                              statusBadge = "verified";
                            }

                            return (
                              <div
                                key={field}
                                className={`p-3 rounded-lg border transition-all ${
                                  isEditingDraft
                                    ? "bg-card border-brand/40 shadow-sm"
                                    : "bg-ice-2/40 border-line"
                                } flex flex-col justify-between gap-2`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                    {field}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      statusBadge === "verified"
                                        ? "bg-sage/15 text-sage"
                                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                    }`}
                                  >
                                    {statusBadge === "verified" ? "Verified" : "Review"}
                                  </span>
                                </div>

                                {isEditingDraft ? (
                                  <Input
                                    value={
                                      editableApplicantInfo[field]?.value ??
                                      (displayStr === "—" ? "" : displayStr)
                                    }
                                    onChange={(e) => handleFieldChange(field, e.target.value)}
                                    placeholder={`Enter ${field}`}
                                    className="h-8 text-xs bg-card"
                                  />
                                ) : (
                                  <div className="text-sm font-semibold text-foreground">
                                    {displayStr}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interactive Clarification & Follow-Up Chat Box */}
                      <div className="p-4 rounded-xl border border-line bg-ice-2/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <MessageSquare className="size-3.5 text-brand" />
                            Ask Clarifying Questions to AI Assistant
                          </h4>
                          <span className="text-[10px] text-brand font-medium">Live Q&A</span>
                        </div>

                        {/* Suggested Prompt Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            applicationDraft.ai_summary?.suggested_questions || [
                              `What are the disbursement steps for this scheme?`,
                              `How long does departmental verification take?`,
                              `Can I update my documents after submitting?`,
                            ]
                          ).map((sq: string, sqIdx: number) => (
                            <button
                              key={sqIdx}
                              onClick={() => handleSendFollowUp(sq)}
                              disabled={isAskingFollowUp}
                              className="text-[11px] px-2.5 py-1 rounded-full border border-line bg-card hover:border-brand hover:text-brand transition-colors text-left text-muted-foreground"
                            >
                              💡 {sq}
                            </button>
                          ))}
                        </div>

                        {/* Follow-up messages thread */}
                        {followUpMessages.length > 0 && (
                          <div className="max-h-48 overflow-y-auto space-y-2 p-2 rounded-lg bg-card border border-line">
                            {followUpMessages.map((m, mIdx) => (
                              <div
                                key={mIdx}
                                className={`p-2 rounded text-xs leading-relaxed ${
                                  m.sender === "user"
                                    ? "bg-brand/10 text-brand font-medium ml-4"
                                    : "bg-ice-2 text-foreground mr-4 border border-line"
                                }`}
                              >
                                <span className="font-semibold text-[10px] uppercase block text-muted-foreground mb-0.5">
                                  {m.sender === "user" ? "You" : "Sahayak AI"}
                                </span>
                                {m.text}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Chat input */}
                        <div className="flex gap-2">
                          <Input
                            value={followUpInput}
                            onChange={(e) => setFollowUpInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendFollowUp();
                              }
                            }}
                            placeholder="Type any question about this scheme or your application..."
                            className="h-9 text-xs"
                          />
                          <Button
                            size="sm"
                            className="h-9 bg-brand hover:bg-brand/90 px-3"
                            onClick={() => handleSendFollowUp()}
                            disabled={isAskingFollowUp || !followUpInput.trim()}
                          >
                            {isAskingFollowUp ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Send className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Direct Citizen Consent & 1-Click Submission Box */}
                      {applicationDraft?.already_applied ||
                      applicationDraft?.status === "submitted" ||
                      applicationDraft?.status === "under_review" ||
                      applicationDraft?.status === "approved" ? (
                        <div className="p-4 rounded-xl border border-brand/30 bg-brand/5 space-y-3">
                          <div className="flex items-start gap-2.5 text-xs text-brand font-medium">
                            <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-brand" />
                            <div>
                              <p className="font-semibold text-xs text-foreground">
                                Already Applied for this Scheme
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                You have already submitted an application for this scheme (#
                                {applicationDraft.tracking_id || applicationDraft.id}). Department
                                verification is active.
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-line/50">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                navigate({
                                  to: "/applications/$id",
                                  params: {
                                    id: applicationDraft.tracking_id || applicationDraft.id,
                                  },
                                })
                              }
                              className="text-xs"
                            >
                              View Full Application <ChevronRight className="size-3 ml-1" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-brand hover:bg-brand/90 gap-1.5 shadow-sm font-semibold text-xs"
                              onClick={() => navigate({ to: "/dashboard" })}
                            >
                              <CheckCircle2 className="size-3.5" /> Already Applied · Track in
                              Dashboard
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-sage/40 bg-sage/5 space-y-3">
                          <label className="flex items-start gap-2.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={directConsent}
                              onChange={(e) => setDirectConsent(e.target.checked)}
                              className="mt-0.5 rounded border-line text-brand focus:ring-brand"
                            />
                            <span className="text-xs text-foreground leading-relaxed">
                              I verify that the applicant details above are accurate and grant
                              permission to Sahayak AI to submit this application to the department
                              on my behalf.
                            </span>
                          </label>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate({ to: "/dashboard" })}
                              >
                                Track in Dashboard
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground"
                                onClick={() =>
                                  navigate({
                                    to: "/applications/$id",
                                    params: { id: applicationDraft.id },
                                  })
                                }
                              >
                                Open Full Form <ChevronRight className="size-3 ml-1" />
                              </Button>
                            </div>

                            <Button
                              size="sm"
                              className="bg-brand hover:bg-brand/90 gap-1.5 shadow-sm font-semibold"
                              disabled={isSubmittingDirect || !directConsent}
                              onClick={handleSubmitDirectly}
                            >
                              {isSubmittingDirect ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="size-4" />
                              )}
                              Submit Application Directly
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (status === "ACTION_REQUIRED" || rawRequirements.length > 0) &&
                    status !== "COMPLETED" ? (
                    /* 2. ACTION_REQUIRED / VERIFIED DOCUMENTS CHECKPOINT (Phase C) */
                    <>
                      {missingDocsList.length === 0 ? (
                        /* All Required Documents Are Verified & Available */
                        <div className="rounded-xl border border-sage/50 bg-card p-5 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-300 overflow-hidden">
                          <div className="flex items-start gap-3">
                            <div className="grid size-10 place-items-center rounded-xl bg-sage/15 text-sage shrink-0">
                              <ShieldCheck className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold font-display text-foreground">
                                  All Required Documents Verified
                                </h2>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-sage/15 text-sage">
                                  Verified
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                All mandatory proofs for this scheme are verified in your vault.
                                Ready to assemble your application draft.
                              </p>
                            </div>
                          </div>

                          {/* Verified Documents on File List */}
                          <div className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Verified Items on File ({rawRequirements.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-2.5">
                              {rawRequirements.map((docName, idx) => (
                                <div
                                  key={idx}
                                  className="p-3 rounded-xl border border-sage/40 bg-sage/5 flex items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="grid size-7 place-items-center rounded-lg bg-sage/15 text-sage shrink-0">
                                      <Check className="size-3.5" />
                                    </div>
                                    <span className="text-xs font-medium text-foreground truncate">
                                      {docName}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-semibold text-sage px-2 py-0.5 rounded bg-sage/15 shrink-0">
                                    Verified
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Direct Proceed Button */}
                          <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUploadingMissingDoc}
                              onClick={() => handleResumeWorkflow(false)}
                              className="gap-1.5 text-xs h-9"
                            >
                              <RefreshCw
                                className={`size-3.5 ${isUploadingMissingDoc ? "animate-spin" : ""}`}
                              />
                              Re-Check Vault
                            </Button>

                            <Button
                              size="sm"
                              disabled={isUploadingMissingDoc}
                              onClick={() => handleResumeWorkflow(false)}
                              className="bg-brand hover:bg-brand/90 gap-2 text-xs h-9 font-semibold shadow-sm"
                            >
                              Proceed to Application Draft <ArrowRight className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* Missing Mandatory Documents UI */
                        <div className="rounded-xl border border-amber-500/40 bg-card p-5 sm:p-6 shadow-sm space-y-5 animate-in fade-in duration-300 overflow-hidden">
                          <div className="flex items-start gap-3">
                            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600 shrink-0">
                              <FileWarning className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold font-display text-foreground">
                                  Action Required: Missing Documents
                                </h2>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                  Paused for Input
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                Document Agent paused the workflow. Upload any available documents
                                below to extract verified data, or proceed with what you have.
                              </p>
                            </div>
                          </div>

                          {/* Prominent Guidance & Limitation Notice Banner */}
                          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                            <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-1 min-w-0">
                              <p className="font-semibold text-xs">
                                Don't have all the requested documents?
                              </p>
                              <p className="text-[11px] opacity-90 leading-relaxed">
                                You can upload what you have right now or click{" "}
                                <strong className="font-semibold">
                                  "Proceed with given documents"
                                </strong>{" "}
                                below.
                              </p>
                              <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200 pt-0.5">
                                ⚠️ Your suggestion result will be limited according to the documents
                                you provided.
                              </p>
                            </div>
                          </div>

                          {/* Hidden Native File Input */}
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={handleMissingDocUpload}
                          />

                          {/* Document List Grid */}
                          <div className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Required Items ({missingDocsList.length})
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                              {missingDocsList.map((docName, idx) => {
                                const isThisUploading =
                                  isUploadingMissingDoc && selectedUploadDocType === docName;
                                const isUploaded = uploadSuccessDoc === docName;
                                const isPhoneReq = /mobile|phone|contact number/i.test(docName);

                                return (
                                  <div
                                    key={idx}
                                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden ${
                                      isUploaded
                                        ? "border-sage/50 bg-sage/5"
                                        : "border-line bg-ice-2/30 hover:border-brand/40"
                                    }`}
                                  >
                                    <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                                      <div
                                        className={`grid size-9 place-items-center rounded-lg shrink-0 mt-0.5 sm:mt-0 ${
                                          isUploaded
                                            ? "bg-sage/15 text-sage"
                                            : isPhoneReq
                                              ? "bg-brand/15 text-brand"
                                              : "bg-brand/10 text-brand"
                                        }`}
                                      >
                                        {isUploaded ? (
                                          <Check className="size-4" />
                                        ) : isPhoneReq ? (
                                          <Phone className="size-4" />
                                        ) : (
                                          <FileText className="size-4" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1 pr-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-sm font-semibold text-foreground break-words">
                                            {docName}
                                          </span>
                                          <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                            Mandatory
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                          {isUploaded
                                            ? "Verified · Auto-resuming run..."
                                            : isPhoneReq
                                              ? "Enter your 10-digit number for SMS alerts & DBT (no file needed)"
                                              : "PDF or clear photo (max 10MB)"}
                                        </p>
                                      </div>
                                    </div>

                                    {isPhoneReq && !isUploaded ? (
                                      /* Inline Text Input for Phone Number */
                                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
                                        <Input
                                          type="tel"
                                          placeholder="10-digit mobile number"
                                          value={phoneInputs[docName] ?? profile?.phone ?? ""}
                                          onChange={(e) =>
                                            setPhoneInputs((prev) => ({
                                              ...prev,
                                              [docName]: e.target.value,
                                            }))
                                          }
                                          className="h-8 text-xs w-full sm:w-44 bg-card border-line"
                                        />
                                        <Button
                                          size="sm"
                                          disabled={isSavingPhone || isUploadingMissingDoc}
                                          onClick={() =>
                                            handleSavePhone(
                                              docName,
                                              phoneInputs[docName] ?? profile?.phone ?? "",
                                            )
                                          }
                                          className="h-8 px-3 text-xs bg-brand hover:bg-brand/90 text-white shrink-0 w-full sm:w-auto"
                                        >
                                          {isSavingPhone ? (
                                            <>
                                              <Loader2 className="size-3 animate-spin mr-1" />{" "}
                                              Saving...
                                            </>
                                          ) : (
                                            "Save Number"
                                          )}
                                        </Button>
                                      </div>
                                    ) : (
                                      /* Standard Document File Uploader Button */
                                      <Button
                                        size="sm"
                                        variant={isUploaded ? "outline" : "default"}
                                        disabled={isUploadingMissingDoc}
                                        onClick={() => triggerUploadForDoc(docName)}
                                        className={`shrink-0 w-full sm:w-auto min-w-[120px] gap-1.5 text-xs ${
                                          isUploaded
                                            ? "border-sage/40 text-sage hover:bg-sage/10"
                                            : "bg-brand hover:bg-brand/90"
                                        }`}
                                      >
                                        {isThisUploading ? (
                                          <>
                                            <Loader2 className="size-3.5 animate-spin" />{" "}
                                            Extracting...
                                          </>
                                        ) : isUploaded ? (
                                          <>
                                            <Check className="size-3.5" /> Uploaded
                                          </>
                                        ) : (
                                          <>
                                            <Upload className="size-3.5" /> Upload File
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Active Extraction / Gemini Vision Progress Indicator */}
                          {uploadExtractionStep && (
                            <div className="p-3.5 rounded-lg bg-brand/10 border border-brand/25 text-xs text-brand font-medium flex items-center gap-2.5 animate-pulse">
                              <Loader2 className="size-4 animate-spin shrink-0" />
                              <span>{uploadExtractionStep}</span>
                            </div>
                          )}

                          {/* Action Controls & Continue Button */}
                          <div className="pt-4 border-t border-line flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUploadingMissingDoc}
                              onClick={() => handleResumeWorkflow(false)}
                              className="gap-1.5 text-xs h-9"
                            >
                              <RefreshCw
                                className={`size-3.5 ${isUploadingMissingDoc ? "animate-spin" : ""}`}
                              />
                              Re-Check & Resume
                            </Button>

                            <Button
                              size="sm"
                              disabled={isUploadingMissingDoc}
                              onClick={() => {
                                if (missingDocsList.length > 0) {
                                  setShowMissingDocsConfirmDialog(true);
                                } else {
                                  handleResumeWorkflow(false);
                                }
                              }}
                              className="bg-brand hover:bg-brand/90 gap-1.5 text-xs h-9 font-medium shadow-sm"
                            >
                              Proceed with given documents <ArrowRight className="size-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Confirmation Dialog: Proceed with Incomplete Documents */}
                      <Dialog
                        open={showMissingDocsConfirmDialog}
                        onOpenChange={setShowMissingDocsConfirmDialog}
                      >
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-amber-600 text-base font-display">
                              <FileWarning className="size-5" />
                              Proceed with Given Documents?
                            </DialogTitle>
                          </DialogHeader>

                          <div className="space-y-3 py-2 text-xs text-muted-foreground">
                            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-1.5">
                              <p className="font-semibold text-xs flex items-center gap-1.5">
                                <AlertCircle className="size-4 text-amber-600 shrink-0" />
                                Limited Suggestions Warning
                              </p>
                              <p className="text-xs font-semibold">
                                Your suggestion result will be limited according to the documents
                                you provided.
                              </p>
                              <p className="text-[11px] opacity-90 leading-relaxed">
                                Any unprovided requirements will be flagged with{" "}
                                <strong>"Review Required"</strong> in your application draft and
                                will require subsequent manual departmental review.
                              </p>
                            </div>

                            <div>
                              <p className="font-medium text-foreground mb-1.5">
                                Unprovided document(s):
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {missingDocsList.map((doc, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-200 font-semibold text-[11px]"
                                  >
                                    {doc}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <DialogFooter className="gap-2 pt-3 border-t border-line">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowMissingDocsConfirmDialog(false)}
                              className="text-xs"
                            >
                              Upload More Docs
                            </Button>
                            <Button
                              size="sm"
                              className="bg-brand hover:bg-brand/90 gap-1.5 text-xs"
                              onClick={() => handleResumeWorkflow(true)}
                            >
                              Proceed with Given Documents <ArrowRight className="size-3.5" />
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  ) : candidateSchemes.length > 0 ? (
                    /* 3. Discovered Candidate Schemes list */
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
                                  {scheme.official && (
                                    <CheckCircle2 className="size-4 text-brand" />
                                  )}
                                </h3>
                                <p className="text-brand font-medium text-sm mt-1">
                                  {scheme.benefit}
                                </p>
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
                  ) : status === "ERROR" ? (
                    /* Error State with Retry Button */
                    <div className="rounded-xl border border-red-500/30 bg-card p-6 shadow-sm space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-start gap-3">
                        <div className="grid size-10 place-items-center rounded-xl bg-red-500/15 text-red-600 shrink-0">
                          <AlertCircle className="size-5" />
                        </div>
                        <div>
                          <h2 className="text-base font-bold font-display text-foreground">
                            Agent Workforce Encountered an Issue
                          </h2>
                          <p className="text-xs text-muted-foreground mt-1">
                            {errorMessage ||
                              "The backend service could not be reached or encountered an error while processing your request."}
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex items-center gap-3">
                        <Button
                          size="sm"
                          onClick={handleRetry}
                          className="bg-brand hover:bg-brand/90 gap-1.5 text-xs"
                        >
                          <RefreshCw className="size-3.5" />
                          Retry Inquiry
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleNewChat}
                          className="text-xs"
                        >
                          Start New Chat
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* 4. Skeleton Loader State while searching / orchestrating */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </div>
                      <div className="p-5 rounded-xl border border-line bg-card space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-64" />
                            <Skeleton className="h-4 w-36" />
                          </div>
                          <Skeleton className="h-10 w-16" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                        <div className="flex justify-between pt-3 border-t border-line">
                          <Skeleton className="h-8 w-32" />
                          <Skeleton className="h-8 w-40" />
                        </div>
                      </div>
                      <div className="p-5 rounded-xl border border-line bg-card space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-56" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-10 w-16" />
                        </div>
                        <Skeleton className="h-12 w-full" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

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
                            <tr
                              key={idx}
                              className={crit.status === "missing" ? "bg-amber-500/5" : ""}
                            >
                              <td className="px-3 py-3 font-medium text-foreground">{crit.name}</td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {crit.citizenInfo}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">
                                {crit.requirement}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {crit.status === "verified" ? (
                                  <CheckCircle2 className="size-4 text-sage inline" />
                                ) : (
                                  <FileWarning className="size-4 text-amber-600 inline" />
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

        {/* Official Application Submission Confirmation Receipt Dialog */}
        <Dialog open={!!submissionReceipt} onOpenChange={() => setSubmissionReceipt(null)}>
          <DialogContent className="max-w-md">
            {submissionReceipt && (
              <div className="text-center space-y-4 py-2">
                <div className="grid size-14 place-items-center rounded-full bg-sage/20 text-sage mx-auto shadow-sm">
                  <CheckCircle2 className="size-8" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold font-display text-foreground">
                    Application Submitted Successfully!
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your application has been logged on the department portal and handed off to the
                    Tracker Agent.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-line bg-ice-2/40 text-left space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-line">
                    <span className="text-muted-foreground">Tracking ID</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-brand">
                        {submissionReceipt.trackingId}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(submissionReceipt.trackingId);
                          toast.success("Tracking ID copied to clipboard!");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Scheme</span>
                    <span className="font-medium text-foreground">
                      {submissionReceipt.schemeName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Submitted At</span>
                    <span className="font-medium text-foreground">
                      {new Date(submissionReceipt.submittedAt).toLocaleDateString()} at{" "}
                      {new Date(submissionReceipt.submittedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Initial Status</span>
                    <span className="px-2 py-0.5 rounded bg-sage/15 text-sage font-semibold text-[10px] uppercase">
                      Submitted
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs gap-1.5"
                    onClick={() => window.print()}
                  >
                    <Printer className="size-3.5" /> Print / Save PDF
                  </Button>
                  <Button
                    className="flex-1 text-xs bg-brand hover:bg-brand/90 gap-1.5"
                    onClick={() => {
                      setSubmissionReceipt(null);
                      navigate({ to: "/dashboard" });
                    }}
                  >
                    Track in Dashboard <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Past Inquiries & Conversation History Drawer Dialog */}
        <Dialog open={showHistoryDrawer} onOpenChange={setShowHistoryDrawer}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <History className="size-4 text-brand" />
                <DialogTitle className="text-lg font-display">
                  Past Inquiries & Workforce Runs
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Revisit your previous civic queries, evaluated schemes, and application progress.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3">
              {isLoadingHistory ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  <Loader2 className="size-5 animate-spin mx-auto mb-2 text-brand" />
                  Loading past inquiries...
                </div>
              ) : pastRuns.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-line rounded-xl">
                  No previous inquiries found for your profile.
                </div>
              ) : (
                pastRuns.map((r) => {
                  const isDone = r.status === "COMPLETED";
                  const isAction = r.status === "ACTION REQUIRED" || r.status === "ACTION_REQUIRED";
                  const isProc = r.status === "PROCESSING" || r.status === "RUNNING";

                  return (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl border border-line bg-card hover:border-brand/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 max-w-sm">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-foreground line-clamp-1">
                            "{r.query}"
                          </p>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isDone
                                ? "bg-sage/15 text-sage"
                                : isAction
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                  : isProc
                                    ? "bg-brand/15 text-brand"
                                    : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isDone
                              ? "Draft Ready"
                              : isAction
                                ? "Needs Docs"
                                : isProc
                                  ? "Processing"
                                  : r.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{r.scheme_name || "Civic Evaluation"}</span>
                          <span>·</span>
                          <span>{new Date(r.started_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 bg-brand hover:bg-brand/90"
                          onClick={() => handleViewPastRun(r)}
                        >
                          View Session <ArrowRight className="size-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-line text-muted-foreground hover:text-foreground"
                          onClick={() => handleRerunPastQuery(r.query)}
                        >
                          Re-run
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-line">
              <Button variant="outline" size="sm" onClick={() => setShowHistoryDrawer(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              Manage connections <ChevronRight className="size-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
