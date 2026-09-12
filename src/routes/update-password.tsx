import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  LockKeyhole,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/sahayak";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/update-password")({
  head: () => ({
    meta: [
      { title: "Update your password — Sahayak" },
      {
        name: "description",
        content: "Set a new password for your Sahayak account.",
      },
    ],
  }),
  component: UpdatePasswordPage,
});

function UpdatePasswordPage() {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword;
  const isFormValid = isPasswordLongEnough && doPasswordsMatch && confirmPassword.length > 0;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isPasswordLongEnough) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!doPasswordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true);
        setTimeout(() => navigate({ to: "/dashboard" }), 1200);
      }, 500);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      setIsLoading(false);

      if (updateError) {
        setError(updateError.message || "Failed to update password.");
      } else {
        setIsSuccess(true);
        setTimeout(() => navigate({ to: "/dashboard" }), 1200);
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
          <h1 className="font-display text-3xl font-semibold">Update Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a strong new password for your account.
          </p>
        </div>

        <Card className="border-line bg-card shadow-sm relative overflow-hidden">
          {isSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-sage" />}
          <CardHeader>
            <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
              <LockKeyhole className="size-5" />
            </div>
            <CardTitle className="mt-4 font-display text-2xl">Set New Password</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter and confirm your new account password.
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpdate}>
              <label className="block text-sm font-medium">
                New Password
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
                <p className="text-xs text-muted-foreground mt-1">At least 8 characters</p>
              </label>

              <label className="block text-sm font-medium">
                {t("auth.confirmPasswordLabel", "Confirm password")}
                <Input
                  className="mt-1.5 bg-card"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading || isSuccess}
                  required
                />
                {confirmPassword.length > 0 && !doPasswordsMatch && (
                  <p className="text-xs text-amber-600 mt-1">Passwords don't match.</p>
                )}
              </label>

              {error && (
                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 p-2.5 rounded border border-amber-200">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {isSuccess ? (
                <Button
                  type="button"
                  className="w-full bg-sage hover:bg-sage text-white cursor-default"
                >
                  <CheckCircle2 className="mr-2 size-4" /> Password updated! Redirecting...
                </Button>
              ) : (
                <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
                  {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {isLoading ? "Updating password..." : "Update Password"}
                  {!isLoading && <ArrowRight className="ml-2 size-4" />}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
