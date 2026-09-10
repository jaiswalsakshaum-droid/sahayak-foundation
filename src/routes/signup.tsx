import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/sahayak";

import { signUp } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — Sahayak" },
      {
        name: "description",
        content: "Create a Sahayak account to organize your government benefit journey.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const email = mobile.includes("@")
        ? mobile
        : `${mobile.replace(/[^0-9]/g, "")}@sahayak.local`;
      const res = await signUp(email, password, name, mobile);
      setIsLoading(false);

      if (res.success) {
        setIsSuccess(true);
        setTimeout(() => navigate({ to: "/dashboard" }), 800);
      } else {
        setError(res.error || "Failed to create account.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ice-2 px-5 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
              S
            </span>
            <span className="font-display text-lg font-semibold">Sahayak</span>
          </Link>
          <LanguageSwitcher />
        </div>
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden rounded-xl bg-brand p-7 text-primary-foreground md:block">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/60">
              A better starting point
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold">
              Your benefits journey, organized.
            </h1>
            <ul className="mt-8 space-y-4 text-sm text-primary-foreground/80">
              {[
                "Find schemes that fit your life",
                "Know exactly what documents you need",
                "Keep control of every sensitive step",
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <Check className="size-4 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <Card className="border-line bg-card shadow-sm relative overflow-hidden">
            {isSuccess && <div className="absolute top-0 left-0 w-full h-1 bg-sage" />}
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                {t("auth.signUpTitle", "Create your account")}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("auth.signUpSubtitle", "Set up a private space for your benefit journey.")}
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSignup}>
                <label className="block text-sm font-medium">
                  {t("auth.fullNameLabel", "Full name")}
                  <Input
                    className="mt-2 bg-card"
                    placeholder="Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading || isSuccess}
                  />
                </label>
                <label className="block text-sm font-medium">
                  {t("auth.phoneLabel", "Email ID or Mobile number")}
                  <Input
                    className="mt-2 bg-card"
                    placeholder="youremail@gmail.com"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={isLoading || isSuccess}
                  />
                </label>
                <label className="block text-sm font-medium">
                  {t("auth.passwordLabel", "Password")}
                  <Input
                    className="mt-2 bg-card"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading || isSuccess}
                  />
                </label>
                {error && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 p-2 rounded border border-amber-200">
                    <span className="font-semibold">Notice:</span>
                    {error}
                  </div>
                )}
                {isSuccess ? (
                  <Button
                    type="button"
                    className="w-full bg-sage hover:bg-sage text-white cursor-default"
                  >
                    <CheckCircle2 className="mr-2 size-4" /> Account created
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !name || !mobile || !password}
                  >
                    {isLoading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {isLoading
                      ? t("common.loading", "Creating account...")
                      : t("auth.signUpButton", "Create Account")}
                    {!isLoading && <ArrowRight className="ml-2 size-4" />}
                  </Button>
                )}
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {t("auth.haveAccount", "Already have an account?")}{" "}
                <Link to="/login" className="font-medium text-brand hover:underline">
                  {t("auth.signInButton", "Sign in")}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
