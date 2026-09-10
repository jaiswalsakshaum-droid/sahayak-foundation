import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ChevronRight, Clock3, FileCheck2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type Status } from "./components";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-soft">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

export function ActivityList({
  items,
}: {
  items: Array<{ agent: string; text: string; time: string; tone: Status }>;
}) {
  return (
    <Card className="border-line bg-card shadow-none">
      <CardContent className="divide-y divide-line p-2">
        {items.map((item) => (
          <div className="flex items-start gap-3 p-3" key={item.agent + item.time}>
            <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-ice text-brand">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed">
                <span className="font-semibold">{item.agent}</span> {item.text}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.time}</p>
            </div>
            <StatusBadge status={item.tone} label={item.tone === "warning" ? "Review" : "Done"} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function ApplicationRow({
  application,
}: {
  application: {
    id: string;
    name: string;
    status: string;
    tone: Status;
    progress: number;
    step: string;
    updated: string;
  };
}) {
  return (
    <Card className="border-line bg-card shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-sm font-semibold text-primary-foreground">
          {application.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{application.name}</h3>
            <StatusBadge status={application.tone} label={application.status} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {application.step} · Updated {application.updated}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-mist">
            <div
              className={
                application.progress > 80
                  ? "h-full w-[88%] rounded-full bg-sage"
                  : "h-full w-[62%] rounded-full bg-amber"
              }
            />
          </div>
        </div>
        <div className="flex items-center gap-3 sm:w-32 sm:justify-end">
          <span className="font-display text-xl font-semibold text-brand">
            {application.progress}%
          </span>
          <Button asChild size="icon" variant="outline" aria-label={`Open ${application.name}`}>
            <Link to="/applications/$id" params={{ id: application.id }}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-line bg-card shadow-none">
      <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-ice text-brand">
          <FileCheck2 className="size-5" />
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <CheckCircle2 className="size-3.5 text-sage" />
      {children}
    </p>
  );
}
