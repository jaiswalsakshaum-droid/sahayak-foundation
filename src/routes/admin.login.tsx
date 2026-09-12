import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ShieldAlert,
  LockKeyhole,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Shield,
  KeyRound,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminSignIn } from "@/lib/auth";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Console Sign In — Sahayak" },
      {
        name: "description",
        content:
          "Authorized personnel sign-in for Sahayak Civic AI Workforce and Scheme Administration.",
      },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter administrative credentials.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await adminSignIn(email.trim(), password);
      setIsLoading(false);

      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => {
          navigate({ to: "/admin" });
        }, 500);
      } else {
        setError(res.error || "Access denied: Invalid administrative credentials.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "An authentication error occurred. Please try again.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 selection:bg-brand selection:text-white">
      {/* Subtle Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-brand/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 size-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="relative w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 shadow-xl shadow-black/40">
            <Shield className="size-7 text-brand" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white font-display">
              Sahayak Admin Console
            </h1>
            <p className="text-xs uppercase tracking-[0.18em] font-medium text-slate-400">
              National Civic Workforce & Supervisory System
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-2xl shadow-black/60 text-slate-100 relative overflow-hidden">
          {isSuccess && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand to-emerald-400 animate-pulse" />
          )}

          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <KeyRound className="size-4 text-brand" />
              Authorized Access Only
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Sign in with your department administrator credentials.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-200 animate-in fade-in">
                <ShieldAlert className="size-4 shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isSuccess && (
              <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>Identity verified. Redirecting to supervisory dashboard...</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Administrator Email / ID
                </label>
                <Input
                  type="text"
                  placeholder="admin@gov.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading || isSuccess}
                  required
                  className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-brand focus-visible:border-brand text-sm h-10"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Security Key / Password
                  </label>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || isSuccess}
                    required
                    className="bg-slate-950/80 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-brand focus-visible:border-brand text-sm h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || isSuccess}
                className="w-full h-10 bg-brand hover:bg-brand/90 text-white font-medium text-sm shadow-md shadow-brand/20 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Authenticating Role...
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Authenticated
                  </>
                ) : (
                  <>
                    <LockKeyhole className="size-4" />
                    Sign In to Console
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <Link
                to="/"
                className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="size-3.5" />
                Return to Citizen Portal
              </Link>
              <span className="text-[11px] text-slate-500">RBAC Enforced</span>
            </div>
          </CardContent>
        </Card>

        {/* Security Warning Notice */}
        <p className="text-center text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
          Unauthorized access attempts are audited and logged with IP, timestamp, and device
          fingerprint.
        </p>
      </div>
    </div>
  );
}
