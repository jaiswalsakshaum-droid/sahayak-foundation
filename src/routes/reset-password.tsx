import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, KeyRound, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/sahayak";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Sahayak" },
      {
        name: "description",
        content: "Reset your Sahayak account password.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ResetPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isEmailValid = EMAIL_REGEX.test(email.trim());

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setIsLoading(false);
        setIsSubmitted(true);
      }, 500);
      return;
    }

    try {
      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/update-password`
          : "http://localhost:5173/update-password";

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      setIsLoading(false);

      if (resetError) {
        setError(resetError.message || "Failed to send reset link.");
      } else {
        setIsSubmitted(true);
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "An unexpected error occurred.");
    }
  };

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
          <h1 className="font-display text-3xl font-semibold">Reset Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email to receive recovery instructions.
          </p>
        </div>

        <Card className="border-line bg-card shadow-sm relative overflow-hidden">
          <CardHeader>
            <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
              <KeyRound className="size-5" />
            </div>
            <CardTitle className="mt-4 font-display text-2xl">Password Recovery</CardTitle>
            <p className="text-sm text-muted-foreground">
              We will send a password reset link to your registered email.
            </p>
          </CardHeader>
          <CardContent>
            {isSubmitted ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm text-emerald-800 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-emerald-900">Recovery link dispatched</p>
                    <p className="mt-1 text-emerald-700">
                      If an account exists for <span className="font-medium">{email}</span>, a
                      password reset link has been sent. Please check your inbox.
                    </p>
                  </div>
                </div>
                <Link to="/login">
                  <Button variant="outline" className="w-full mt-2">
                    <ArrowLeft className="mr-2 size-4" /> Back to Sign In
                  </Button>
                </Link>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleReset}>
                <label className="block text-sm font-medium">
                  {t("auth.emailLabel", "Email address")}
                  <Input
                    className="mt-1.5 bg-card"
                    type="email"
                    placeholder="youremail@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  {email.length > 0 && !isEmailValid && (
                    <p className="text-xs text-amber-600 mt-1">Enter a valid email address.</p>
                  )}
                </label>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 p-2.5 rounded border border-amber-200">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !isEmailValid}>
                  {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {isLoading ? "Sending link..." : "Send Reset Link"}
                  {!isLoading && <ArrowRight className="ml-2 size-4" />}
                </Button>

                <p className="text-center text-sm text-muted-foreground pt-2">
                  <Link
                    to="/login"
                    className="font-medium text-brand hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="size-3.5" /> Back to Sign In
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
