import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
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
  FolderOpen,
  Clock,
  Eye,
  Zap,
  ChevronRight,
  X,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { validateDocument, deleteUserDocument, type DocumentValidationResult } from "@/lib/services";
import { requireAuth, getSession } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { CANONICAL_SCHEME_LIST } from "@/lib/scheme-constants";

interface DocumentsSearch {
  scheme?: string | undefined;
  required?: string | undefined;
}

export const Route = createFileRoute("/documents")({
  validateSearch: (search: Record<string, unknown>): DocumentsSearch => ({
    scheme: typeof search["scheme"] === "string" ? search["scheme"] : undefined,
    required: typeof search["required"] === "string" ? search["required"] : undefined,
  }),
  beforeLoad: async () => {
    await requireAuth();
  },
  component: DocumentsPage,
});

type DocumentItem = {
  id?: string | undefined;
  name: string;
  type: string;
  status: string;
  date: string;
  extractedFields?: Record<string, any> | undefined;
  confidence?: number | undefined;
};

const DOCUMENT_TYPES = [
  { id: "Aadhaar Card", label: "Aadhaar Card", icon: "🪪", desc: "12-digit UID card issued by UIDAI" },
  { id: "PAN Card", label: "PAN Card", icon: "💳", desc: "Permanent Account Number for tax filing" },
  { id: "Income Certificate", label: "Income Certificate", icon: "📄", desc: "Annual household income proof" },
  { id: "Residence Proof", label: "Residence Proof", icon: "🏠", desc: "Address verification document" },
  { id: "Caste Certificate", label: "Caste Certificate", icon: "📋", desc: "OBC/SC/ST category certificate" },
  { id: "Birth Certificate", label: "Birth Certificate", icon: "🗓️", desc: "Date of birth proof" },
  { id: "Bank Passbook", label: "Bank Passbook", icon: "🏦", desc: "Bank account details for DBT" },
  { id: "Disability Certificate", label: "Disability Certificate", icon: "♿", desc: "Certified disability proof" },
  { id: "Land Record", label: "Land Record (RoR)", icon: "🌾", desc: "Ownership record for agriculture schemes" },
  { id: "Other", label: "Other Document", icon: "📁", desc: "Any other government document" },
];

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  { name: "Aadhaar Card", type: "Aadhaar Card", status: "Verified", date: "Today", confidence: 97 },
  { name: "Income Certificate", type: "Income Certificate", status: "Verified", date: "Yesterday", confidence: 91 },
  { name: "Bank Passbook", type: "Bank Passbook", status: "Needs Review", date: "2 days ago", confidence: 62 },
  { name: "Address Proof", type: "Residence Proof", status: "Verified", date: "Last month", confidence: 88 },
];

type UploadPhase = "type_select" | "drop_zone" | "uploading" | "queued" | "extracted" | "error";

function mapStatus(status: string): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "needs_review":
      return "Needs Review";
    case "pending":
      return "Pending";
    case "missing":
      return "Missing";
    case "extraction_failed":
      return "Extraction Failed";
    default:
      return status || "Unknown";
  }
}

// Fields we don't show in the UI — internal/meta fields from the backend
const HIDDEN_EXTRACTED_FIELDS = new Set([
  "document_type", "confidence", "is_valid", "type_mismatch",
  "type_mismatch_detail", "extraction_error", "summary",
]);

// Human-friendly labels for extracted field keys
const FIELD_LABELS: Record<string, string> = {
  applicant_name:    "Applicant Name",
  id_number:         "ID / Certificate No.",
  dob:               "Date of Birth",
  father_name:       "Father's Name",
  address:           "Address",
  income_amount:     "Annual Income",
  issue_date:        "Issue Date",
  issuing_authority: "Issuing Authority",
};

