import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  LockKeyhole,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  Shield,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/sahayak";
import { signIn, adminSignIn, getCurrentProfile } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Sahayak" },
      {
        name: "description",
        content: "Sign in to continue your government benefit journey with Sahayak.",
      },
    ],
  }),
  component: LoginPage,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoginPage() {
  const { t } = useTranslation();
  const [roleMode, setRoleMode] = useState<"citizen" | "admin">("citizen");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const isEmailValid = EMAIL_REGEX.test(email.trim());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEmailValid && email.trim() !== "admin" && email.trim() !== "4321") {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      if (roleMode === "admin") {
        // Explicit Admin Login
        const res = await adminSignIn(email.trim(), password);
        setIsLoading(false);
        if (res.success) {
          setIsSuccess(true);
          setTimeout(() => navigate({ to: "/admin" }), 500);
        } else {
          setError(
            res.error ||
              "Access denied: Invalid administrative credentials or account does not have admin permissions.",
          );
        }
      } else {
        // Standard Citizen Login (with auto-detect for admin role)
        const res = await signIn(email.trim(), password);
        if (res.success) {
          const profile = await getCurrentProfile();
          setIsLoading(false);
          setIsSuccess(true);
          // If profile is admin, route directly to /admin
          if (profile?.role === "admin") {
            setTimeout(() => navigate({ to: "/admin" }), 500);
          } else {
            setTimeout(() => navigate({ to: "/dashboard" }), 500);
          }
        } else {
          setIsLoading(false);
          setError(res.error || "Invalid credentials. Please check your email and password.");
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <AuthLayout
      title={
        roleMode === "admin"
          ? "Sahayak Admin Console"
          : t("auth.signInTitle", "Welcome back to Sahayak")
      }
      description={
        roleMode === "admin"
          ? "Authorized supervisory portal for scheme rules and AI workforce management"
          : t(
              "auth.signInSubtitle",
              "Log in to your citizen portal to track applications and discover schemes.",
            )
      }
    >
      <Card className="border-line bg-card shadow-sm relative overflow-hidden">
        {isSuccess && (
          <div
            className={`absolute top-0 left-0 w-full h-1 ${
              roleMode === "admin" ? "bg-brand animate-pulse" : "bg-sage"
            }`}
          />
        )}
        <CardHeader className="pb-3">
          {/* Role Toggle Selector */}
          <div className="grid grid-cols-2 p-1 bg-ice rounded-xl border border-line mb-3">
            <button
              type="button"
              onClick={() => {
                setRoleMode("citizen");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                roleMode === "citizen"
                  ? "bg-card text-foreground shadow-sm border border-line"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="size-3.5" />
              Citizen Login
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleMode("admin");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                roleMode === "admin"
                  ? "bg-slate-900 text-white shadow-sm border border-slate-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="size-3.5 text-brand" />
              Admin Console
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`grid size-10 place-items-center rounded-lg ${
                roleMode === "admin"
                  ? "bg-slate-900 text-brand border border-slate-700"
                  : "bg-brand/10 text-brand"
              }`}
            >
              {roleMode === "admin" ? <KeyRound className="size-5" /> : <LockKeyhole className="size-5" />}
            </div>
            <div>
              <CardTitle className="font-display text-xl">
                {roleMode === "admin" ? "Admin Sign In" : t("auth.signInButton", "Citizen Sign In")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {roleMode === "admin"
                  ? "Supervisory & workforce credentials"
                  : "Access your citizen benefits workspace"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm font-medium">
              {roleMode === "admin" ? "Administrator Email" : t("auth.emailLabel", "Email address")}
              <Input
                className="mt-1.5 bg-card"
                type="text"
                placeholder={roleMode === "admin" ? "admin@sahayak.gov.in" : "youremail@gmail.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isSuccess}
                required
              />
            </label>

            <label className="block text-sm font-medium">
              <div className="flex items-center justify-between">
                <span>{t("auth.passwordLabel", "Password")}</span>
                {roleMode === "citizen" && (
                  <Link
                    to="/reset-password"
                    className="text-xs font-normal text-brand hover:underline"
                  >
                    {t("auth.forgotPassword", "Forgot password?")}
                  </Link>
                )}
              </div>
              <div className="relative mt-1.5">
                <Input
                  className="bg-card pr-10"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading || isSuccess}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900">
                <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {isSuccess ? (
              <Button
                type="button"
                className={`w-full text-white cursor-default ${
                  roleMode === "admin" ? "bg-slate-900" : "bg-sage hover:bg-sage"
                }`}
              >
                <CheckCircle2 className="mr-2 size-4" />
                {roleMode === "admin" ? "Admin Access Granted" : "Success"}
              </Button>
            ) : (
              <Button
                type="submit"
                className={`w-full ${
                  roleMode === "admin" ? "bg-slate-900 hover:bg-slate-800 text-white" : ""
                }`}
                disabled={isLoading || !email || !password}
              >
                {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {isLoading
                  ? roleMode === "admin"
                    ? "Verifying Permissions..."
                    : t("common.loading", "Signing in...")
                  : roleMode === "admin"
                  ? "Sign In to Admin Console"
                  : t("auth.signInButton", "Sign In")}
                {!isLoading && <ArrowRight className="ml-2 size-4" />}
              </Button>
            )}
          </form>

          {roleMode === "citizen" ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {t("auth.noAccount", "Don't have an account?")}{" "}
              <Link to="/signup" className="font-medium text-brand hover:underline">
                {t("auth.signUpButton", "Create Account")}
              </Link>
            </p>
          ) : (
            <p className="mt-5 text-center text-xs text-muted-foreground">
              Demo Admin Credentials: <strong className="text-foreground">admin@sahayak.gov.in</strong> /{" "}
              <strong className="text-foreground">Admin@12345</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-ice-2 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="font-display text-lg font-semibold">Sahayak</span>
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your sensitive decisions stay yours.
        </p>
      </div>
    </div>
  );
}
