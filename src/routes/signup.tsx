import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  const navigate = useNavigate();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("sahayak_auth", "true");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-ice-2 px-5 py-10">
      <div className="w-full max-w-2xl">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-brand font-display text-sm font-semibold text-primary-foreground">
            S
          </span>
          <span className="font-display text-lg font-semibold">Sahayak</span>
        </Link>
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
          <Card className="border-line bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Create your account</CardTitle>
              <p className="text-sm text-muted-foreground">
                Set up a private space for your benefit journey.
              </p>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSignup}>
                <label className="block text-sm font-medium">
                  Full name
                  <Input className="mt-2 bg-card" placeholder="Rahul Sharma" />
                </label>
                <label className="block text-sm font-medium">
                  Mobile number
                  <Input className="mt-2 bg-card" placeholder="+91 98765 43210" />
                </label>
                <label className="block text-sm font-medium">
                  Password
                  <Input className="mt-2 bg-card" type="password" placeholder="••••••••" />
                </label>
                <Button type="submit" className="w-full">
                  Create account <ArrowRight className="ml-2 size-4" />
                </Button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-brand hover:underline">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
