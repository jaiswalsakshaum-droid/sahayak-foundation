import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/sahayak";

import { signIn } from "@/lib/auth";

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

function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await signIn(email, password);
      setIsLoading(false);
      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => navigate({ to: "/dashboard" }), 600);
      } else {
        setError(res.error || "Invalid credentials. Try 4321 / 1234");
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <AuthLayout
      title={t("auth.signInTitle", "Welcome back to Sahayak")}
      description={t(
        "auth.signInSubtitle",
        "Log in to your citizen portal or administrative dashboard",
      )}
    >
      <Card className="border-line bg-card shadow-sm relative overflow-hidden">
        {isSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-sage" />}
        <CardHeader>
          <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle className="mt-4 font-display text-2xl">
            {t("auth.signInButton", "Sign In")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("auth.signInSubtitle", "Access your civic assistant workspace.")}
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm font-medium">
              {t("auth.phoneLabel", "Mobile number or email")}
              <Input
                className="mt-2 bg-card"
                placeholder="4321"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading || isSuccess}
              />
            </label>
            <label className="block text-sm font-medium">
              {t("auth.passwordLabel", "Password")}
              <Input
                className="mt-2 bg-card"
                type="password"
                placeholder="1234"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isSuccess}
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 p-2 rounded border border-amber-200">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}

            {isSuccess ? (
              <Button
                type="button"
                className="w-full bg-sage hover:bg-sage text-white cursor-default"
              >
                <CheckCircle2 className="mr-2 size-4" /> Success
              </Button>
            ) : (
              <Button type="submit" className="w-full" disabled={isLoading || !email || !password}>
                {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {isLoading
                  ? t("common.loading", "Signing in...")
                  : t("auth.signInButton", "Sign In")}
                {!isLoading && <ArrowRight className="ml-2 size-4" />}
              </Button>
            )}
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {t("auth.noAccount", "Don't have an account?")}{" "}
            <Link to="/signup" className="font-medium text-brand hover:underline">
              {t("auth.signUpButton", "Create Account")}
            </Link>
          </p>
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
