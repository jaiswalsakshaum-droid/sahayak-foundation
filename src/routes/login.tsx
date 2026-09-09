import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === "4321" && password === "1234") {
      localStorage.setItem("sahayak_auth", "true");
      navigate({ to: "/dashboard" });
    } else {
      setError("Invalid credentials. Try 4321 / 1234");
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      description="Continue your journey from eligibility to action."
    >
      <Card className="border-line bg-card shadow-sm">
        <CardHeader>
          <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <LockKeyhole className="size-5" />
          </div>
          <CardTitle className="mt-4 font-display text-2xl">Sign in to Sahayak</CardTitle>
          <p className="text-sm text-muted-foreground">Access your civic assistant workspace.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block text-sm font-medium">
              Mobile number or email
              <Input
                className="mt-2 bg-card"
                placeholder="4321"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <Input
                className="mt-2 bg-card"
                type="password"
                placeholder="1234"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 p-2 rounded border border-amber-200">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full">
              Sign in <ArrowRight className="ml-2 size-4" />
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            New to Sahayak?{" "}
            <Link to="/signup" className="font-medium text-brand hover:underline">
              Create an account
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
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
            S
          </span>
          <span className="font-display text-lg font-semibold">Sahayak</span>
        </Link>
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
