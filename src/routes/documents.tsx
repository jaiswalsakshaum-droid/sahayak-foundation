import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, FileWarning, Bot, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateDocument, type DocumentValidationResult } from "@/lib/services";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
});

const DEMO_DOCUMENTS = [
  { name: "Aadhaar Card", type: "Identity Proof", status: "Verified", date: "Today" },
  { name: "Income Certificate", type: "Income Proof", status: "Verified", date: "Yesterday" },
  { name: "Bank Passbook", type: "Financial", status: "Needs Review", date: "2 days ago" },
  { name: "PAN Card", type: "Identity Proof", status: "Expired", date: "Expired on 01-Jan-2025" },
  { name: "Address Proof", type: "Residence", status: "Verified", date: "Last month" },
  { name: "Enrollment Certificate", type: "Education", status: "Missing", date: "Required for application" },
];

function DocumentsPage() {
  const [uploadState, setUploadState] = useState<"idle" | "processing" | "complete">("idle");
  const [processStep, setProcessStep] = useState(-1);
  const [result, setResult] = useState<DocumentValidationResult | null>(null);

  const processingSteps = [
    "Upload received",
    "Document classified",
    "OCR completed",
    "Fields extracted",
    "Identity information compared",
    "Validity checked",
    "Evidence updated"
  ];

  const handleUpload = async () => {
    setUploadState("processing");
    setProcessStep(0);
    
    for (let i = 0; i < processingSteps.length; i++) {
      await new Promise(r => setTimeout(r, 600));
      setProcessStep(i);
    }
    
    const docResult = await validateDocument("dummy");
    setResult(docResult);
    setUploadState("complete");
  };

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-ice-2/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-5">
           <Link to="/" className="flex items-center gap-2 mr-6 text-foreground hover:text-brand">
             <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">S</span>
             <span className="font-display font-semibold hidden sm:block">Sahayak</span>
           </Link>
           <nav className="flex items-center gap-6 text-sm font-medium">
             <Link to="/assistant" className="text-muted-foreground hover:text-foreground">Assistant</Link>
             <Link to="/schemes" className="text-muted-foreground hover:text-foreground">Schemes</Link>
             <Link to="/documents" className="text-foreground">Documents</Link>
             <Link to="/applications" className="text-muted-foreground hover:text-foreground">Applications</Link>
           </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-5 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
         <div className="lg:col-span-7 space-y-8">
            <div>
              <h1 className="text-3xl font-display font-semibold mb-2">Document Center</h1>
              <p className="text-muted-foreground">Manage your verifiable credentials and evidence.</p>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-amber">
                <AlertTriangle className="size-5" /> Needs Attention
              </h2>
              <div className="grid gap-3">
                {DEMO_DOCUMENTS.filter(d => ["Missing", "Needs Review", "Expired"].includes(d.status)).map(doc => (
                  <div key={doc.name} className="flex items-center justify-between p-4 rounded-xl border border-line bg-card shadow-sm">
                    <div className="flex items-center gap-4">
                       <span className="grid size-10 place-items-center rounded-lg bg-amber/10 text-amber">
                         <FileWarning className="size-5" />
                       </span>
                       <div>
                         <p className="font-medium">{doc.name}</p>
                         <p className="text-xs text-muted-foreground">{doc.type} • {doc.date}</p>
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
                {DEMO_DOCUMENTS.filter(d => d.status === "Verified").map(doc => (
                  <div key={doc.name} className="flex items-center justify-between p-4 rounded-xl border border-line bg-card shadow-sm">
                    <div className="flex items-center gap-4">
                       <span className="grid size-10 place-items-center rounded-lg bg-sage/10 text-sage">
                         <FileText className="size-5" />
                       </span>
                       <div>
                         <p className="font-medium">{doc.name}</p>
                         <p className="text-xs text-muted-foreground">{doc.type} • {doc.date}</p>
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
                  onClick={handleUpload}
                >
                  <UploadCloud className="size-10 text-muted-foreground mb-4" />
                  <p className="font-medium text-foreground mb-1">Drop document here</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse files</p>
                  <Button variant="outline" size="sm">Choose file</Button>
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
                           <span className={`absolute -left-[21px] grid size-5 place-items-center rounded-full border-2 ${isComplete ? 'bg-sage border-sage' : 'bg-brand border-brand animate-pulse'}`}>
                             {isComplete && <CheckCircle2 className="size-3 text-white" />}
                           </span>
                           <span className={`text-sm ${isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                             {step}
                           </span>
                           {isCurrent && <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />}
                        </div>
                      )
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
                    AI validation assists review and does not constitute official document verification.
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
