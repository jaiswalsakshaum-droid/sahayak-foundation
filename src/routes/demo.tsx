import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { 
  ArrowRight, Check, Play, Sparkles, Bot, ShieldCheck, SearchCheck, 
  ClipboardCheck, FileCheck2, FileText, Landmark, UploadCloud, Loader2,
  AlertTriangle, Square, CheckSquare, Activity, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/demo")({
  component: DemoPage,
});

function DemoPage() {
  const [step, setStep] = useState(-1); // -1: Not started, 0: Citizen Loaded, 1-20: Steps
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadDemoCitizen = () => {
    setStep(0);
  };

  const runDemo = () => {
    setStep(1);
    setIsPaused(false);
  };

  useEffect(() => {
    if (step >= 1 && step < 20 && !isPaused) {
      const timers = [
        3000, 2000, 2000, 3000, 2000, 3000, 2000, 2000, 3000, 3000, // 1-10
        2000, 3000, 2000, 2000, Infinity, 4000, 2000, 2000, 2000, 2000 // 11-20 (Wait at 15 for approval)
      ];
      
      const delay = timers[step - 1];
      if (delay === Infinity) return;
      
      const t = setTimeout(() => {
        setStep(s => s + 1);
      }, delay);
      
      return () => clearTimeout(t);
    }
  }, [step, isPaused]);

  useEffect(() => {
    if (containerRef.current && step > 0) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [step]);

  return (
    <div className="min-h-screen bg-ice-2 text-foreground flex flex-col h-screen overflow-hidden">
      <header className="shrink-0 border-b border-line bg-card z-10 relative shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
           <Link to="/" className="flex items-center gap-2 mr-6 text-foreground hover:text-brand">
             <span className="grid size-8 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">S</span>
             <span className="font-display font-semibold hidden sm:block">Sahayak</span>
           </Link>
           
           <div className="flex-1 max-w-xl mx-8">
             {step >= 1 && (
               <div className="flex flex-col gap-1">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                   <span>Autonomous Orchestration</span>
                   <span>Step {step} of 20</span>
                 </div>
                 <div className="h-1.5 bg-ice-2 rounded-full overflow-hidden border border-line">
                   <div 
                     className="h-full bg-brand transition-all duration-500 ease-in-out"
                     style={{ width: `${(step / 20) * 100}%` }}
                   />
                 </div>
               </div>
             )}
           </div>

           <nav className="flex items-center gap-3">
             <Button variant="ghost" size="sm" onClick={() => setStep(-1)}>Reset</Button>
           </nav>
        </div>
      </header>

      <main ref={containerRef} className="flex-1 overflow-y-auto px-5 py-8 pb-32">
        <div className="mx-auto max-w-3xl space-y-6">
          
          {step === -1 && (
            <div className="text-center py-20 animate-in fade-in zoom-in duration-500">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-bold uppercase tracking-wider mb-6">
                <Sparkles className="size-3.5" /> Hackathon Demo Ready
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6">Experience the AI Workforce</h1>
              <p className="text-lg text-muted-foreground mb-12 max-w-xl mx-auto">
                Watch 6 specialized agents orchestrate the entire journey from citizen need to secure government submission in under 60 seconds.
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button size="lg" variant="outline" className="h-14 px-8 text-base" onClick={loadDemoCitizen}>
                  Load Demo Citizen
                </Button>
                <Button size="lg" className="h-14 px-8 text-base shadow-lg shadow-brand/20" onClick={runDemo} disabled>
                  Run Complete Sahayak Demo <Play className="ml-2 size-5 fill-current" />
                </Button>
              </div>
            </div>
          )}

          {step === 0 && (
            <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-8">
              <div className="bg-card border border-line rounded-xl p-8 max-w-md mx-auto shadow-sm text-left mb-8">
                <h3 className="font-semibold text-lg border-b border-line pb-3 mb-4 flex items-center justify-between">
                  Citizen Context Loaded
                  <Check className="size-5 text-sage" />
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">Rahul Sharma</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Age</span><span className="font-medium">20</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Location</span><span className="font-medium">Lucknow, UP</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Occupation</span><span className="font-medium">Undergraduate Student</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Household Income</span><span className="font-medium">₹2,10,000</span></div>
                </div>
              </div>
              
              <Button size="lg" className="h-14 px-8 text-base shadow-lg shadow-brand/20 animate-pulse" onClick={runDemo}>
                Run Complete Sahayak Demo <Play className="ml-2 size-5 fill-current" />
              </Button>
            </div>
          )}

          <div className="space-y-8 flex flex-col">
            
            {step >= 1 && (
              <UserMessage>
                "Mere ghar ki income kam hai aur main college mein padh raha hoon. Koi scholarship mil sakti hai?"
              </UserMessage>
            )}

            {step >= 2 && (
              <AgentAction agent="Citizen Agent" icon={ShieldCheck} status="PROCESSING">
                Citizen Agent is analyzing natural language intent and matching with demographic profile...
              </AgentAction>
            )}

            {step >= 3 && (
              <AgentAction agent="Citizen Agent" icon={ShieldCheck} status="COMPLETED">
                <div className="bg-card p-3 rounded-lg border border-line text-sm mt-2">
                  <span className="font-semibold block mb-1">Intent Identified:</span>
                  Education financial assistance / Undergraduate Scholarship
                </div>
              </AgentAction>
            )}

            {step >= 4 && (
              <AgentAction agent="Scheme Agent" icon={SearchCheck} status="PROCESSING">
                Querying structured Knowledge Base for relevant Central and UP State schemes...
              </AgentAction>
            )}

            {step >= 5 && (
              <AgentAction agent="Scheme Agent" icon={SearchCheck} status="COMPLETED">
                <div className="grid gap-2 mt-2">
                  <div className="p-3 border-2 border-brand bg-brand/5 rounded-lg text-sm flex justify-between items-center shadow-sm">
                    <span className="font-semibold text-brand">National Means-cum-Merit Scholarship</span>
                    <span className="font-bold">92% Match</span>
                  </div>
                  <div className="p-2 border border-line bg-card rounded-lg text-sm opacity-60">UP Post Matric Scholarship (78% Match)</div>
                  <div className="p-2 border border-line bg-card rounded-lg text-sm opacity-60">PM YASASVI (65% Match)</div>
                </div>
              </AgentAction>
            )}

            {step >= 6 && (
              <AgentAction agent="Eligibility Agent" icon={ClipboardCheck} status="PROCESSING">
                Evaluating structured rules against citizen profile (Rahul, Age 20, Income ₹2.1L)...
              </AgentAction>
            )}

            {step >= 7 && (
              <AgentAction agent="Eligibility Agent" icon={ClipboardCheck} status="COMPLETED">
                <div className="mt-2 space-y-2 text-sm bg-card p-3 rounded-lg border border-line">
                   <div className="flex items-center gap-2"><Check className="size-4 text-sage" /> Age 18-25: Verified (Citizen Profile)</div>
                   <div className="flex items-center gap-2"><Check className="size-4 text-sage" /> Income ≤ 3L: Verified (Profile)</div>
                   <div className="flex items-center gap-2 font-medium text-amber"><AlertTriangle className="size-4" /> Enrollment Status: Missing Evidence</div>
                </div>
              </AgentAction>
            )}

            {step >= 8 && (
              <AgentAction agent="Document Agent" icon={FileCheck2} status="ACTION REQUIRED" attention>
                <div className="mt-2 p-4 bg-amber/10 border border-amber/20 rounded-xl">
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                    <FileText className="size-4" /> Action Required
                  </h4>
                  <p className="text-sm text-amber-900 mb-3">Please upload an Enrollment Certificate to prove student status.</p>
                  {step === 8 && <div className="text-xs text-muted-foreground animate-pulse">Waiting for upload simulation...</div>}
                </div>
              </AgentAction>
            )}

            {step >= 9 && (
              <div className="flex justify-end animate-in slide-in-from-right-8">
                <div className="bg-card border-2 border-dashed border-line p-6 rounded-xl max-w-sm w-full text-center">
                  <UploadCloud className="size-8 text-brand mx-auto mb-2" />
                  <p className="text-sm font-medium">enrollment_cert_rahul.pdf</p>
                  <p className="text-xs text-muted-foreground mt-1">Uploaded successfully</p>
                </div>
              </div>
            )}

            {step >= 10 && (
              <AgentAction agent="Document Agent" icon={FileCheck2} status="PROCESSING">
                Extracting fields via OCR and cross-referencing identity...
              </AgentAction>
            )}

            {step >= 11 && (
              <AgentAction agent="Eligibility Agent" icon={ClipboardCheck} status="COMPLETED">
                <div className="mt-2 space-y-2 text-sm bg-sage/10 p-3 rounded-lg border border-sage/20 text-sage-800">
                   <div className="flex items-center gap-2 font-medium"><Check className="size-4" /> Enrollment Status: Verified via Certificate (98% confidence)</div>
                   <div className="font-bold text-base mt-2 flex items-center gap-2"><Check className="size-5" /> 100% Eligible</div>
                </div>
              </AgentAction>
            )}

            {step >= 12 && (
              <AgentAction agent="Application Agent" icon={FileText} status="PROCESSING">
                Mapping verified profile data and linking cryptographic proofs to scheme requirements...
              </AgentAction>
            )}

            {step >= 13 && (
              <AgentAction agent="Application Agent" icon={FileText} status="COMPLETED">
                Draft application SAH-2026-004281 generated successfully.
              </AgentAction>
            )}

            {step >= 14 && (
              <div className="mx-auto w-full max-w-lg mt-6 animate-in slide-in-from-bottom-8">
                <div className="bg-card rounded-xl border-2 border-brand/50 shadow-lg p-6 relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-brand" />
                   
                   <div className="flex items-center gap-3 mb-4">
                     <ShieldCheck className="size-6 text-brand" />
                     <h2 className="text-xl font-display font-semibold">Your approval is required</h2>
                   </div>
                   
                   <p className="text-muted-foreground text-sm mb-6">
                     Sahayak has prepared this application using information you provided and documents you approved. Nothing will be submitted or shared without your permission.
                   </p>

                   <div className="space-y-3 mb-8">
                     <label className="flex items-start gap-3 p-3 rounded-lg bg-ice-2 border border-line">
                       <CheckSquare className="mt-0.5 shrink-0 text-brand size-5" />
                       <span className="text-sm font-medium text-foreground">I have reviewed my information and confirm it is accurate.</span>
                     </label>
                     <label className="flex items-start gap-3 p-3 rounded-lg bg-ice-2 border border-line">
                       <CheckSquare className="mt-0.5 shrink-0 text-brand size-5" />
                       <span className="text-sm font-medium text-foreground">I approve sharing attached documents with the department.</span>
                     </label>
                     <label className="flex items-start gap-3 p-3 rounded-lg bg-ice-2 border border-line">
                       <CheckSquare className="mt-0.5 shrink-0 text-brand size-5" />
                       <span className="text-sm font-medium text-foreground">I approve this application for final submission.</span>
                     </label>
                   </div>

                   {step === 14 ? (
                     <Button className="w-full h-12 text-base animate-pulse shadow-lg shadow-brand/20" onClick={() => setStep(15)}>
                       Simulate Citizen Approval
                     </Button>
                   ) : (
                     <Button className="w-full h-12 text-base bg-sage hover:bg-sage text-white shadow-none pointer-events-none">
                       <Check className="mr-2 size-5" /> Approved
                     </Button>
                   )}
                </div>
              </div>
            )}

            {step >= 16 && (
              <AgentAction agent="Application Agent" icon={FileText} status="PROCESSING">
                Securely transmitting payload to Demo Government Portal API...
              </AgentAction>
            )}

            {step >= 17 && (
              <div className="flex justify-center animate-in zoom-in mt-4">
                <div className="bg-sage/10 text-sage-800 border border-sage/20 p-4 rounded-xl text-center max-w-sm w-full">
                  <Check className="size-8 mx-auto mb-2 text-sage" />
                  <h3 className="font-semibold text-lg mb-1">Submission Successful</h3>
                  <p className="text-sm">Tracking ID: SAH-2026-004281</p>
                </div>
              </div>
            )}

            {step >= 18 && (
              <AgentAction agent="Tracker Agent" icon={Landmark} status="PROCESSING">
                Establishing webhook listener for department status updates...
              </AgentAction>
            )}

            {step >= 19 && (
              <AgentAction agent="Tracker Agent" icon={Landmark} status="COMPLETED">
                Current Status: Under Department Review
              </AgentAction>
            )}

            {step >= 20 && (
              <div className="mt-12 text-center animate-in fade-in zoom-in duration-1000">
                <h2 className="text-3xl font-display font-bold mb-4">Workflow Complete 🎉</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  From unstructured need to official submission, safely orchestrated by Sahayak's AI Workforce.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button variant="outline" size="lg" onClick={() => setStep(-1)}>Restart Demo</Button>
                  <Link to="/admin/agents">
                    <Button size="lg">Explore Agent Admin <ArrowRight className="ml-2 size-5" /></Button>
                  </Link>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

function UserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-in slide-in-from-right-4 duration-300">
      <div className="bg-brand text-primary-foreground p-4 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm">
        <p className="text-[15px]">{children}</p>
      </div>
    </div>
  );
}

function AgentAction({ agent, icon: Icon, status, attention = false, children }: { agent: string, icon: any, status: "PROCESSING" | "COMPLETED" | "ACTION REQUIRED", attention?: boolean, children: React.ReactNode }) {
  return (
    <div className="flex gap-4 animate-in slide-in-from-left-4 duration-300">
      <div className={`grid size-10 shrink-0 place-items-center rounded-full mt-1 border-2 ${status === 'PROCESSING' ? 'bg-brand/10 text-brand border-brand/20 animate-pulse' : attention ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-ice-2 text-foreground border-line shadow-sm'}`}>
        <Icon className="size-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm">{agent}</span>
          {status === 'PROCESSING' && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          {status === 'COMPLETED' && <Check className="size-3 text-sage" />}
        </div>
        <div className={`text-sm ${status === 'PROCESSING' ? 'text-muted-foreground' : 'text-foreground'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}