function DocumentsPage() {
  const { t } = useTranslation();
  const search = useSearch({ from: "/documents" });
  const selectedSchemeId = search.scheme;
  const targetedDocType = search.required;

  const [phase, setPhase] = useState<UploadPhase>(targetedDocType ? "drop_zone" : "type_select");
  const [chosenType, setChosenType] = useState<string>(targetedDocType || "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentValidationResult | null>(null);
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [documentsList, setDocumentsList] = useState<DocumentItem[]>(
    isSupabaseConfigured ? [] : DEFAULT_DOCUMENTS,
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(isSupabaseConfigured);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteConfirm = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      if (docToDelete.id) {
        const res = await deleteUserDocument(docToDelete.id);
        if (!res.ok) {
          toast.error(res.error || "Failed to delete document.");
          return;
        }
      }
      setDocumentsList((prev) =>
        prev.filter((d) => (docToDelete.id ? d.id !== docToDelete.id : d.name !== docToDelete.name)),
      );
      toast.success("Document removed successfully.");
      setDocToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  const activeScheme = useMemo(() => {
    if (!selectedSchemeId) return null;
    return CANONICAL_SCHEME_LIST.find((s) => s.id === selectedSchemeId) || null;
  }, [selectedSchemeId]);

  useEffect(() => {
    let active = true;
    async function loadUserDocuments() {
      try {
        const session = await getSession();
        if (!session?.user?.id) {
          if (active) setLoadingInitial(false);
          return;
        }
        if (active) setCurrentUserId(session.user.id);
        if (!isSupabaseConfigured) {
          if (active) { setDocumentsList(DEFAULT_DOCUMENTS); setLoadingInitial(false); }
          return;
        }
        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("citizen_id", session.user.id)
          .order("uploaded_at", { ascending: false });
        if (!error && active) {
          const mapped: DocumentItem[] = (data || []).map((doc: any) => ({
            id: doc.id,
            name: doc.file_name || doc.document_type || "Document",
            type: doc.document_type || "Government Document",
            status: mapStatus(doc.status),
            date: doc.uploaded_at || doc.created_at ? new Date(doc.uploaded_at || doc.created_at).toLocaleDateString() : "Recently",
            extractedFields: doc.extracted_fields || {},
            confidence: doc.confidence ? Math.round(Number(doc.confidence) * 100) : undefined,
          }));
          setDocumentsList(mapped);
        }
      } catch (e) {
        console.warn("[Sahayak] Failed to load user documents:", e);
      } finally {
        if (active) setLoadingInitial(false);
      }
    }
    loadUserDocuments();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel(`citizen-docs-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `citizen_id=eq.${currentUserId}` },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const doc = payload.new as any;
            const updatedItem: DocumentItem = {
              id: doc.id,
              name: doc.file_name || doc.document_type || "Document",
              type: doc.document_type || "Government Document",
              status: mapStatus(doc.status),
              date: doc.uploaded_at || doc.created_at ? new Date(doc.uploaded_at || doc.created_at).toLocaleDateString() : "Recently",
              extractedFields: doc.extracted_fields || {},
              confidence: doc.confidence ? Math.round(Number(doc.confidence) * 100) : undefined,
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
            if (doc.id === pendingDocId && doc.status !== "pending") {
              setResult((prev) =>
                prev
                  ? {
                      ...prev,
                      type: doc.document_type || prev.type,
                      confidence: doc.confidence ? Math.round(Number(doc.confidence) * 100) : 0,
                      status: doc.status,
                      extractedFields: doc.extracted_fields || prev.extractedFields,
                    }
                  : prev,
              );
              setPhase("extracted");
              setPendingDocId(null);
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, pendingDocId]);

  const checklistStatus = useMemo(() => {
    if (!activeScheme) return null;
    const items = activeScheme.documentRequirements.map((req) => {
      const matchingDoc = documentsList.find(
        (doc) =>
          doc.type.toLowerCase().includes(req.toLowerCase()) ||
          doc.name.toLowerCase().includes(req.toLowerCase()) ||
          req.toLowerCase().includes(doc.type.toLowerCase()),
      );
      const status = matchingDoc ? matchingDoc.status : "Missing";
      return { requirement: req, matchedDoc: matchingDoc, status, isVerified: status === "Verified" };
    });
    const allVerified = items.every((i) => i.isVerified);
    const verifiedCount = items.filter((i) => i.isVerified).length;
    return { items, allVerified, verifiedCount, totalCount: items.length };
  }, [activeScheme, documentsList]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (!file) return;
      setUploadError(null);
      setPhase("uploading");
      try {
        const docResult = await validateDocument(file, chosenType || "Other");
        if (!docResult.ok) {
          setUploadError(docResult.error || "Failed to upload document.");
          setPhase("error");
          return;
        }
        setResult(docResult.data);
        if (docResult.data.documentId && docResult.data.status === "pending") {
          setPendingDocId(docResult.data.documentId);
          setPhase("queued");
        } else {
          setPhase("extracted");
        }
      } catch (err: any) {
        console.error("[Documents] Upload error:", err);
        setUploadError(err.message || "An unexpected error occurred during upload.");
        setPhase("error");
      }
    },
    [chosenType],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    handleFileSelected(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const resetUpload = (goToTypeSelect = true) => {
    setUploadError(null);
    setResult(null);
    setPendingDocId(null);
    setChosenType(targetedDocType || "");
    setPhase(targetedDocType ? "drop_zone" : goToTypeSelect ? "type_select" : "drop_zone");
  };

  const handleUploadForType = (docType: string) => {
    setUploadError(null);
    setChosenType(docType);
    setPhase("drop_zone");
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const actionRequiredDocs = documentsList.filter((d) =>
    ["Missing", "Needs Review", "Expired", "Pending", "pending", "needs_review", "missing"].includes(d.status),
  );
  const verifiedDocs = documentsList.filter((d) => ["Verified", "verified"].includes(d.status));

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-6">
          {!isSupabaseConfigured && (
            <div className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber flex items-center justify-between">
              <span>Demo mode active — displaying sample document fixtures.</span>
              <span className="font-semibold uppercase tracking-wider text-[10px]">Demo</span>
            </div>
          )}

          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-mist bg-card px-2.5 py-0.5 text-xs font-medium text-brand-soft">
              <ShieldCheck className="size-3.5 text-brand" /> Document Agent · Verifiable Evidence
            </span>
            <h1 className="text-3xl font-display font-semibold mt-2 mb-1">
              {t("documents.title", "Document Vault")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "documents.subtitle",
                "Upload and manage credentials verified by Sahayak's multimodal Document Agent.",
              )}
            </p>
          </div>

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
                          onClick={() => handleUploadForType(item.requirement)}
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
                  <Button asChild size="sm" className="bg-sage hover:bg-sage/90 text-white shrink-0">
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

          {/* Attention Required */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber flex items-center gap-2">
              <AlertTriangle className="size-4" /> Documents Requiring Action
            </h2>
            {loadingInitial ? (
              <div className="p-4 rounded-xl border border-line bg-card text-center text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin inline mr-2" /> Loading documents...
              </div>
            ) : actionRequiredDocs.length === 0 ? (
              <div className="p-4 rounded-xl border border-line bg-card text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 text-sage inline mr-1.5" />
                No documents require immediate attention.
              </div>
            ) : (
              <div className="grid gap-2.5">
                {actionRequiredDocs.map((doc, idx) => (
                  <div
                    key={`${doc.id || doc.name}-${idx}`}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-line bg-card shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-lg bg-amber/10 text-amber">
                        {doc.status === "Pending" || doc.status === "pending" ? (
                          <Clock className="size-4" />
                        ) : (
                          <FileWarning className="size-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.type} • {doc.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          doc.status === "Pending" || doc.status === "pending"
                            ? "border-brand/30 bg-brand/10 text-brand"
                            : "border-amber/30 bg-amber/10 text-amber"
                        }`}
                      >
                        {doc.status === "pending" ? "Processing" : doc.status}
                      </span>
                      {doc.status !== "Pending" && doc.status !== "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => handleUploadForType(doc.type)}
                        >
                          Re-upload
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => setDocToDelete(doc)}
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Verified Vault */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-sage flex items-center gap-2">
              <CheckCircle2 className="size-4" /> Verified Credentials Vault
            </h2>
            {loadingInitial ? (
              <div className="p-4 rounded-xl border border-line bg-card text-center text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin inline mr-2" /> Loading vault...
              </div>
            ) : verifiedDocs.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-line bg-card text-center text-sm text-muted-foreground">
                <FolderOpen className="size-8 mx-auto mb-2 text-muted-foreground/60" />
                <p className="font-medium text-foreground">No documents uploaded yet</p>
                <p className="text-xs mt-1">
                  Upload your Aadhaar, Income Certificate, or Residence Proof to build your verified vault.
                </p>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {verifiedDocs.map((doc, idx) => (
                  <div
                    key={`${doc.id || doc.name}-${idx}`}
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
                    <div className="flex items-center gap-1.5">
                      {doc.confidence !== undefined && (
                        <span className="text-xs text-muted-foreground font-medium">
                          {doc.confidence}%
                        </span>
                      )}
                      <span className="inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-2.5 py-0.5 text-xs font-medium text-sage">
                        {doc.status}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => setDocToDelete(doc)}
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column — Upload Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-line bg-card p-6 shadow-sm sticky top-24">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-display font-semibold mb-0.5">
                  {t("documents.upload", "Upload Document")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {phase === "type_select" && "Select the type of document you want to upload."}
                  {phase === "drop_zone" && (chosenType ? `Uploading: ${chosenType}` : "Drop your document to upload.")}
                  {phase === "uploading" && "Securely uploading your document..."}
                  {phase === "queued" && "Vision AI extraction in progress. This will update automatically."}
                  {phase === "extracted" && "AI extraction complete. Review results below."}
                  {phase === "error" && "Something went wrong. Please try again."}
                </p>
              </div>
              {(phase === "drop_zone" || phase === "error") && (
                <button
                  onClick={() => resetUpload(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                  aria-label="Back to type selection"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* TYPE SELECT */}
            {phase === "type_select" && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Choose document type
                </p>
                <div className="grid grid-cols-1 gap-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {DOCUMENT_TYPES.map((dt) => (
                    <button
                      key={dt.id}
                      onClick={() => {
                        setChosenType(dt.id);
                        setPhase("drop_zone");
                      }}
                      className="flex items-center gap-3 w-full text-left px-3.5 py-3 rounded-xl border border-line bg-ice-2/40 hover:border-brand/50 hover:bg-brand/5 transition-all group"
                    >
                      <span className="text-xl leading-none">{dt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-brand transition-colors">
                          {dt.label}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">{dt.desc}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-brand transition-colors shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* DROP ZONE */}
            {phase === "drop_zone" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <button
                    onClick={() => resetUpload(true)}
                    className="hover:text-brand transition-colors"
                  >
                    Document Types
                  </button>
                  <ChevronRight className="size-3" />
                  <span className="text-foreground font-medium">{chosenType || "Unknown"}</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <div
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-brand bg-brand/10 scale-[1.01]"
                      : "border-line hover:bg-brand/5 hover:border-brand/50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <UploadCloud className={`size-10 mb-3 transition-colors ${isDragging ? "text-brand" : "text-muted-foreground/60"}`} />
                  <p className="font-medium text-foreground mb-1 text-sm">
                    Drop your {chosenType} here
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    or click to browse — JPG, PNG, PDF accepted
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  >
                    Choose File
                  </Button>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-ice-2 border border-line text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 text-brand shrink-0 mt-0.5" />
                  <span>
                    Files are encrypted and stored in your private vault. Only you and authorized
                    government officers can access them.
                  </span>
                </div>
              </div>
            )}

            {/* UPLOADING */}
            {phase === "uploading" && (
              <div className="space-y-5 py-2">
                <div className="flex items-center gap-3 text-brand">
                  <Bot className="size-5 animate-bounce" />
                  <span className="text-sm font-medium">Uploading to Secure Vault...</span>
                </div>
                <div className="space-y-3 pl-4 border-l-2 border-brand/30 ml-2">
                  {[
                    "Encrypting file for secure transfer",
                    "Uploading to Supabase Storage",
                    "Registering in your document vault",
                    "Queuing Vision AI extraction",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5 relative">
                      <span className="absolute -left-[21px] grid size-5 place-items-center rounded-full border-2 border-brand bg-brand animate-pulse" />
                      <span className="text-xs text-muted-foreground">{step}</span>
                      <Loader2 className="size-3 animate-spin text-brand ml-auto" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* QUEUED — waiting for realtime */}
            {phase === "queued" && result && (
              <div className="space-y-4 animate-in fade-in">
                <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 flex items-start gap-3">
                  <div className="grid size-8 place-items-center rounded-full bg-brand/15 shrink-0 mt-0.5">
                    <Zap className="size-4 text-brand animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Vision AI Analyzing...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Groq Vision is reading your document. This typically takes 5–30 seconds.
                      This panel will update automatically — no need to refresh.
                    </p>
                  </div>
                </div>

                <div className="bg-ice-2 rounded-xl p-3.5 border border-line space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-line">
                    <div>
                      <p className="text-muted-foreground">Document Type</p>
                      <p className="font-semibold text-foreground">{chosenType || result.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Status</p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                        <Loader2 className="size-2.5 animate-spin" /> Processing
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Document ID:</span>
                    <span className="font-mono font-medium">
                      {result.documentId?.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">File:</span>
                    <span className="font-medium truncate max-w-[150px]">{result.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Eye className="size-3.5" />
                  <span>Subscribed to realtime updates for this document...</span>
                </div>

                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => resetUpload(true)}>
                  Upload another document
                </Button>
              </div>
            )}

            {/* EXTRACTED — real results */}
            {phase === "extracted" && result && (() => {
              const fields = result.extractedFields || {};
              const hasMismatch  = Boolean(fields["type_mismatch"]);
              const hasFailed    = Boolean(fields["extraction_error"]);
              const mismatchMsg  = fields["type_mismatch_detail"] as string | undefined;
              const extractionErr = fields["extraction_error"] as string | undefined;
              const summaryText  = fields["summary"] as string | undefined;
              const conf = result.confidence || 0;

              // Visible fields: exclude internal meta keys, show human labels
              const visibleEntries = Object.entries(fields)
                .filter(([k, v]) => !HIDDEN_EXTRACTED_FIELDS.has(k) && v != null && String(v).trim() !== "")
                .map(([k, v]) => [FIELD_LABELS[k] || k, String(v)] as [string, string]);

              return (
                <div className="space-y-4 animate-in fade-in">
                  {/* Status banner */}
                  {hasFailed ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-coral/40 bg-coral/5 px-4 py-3">
                      <FileWarning className="size-5 text-coral shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-coral">Extraction Failed</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {extractionErr || "Vision AI could not read this document. Try a clearer image."}
                        </p>
                      </div>
                    </div>
                  ) : hasMismatch ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3">
                      <AlertTriangle className="size-5 text-amber shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber">Document Type Mismatch</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {mismatchMsg || "The uploaded document does not match the selected type."}
                        </p>
                      </div>
                    </div>
                  ) : conf >= 70 ? (
                    <div className="flex items-center gap-2.5 rounded-xl border border-sage/40 bg-sage/5 px-4 py-3">
                      <CheckCircle2 className="size-5 text-sage shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-sage">Extraction Complete</p>
                        <p className="text-xs text-muted-foreground">{conf}% confidence</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5 rounded-xl border border-amber/40 bg-amber/5 px-4 py-3">
                      <AlertTriangle className="size-5 text-amber shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber">Needs Human Review</p>
                        <p className="text-xs text-muted-foreground">Low confidence — document sent for officer review.</p>
                      </div>
                    </div>
                  )}

                  {/* Extracted data card */}
                  {!hasFailed && (
                    <div className="bg-ice-2 rounded-xl p-3.5 border border-line space-y-2.5 text-xs">
                      <div className="flex justify-between items-center pb-2 border-b border-line">
                        <div>
                          <p className="text-muted-foreground">Detected Type</p>
                          <p className="font-semibold text-foreground">{result.type || chosenType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Confidence</p>
                          <p className={`font-bold text-base ${conf >= 75 ? "text-sage" : conf >= 40 ? "text-amber" : "text-coral"}`}>
                            {conf}%
                          </p>
                        </div>
                      </div>

                      {summaryText && (
                        <p className="text-muted-foreground italic text-[11px] pb-1 border-b border-line">{summaryText}</p>
                      )}

                      {visibleEntries.length > 0 ? (
                        <div className="space-y-1.5">
                          {visibleEntries.map(([label, value]) => (
                            <div key={label} className="flex justify-between gap-3">
                              <span className="text-muted-foreground shrink-0">{label}:</span>
                              <span className="font-medium text-right break-all">{value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-center py-1">
                          No readable fields found — please upload a clearer image.
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-amber bg-amber/10 p-2 rounded-lg border border-amber/20 flex gap-2">
                    <AlertTriangle className="size-3 flex-shrink-0 mt-0.5" />
                    AI extraction assists review and operates within human oversight guardrails.
                  </p>

                  <Button className="w-full" size="sm" onClick={() => resetUpload(true)}>
                    Upload another document
                  </Button>
                </div>
              );
            })()}

            {/* ERROR */}
            {phase === "error" && (
              <div className="space-y-4 animate-in fade-in">
                <div className="rounded-xl border border-coral/30 bg-coral/10 p-4">
                  <div className="flex items-start gap-2.5">
                    <FileWarning className="size-5 text-coral shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-coral">Upload Failed</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {uploadError || "An unexpected error occurred. Please try again."}
                      </p>
                    </div>
                  </div>
                </div>
                <Button className="w-full" size="sm" onClick={() => resetUpload(false)}>
                  Try Again
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => resetUpload(true)}>
                  Choose different document type
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(docToDelete)} onOpenChange={(open) => !open && !isDeleting && setDocToDelete(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Trash2 className="size-5 text-destructive" />
              {docToDelete?.status === "Verified" || docToDelete?.status === "verified"
                ? "Delete Verified Document"
                : "Delete Document"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {docToDelete?.status === "Verified" || docToDelete?.status === "verified"
                ? `You sure you want to delete this saved verified doc? This will permanently remove "${docToDelete?.name}" (${docToDelete?.type}) from your verified credentials vault.`
                : `You sure you want to delete this under review doc? This will permanently remove "${docToDelete?.name}" (${docToDelete?.type}) from your document vault.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-white font-medium"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" /> Deleting...
                </>
              ) : (
                "Delete Document"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
