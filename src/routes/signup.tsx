import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignupPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = password === confirmPassword;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!isPasswordLongEnough) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!doPasswordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUp(email.trim(), password, name.trim(), phone.trim() || undefined);
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

  const isFormValid =
    name.trim().length > 0 &&
    isEmailValid &&
    isPasswordLongEnough &&
    doPasswordsMatch &&
    confirmPassword.length > 0;

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
                    className="mt-1.5 bg-card"
                    placeholder="Rahul Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading || isSuccess}
                    required
                  />
                </label>

                <label className="block text-sm font-medium">
                  {t("auth.emailLabel", "Email address")}
                  <Input
                    className="mt-1.5 bg-card"
                    type="email"
                    placeholder="youremail@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading || isSuccess}
                    required
                  />
                  {email.length > 0 && !isEmailValid && (
                    <p className="text-xs text-amber-600 mt-1">Enter a valid email address.</p>
                  )}
                </label>

                <label className="block text-sm font-medium">
                  {t("auth.phoneOptionalLabel", "Phone number (optional)")}
                  <Input
                    className="mt-1.5 bg-card"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading || isSuccess}
                  />
                </label>

                <label className="block text-sm font-medium">
                  {t("auth.passwordLabel", "Password")}
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
                    <CheckCircle2 className="mr-2 size-4" /> Account created
                  </Button>
                ) : (
                  <Button type="submit" className="w-full" disabled={isLoading || !isFormValid}>
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
