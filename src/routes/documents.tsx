import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  FileWarning,
  Bot,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateDocument, type DocumentValidationResult } from "@/lib/services";
import { requireAuth, getSession } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/documents")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: DocumentsPage,
});

type DocumentItem = {
  name: string;
  type: string;
  status: string;
  date: string;
};

const DEMO_DOCUMENTS: DocumentItem[] = [
  { name: "Aadhaar Card", type: "Identity Proof", status: "Verified", date: "Today" },
  { name: "Income Certificate", type: "Income Proof", status: "Verified", date: "Yesterday" },
  { name: "Bank Passbook", type: "Financial", status: "Needs Review", date: "2 days ago" },
  { name: "PAN Card", type: "Identity Proof", status: "Expired", date: "Expired on 01-Jan-2025" },
  { name: "Address Proof", type: "Residence", status: "Verified", date: "Last month" },
  {
    name: "Enrollment Certificate",
    type: "Education",
    status: "Missing",
    date: "Required for application",
  },
];

function DocumentsPage() {
  const [uploadState, setUploadState] = useState<"idle" | "processing" | "complete">("idle");
  const [processStep, setProcessStep] = useState(-1);
  const [result, setResult] = useState<DocumentValidationResult | null>(null);
  const [documentsList, setDocumentsList] = useState<DocumentItem[]>(DEMO_DOCUMENTS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch real user documents from Supabase on mount
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;

    async function loadUserDocuments() {
      try {
        const session = await getSession();
        if (!session?.user?.id) return;

        const { data, error } = await supabase
          .from("documents")
          .select("*")
          .eq("citizen_id", session.user.id)
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0 && active) {
          const mapped: DocumentItem[] = data.map((doc: any) => ({
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

  // Subscribe to real-time updates on the uploaded document to replace placeholders when extraction finishes
  useEffect(() => {
    if (!result?.documentId || !isSupabaseConfigured) return;

    const docId = result.documentId;
    const channel = supabase
      .channel(`doc-updates-${docId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "documents",
          filter: `id=eq.${docId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated && updated.extracted_fields && Object.keys(updated.extracted_fields).length > 0) {
            setResult((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                confidence: Math.round((updated.confidence || 0.95) * 100),
                extractedFields: updated.extracted_fields,
                status: updated.status || "verified",
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [result?.documentId]);

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
      await new Promise((r) => setTimeout(r, 450));
      setProcessStep(i);
    }

    const docResult = await validateDocument(file);
    setResult(docResult);
    setUploadState("complete");
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
          <Link to="/" className="flex items-center gap-2 mr-6 text-foreground hover:text-brand">
            <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="font-display font-semibold hidden sm:block">Sahayak</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link to="/assistant" className="text-muted-foreground hover:text-foreground">
              Assistant
            </Link>
            <Link to="/schemes" className="text-muted-foreground hover:text-foreground">
              Schemes
            </Link>
            <Link to="/documents" className="text-foreground">
              Documents
            </Link>
            <Link to="/applications" className="text-muted-foreground hover:text-foreground">
              Applications
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-3xl font-display font-semibold mb-2">Document Center</h1>
            <p className="text-muted-foreground">
              Manage your verifiable credentials and evidence.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-amber">
              <AlertTriangle className="size-5" /> Needs Attention
            </h2>
            <div className="grid gap-3">
              {documentsList.filter((d) =>
                ["Missing", "Needs Review", "Expired", "Pending", "pending", "needs_review", "missing"].includes(d.status),
              ).map((doc) => (
                <div
                  key={doc.name}
                  className="flex items-center justify-between p-4 rounded-xl border border-line bg-card shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid size-10 place-items-center rounded-lg bg-amber/10 text-amber">
                      <FileWarning className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type} • {doc.date}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-xs font-medium text-amber">
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-sage">
              <CheckCircle2 className="size-5" /> Verified Evidence
            </h2>
            <div className="grid gap-3">
              {documentsList.filter((d) => ["Verified", "verified"].includes(d.status)).map((doc) => (
                <div
                  key={doc.name}
                  className="flex items-center justify-between p-4 rounded-xl border border-line bg-card shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <span className="grid size-10 place-items-center rounded-lg bg-sage/10 text-sage">
                      <FileText className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.type} • {doc.date}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="inline-flex items-center rounded-full border border-sage/30 bg-sage/10 px-2.5 py-0.5 text-xs font-medium text-sage">
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-line bg-card p-6 shadow-sm sticky top-24">
            <h2 className="text-xl font-display font-semibold mb-4">Upload Document</h2>

            {uploadState === "idle" && (
              <div
                className="border-2 border-dashed border-line rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-brand/5 hover:border-brand/50 transition-colors"
                onClick={handleUploadClick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <UploadCloud className="size-10 text-muted-foreground mb-4" />
                <p className="font-medium text-foreground mb-1">Drop document here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse files (Images or PDF)</p>
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}>
                  Choose file
                </Button>
              </div>
            )}

            {uploadState === "processing" && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-brand">
                  <Bot className="size-6 animate-bounce" />
                  <span className="font-medium">Document Agent Processing...</span>
                </div>

                <div className="space-y-3 relative pl-4 border-l-2 border-line ml-2">
                  {processingSteps.map((step, idx) => {
                    const isComplete = processStep > idx;
                    const isCurrent = processStep === idx;
                    if (processStep < idx) return null;

                    return (
                      <div key={idx} className="relative flex items-center gap-3">
                        <span
                          className={`absolute -left-[21px] grid size-5 place-items-center rounded-full border-2 ${isComplete ? "bg-sage border-sage" : "bg-brand border-brand animate-pulse"}`}
                        >
                          {isComplete && <CheckCircle2 className="size-3 text-white" />}
                        </span>
                        <span
                          className={`text-sm ${isCurrent ? "text-foreground font-medium" : "text-muted-foreground"}`}
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
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 text-sage">
                  <CheckCircle2 className="size-6" />
                  <span className="font-medium">Verification Complete</span>
                </div>

                <div className="bg-ice-2 rounded-lg p-4 text-sm border border-line">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-line">
                    <div>
                      <p className="text-muted-foreground mb-1">Document Type</p>
                      <p className="font-medium">{result.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground mb-1">Confidence</p>
                      <p className="font-bold text-sage">{result.confidence}%</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(result.extractedFields).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground bg-amber/10 text-amber p-2 rounded border border-amber/20 flex gap-2">
                  <AlertTriangle className="size-3 flex-shrink-0 mt-0.5" />
                  AI validation assists review and does not constitute official document
                  verification.
                </p>

                <Button className="w-full" onClick={() => setUploadState("idle")}>
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
