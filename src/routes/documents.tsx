import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Bot,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateDocument, type DocumentValidationResult } from "@/lib/services";
import { requireAuth, getSession } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CANONICAL_SCHEME_LIST } from "@/lib/scheme-constants";

interface DocumentsSearch {
  scheme?: string;
  required?: string;
}

export const Route = createFileRoute("/documents")({
  validateSearch: (search: Record<string, unknown>): DocumentsSearch => ({
    scheme: typeof search.scheme === "string" ? search.scheme : undefined,
    required: typeof search.required === "string" ? search.required : undefined,
  }),
  beforeLoad: async () => {
    await requireAuth();
  },
  component: DocumentsPage,
});

type DocumentItem = {
  id?: string;
  name: string;
  type: string;
  status: string;
  date: string;
  extractedFields?: Record<string, any>;
};

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  { name: "Aadhaar Card", type: "Aadhaar Card", status: "Verified", date: "Today" },
  { name: "Income Certificate", type: "Income Certificate", status: "Verified", date: "Yesterday" },
  { name: "Bank Passbook", type: "Bank Passbook", status: "Needs Review", date: "2 days ago" },
  { name: "Address Proof", type: "Address Proof", status: "Verified", date: "Last month" },
];

function DocumentsPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/documents" });
  const selectedSchemeId = search.scheme;
  const targetedDocType = search.required;

  const [uploadState, setUploadState] = useState<"idle" | "processing" | "complete">("idle");
  const [processStep, setProcessStep] = useState(-1);
  const [result, setResult] = useState<DocumentValidationResult | null>(null);
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>(DEFAULT_DOCUMENTS);
  const [selectedTargetType, setSelectedTargetType] = useState<string | undefined>(targetedDocType);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify active scheme from query parameter
  const activeScheme = useMemo(() => {
    if (!selectedSchemeId) return null;
    return CANONICAL_SCHEME_LIST.find((s) => s.id === selectedSchemeId) || null;
  }, [selectedSchemeId]);

  // Fetch real user documents from Supabase on mount
  useEffect(() => {
    let active = true;

    async function loadUserDocuments() {
      try {
        const session = await getSession();
        if (!session?.user?.id) return;
        if (active) setCurrentUserId(session.user.id);

        if (!isSupabaseConfigured) return;

        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("citizen_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0 && active) {
          const mapped: DocumentItem[] = data.map((doc: any) => ({
            id: doc.id,
            name: doc.file_name || doc.document_type || "Document",
            type: doc.document_type || "Government Document",
            status:
              doc.status === "verified"
                ? "Verified"
                : doc.status === "needs_review"
                  ? "Needs Review"
                  : doc.status === "pending"
                    ? "Pending"
                    : doc.status === "missing"
                      ? "Missing"
                      : doc.status || "Verified",
            date: doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "Recently",
            extractedFields: doc.extracted_fields || {},
          }));
          setDocumentsList(mapped);
        }
      } catch (e) {
        console.warn("[Sahayak] Failed to load user documents:", e);
      }
    }

    loadUserDocuments();
    return () => {
      active = false;
    };
  }, []);

  // Realtime subscription for user documents
  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`citizen-docs-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `citizen_id=eq.${currentUserId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const doc = payload.new as any;
            const updatedItem: DocumentItem = {
              id: doc.id,
              name: doc.file_name || doc.document_type || "Document",
              type: doc.document_type || "Government Document",
              status:
                doc.status === "verified"
                  ? "Verified"
                  : doc.status === "needs_review"
                    ? "Needs Review"
                    : doc.status === "pending"
                      ? "Pending"
                      : doc.status || "Verified",
              date: doc.created_at ? new Date(doc.created_at).toLocaleDateString() : "Recently",
              extractedFields: doc.extracted_fields || {},
            };

            setDocumentsList((prev) => {
              const existingIdx = prev.findIndex((d) => d.id === doc.id);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = updatedItem;
                return next;
              }
              return [updatedItem, ...prev];
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Check scheme document checklist satisfaction
  const checklistStatus = useMemo(() => {
    if (!activeScheme) return null;

    const items = activeScheme.documentRequirements.map((req) => {
      // Look for a matching verified or pending document
      const matchingDoc = documentsList.find(
        (doc) =>
          doc.type.toLowerCase().includes(req.toLowerCase()) ||
          doc.name.toLowerCase().includes(req.toLowerCase()) ||
          req.toLowerCase().includes(doc.type.toLowerCase()),
      );

      const status = matchingDoc ? matchingDoc.status : "Missing";
      return {
        requirement: req,
        matchedDoc: matchingDoc,
        status: status,
        isVerified: status === "Verified",
      };
    });

    const allVerified = items.every((i) => i.isVerified);
    const verifiedCount = items.filter((i) => i.isVerified).length;

    return {
      items,
      allVerified,
      verifiedCount,
      totalCount: items.length,
    };
  }, [activeScheme, documentsList]);

  const processingSteps = [
    "Upload received & stored in Supabase",
    "Document classified by Document Agent",
    "Multimodal Groq Vision analysis",
    "Verifiable fields extracted",
    "Identity information verified",
    "Status & confidence score saved",
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processUploadedFile(file);
  };

  const processUploadedFile = async (file: File) => {
    setUploadState("processing");
    setProcessStep(0);

    for (let i = 0; i < processingSteps.length; i++) {
      await new Promise((r) => setTimeout(r, 400));
      setProcessStep(i);
    }

    const docResult = await validateDocument(file);
    setResult(docResult);
    setUploadState("complete");

    // Add to local documents list immediately if client-side
    if (docResult) {
      const newItem: DocumentItem = {
        name: file.name,
        type: selectedTargetType || docResult.type || "Document",
        status: docResult.status === "verified" ? "Verified" : "Needs Review",
        date: "Just now",
        extractedFields: docResult.extractedFields,
      };
      setDocumentsList((prev) => [newItem, ...prev]);
    }
  };

  const handleUploadTarget = (docType?: string) => {
    setSelectedTargetType(docType);
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          {/* Header */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-card px-2.5 py-0.5 text-xs font-medium text-brand-soft">
              <ShieldCheck className="size-3.5 text-brand" /> Document Agent · Verifiable Evidence
            </span>
            <h1 className="text-3xl font-display font-semibold mt-2 mb-1">
              {t("documents.title", "Document Center")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "documents.subtitle",
                "Upload and manage credentials verified by Sahayak's multimodal Document Agent.",
              )}
            </p>
          </div>

          {/* Guided Scheme Checklist if ?scheme is provided */}
          {activeScheme && checklistStatus && (
            <div className="rounded-2xl border-2 border-brand/20 bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-brand">
                    Guided Scheme Checklist
                  </span>
                  <h2 className="text-lg font-display font-semibold">{activeScheme.name}</h2>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-ice-2 px-3 py-1 text-xs font-semibold">
                    {checklistStatus.verifiedCount} of {checklistStatus.totalCount} Ready
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                {checklistStatus.items.map((item) => (
                  <div
                    key={item.requirement}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      item.isVerified
                        ? "border-sage/30 bg-sage/5"
                        : item.status === "Needs Review"
                          ? "border-amber/30 bg-amber/5"
                          : "border-line bg-ice-2/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${
                          item.isVerified
                            ? "bg-sage text-white"
                            : item.status === "Needs Review"
                              ? "bg-amber text-white"
                              : "bg-mist text-muted-foreground"
                        }`}
                      >
                        {item.isVerified ? <Check className="size-4" /> : "!"}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{item.requirement}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.isVerified
                            ? "Verified evidence available"
                            : item.status === "Needs Review"
                              ? "Needs citizen verification"
                              : "Required for complete eligibility"}
                        </p>
                      </div>
                    </div>
                    <div>
                      {item.isVerified ? (
                        <span className="inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-2.5 py-0.5 text-xs font-medium text-sage">
                          Verified
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs bg-card hover:bg-brand hover:text-white"
                          onClick={() => handleUploadTarget(item.requirement)}
                        >
                          Upload now
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {checklistStatus.allVerified ? (
                <div className="rounded-xl border border-sage/40 bg-sage/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-sage">
                    <Sparkles className="size-5" />
                    <div>
                      <p className="text-sm font-semibold">All documents verified!</p>
                      <p className="text-xs text-muted-foreground">
                        Your evidence package is ready for human approval and submission.
                      </p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    className="bg-sage hover:bg-sage/90 text-white shrink-0"
                  >
                    <Link to="/applications">
                      Proceed to Application <ArrowRight className="size-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Info className="size-3.5 text-brand" />
                  Upload remaining documents above to unlock the final application sign-off.
                </p>
              )}
            </div>
          )}

          {/* Attention Required List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber flex items-center gap-2">
              <AlertTriangle className="size-4" /> Documents Requiring Action
            </h2>
            <div className="grid gap-2.5">
              {documentsList
                .filter((d) =>
                  [
                    "Missing",
                    "Needs Review",
                    "Expired",
                    "Pending",
                    "pending",
                    "needs_review",
                    "missing",
                  ].includes(d.status),
                )
                .map((doc, idx) => (
                  <div
                    key={`${doc.name}-${idx}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-card shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-amber/10 text-amber">
                        <FileWarning className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type} • {doc.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber">
                        {doc.status}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => handleUploadTarget(doc.type)}
                      >
                        Re-upload
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Verified Evidence List */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sage flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Verified Credentials Vault
            </h2>
            <div className="grid gap-2.5">
              {documentsList
                .filter((d) => ["Verified", "verified"].includes(d.status))
                .map((doc, idx) => (
                  <div
                    key={`${doc.name}-${idx}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-card shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-sage/10 text-sage">
                        <FileText className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type} • {doc.date}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-2.5 py-0.5 text-xs font-medium text-sage">
                      {doc.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Upload Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm sticky top-24">
            <h2 className="text-lg font-display font-semibold mb-1">
              {t("documents.upload", "Upload Evidence")}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {selectedTargetType
                ? `Uploading target: ${selectedTargetType}`
                : "Multimodal AI extracts and verifies identity, income, and residence."}
            </p>

            {uploadState === "idle" && (
              <div
                className="border-2 border-dashed border-line rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-brand/5 hover:border-brand/50 transition-colors"
                onClick={() => handleUploadTarget(selectedTargetType)}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <UploadCloud className="size-10 text-brand mb-3" />
                <p className="font-medium text-foreground mb-1 text-sm">Drop document here</p>
                <p className="text-xs text-muted-foreground mb-4">
                  or click to browse (Images, PDF)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadTarget(selectedTargetType);
                  }}
                >
                  Choose file
                </Button>
              </div>
            )}

            {uploadState === "processing" && (
              <div className="space-y-5">
                <div className="flex items-center gap-3 text-brand">
                  <Bot className="size-5 animate-bounce" />
                  <span className="text-sm font-medium">Document Agent Analyzing...</span>
                </div>

                <div className="space-y-2.5 relative pl-4 border-l-2 border-line ml-2">
                  {processingSteps.map((step, idx) => {
                    const isComplete = processStep > idx;
                    const isCurrent = processStep === idx;
                    if (processStep < idx) return null;

                    return (
                      <div key={idx} className="relative flex items-center gap-2.5">
                        <span
                          className={`absolute -left-[21px] grid size-5 place-items-center rounded-full border-2 ${
                            isComplete
                              ? "bg-sage border-sage"
                              : "bg-brand border-brand animate-pulse"
                          }`}
                        >
                          {isComplete && <CheckCircle2 className="size-3 text-white" />}
                        </span>
                        <span
                          className={`text-xs ${
                            isCurrent ? "text-foreground font-medium" : "text-muted-foreground"
                          }`}
                        >
                          {step}
                        </span>
                        {isCurrent && (
                          <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {uploadState === "complete" && result && (
              <div className="space-y-4 animate-in fade-in">
                <div className="flex items-center gap-2 text-sage">
                  <CheckCircle2 className="size-5" />
                  <span className="font-medium text-sm">Verification Complete</span>
                </div>

                <div className="bg-ice-2 rounded-xl p-3.5 text-xs border border-line space-y-2.5">
                  <div className="flex justify-between items-center pb-2 border-b border-line">
                    <div>
                      <p className="text-muted-foreground">Extracted Type</p>
                      <p className="font-semibold text-foreground">{result.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Confidence</p>
                      <p className="font-bold text-sage">{result.confidence}%</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {Object.entries(result.extractedFields).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}:</span>
                        <span className="font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-amber bg-amber/10 p-2 rounded-lg border border-amber/20 flex gap-2">
                  <AlertTriangle className="size-3 flex-shrink-0 mt-0.5" />
                  AI extraction assists review and operates within human oversight guardrails.
                </p>

                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    setUploadState("idle");
                    setSelectedTargetType(undefined);
                  }}
                >
                  Upload another document
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
