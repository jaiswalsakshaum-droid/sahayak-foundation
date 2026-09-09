import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  LockKeyhole,
  MoreHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/mock-data";

const statusStyles: Record<Status, string> = {
  active: "border-sage/20 bg-sage/10 text-sage",
  ready: "border-sage/20 bg-sage/10 text-sage",
  complete: "border-sage/20 bg-sage/10 text-sage",
  warning: "border-amber/25 bg-amber/10 text-amber",
  critical: "border-coral/25 bg-coral/10 text-coral",
  idle: "border-line bg-muted text-muted-foreground",
};

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  const isLive = status === "active";
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-none",
        statusStyles[status],
      )}
    >
      <span className={cn("size-1.5 rounded-full bg-current", isLive && "animate-pulse-dot")} />
      {label}
    </Badge>
  );
}

export function ConfidenceBadge({ value }: { value: string }) {
  return (
    <Badge className="rounded-full border border-sage/20 bg-sage/10 px-2.5 py-1 text-[11px] font-medium text-sage shadow-none">
      {value} confidence
    </Badge>
  );
}

export function AgentCard({
  name,
  purpose,
  description,
  status,
  tone,
  icon: Icon,
}: {
  name: string;
  purpose: string;
  description: string;
  status: string;
  tone: Status;
  icon: LucideIcon;
}) {
  return (
    <Card className="group border-line bg-card shadow-none transition-colors hover:border-brand/30">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
            <Icon className="size-5" />
          </div>
          <StatusBadge status={tone} label={status} />
        </div>
        <p className="mt-4 text-xs font-medium uppercase tracking-[0.12em] text-brand-soft">
          {purpose}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">{name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "brand",
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "brand" | "success" | "warning" | "critical";
  progress?: number;
}) {
  const valueClass =
    tone === "success"
      ? "text-sage"
      : tone === "warning"
        ? "text-amber"
        : tone === "critical"
          ? "text-coral"
          : "text-brand";
  const progressClass = progress === 83 ? "w-[83%]" : progress === 100 ? "w-full" : "w-[62%]";
  return (
    <Card className="border-line bg-card shadow-none">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("mt-1 font-display text-3xl font-semibold tracking-tight", valueClass)}>
          {value}
        </p>
        {progress ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist">
            <div className={cn("h-full rounded-full bg-sage", progressClass)} />
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ProgressStepper({ compact = false }: { compact?: boolean }) {
  const steps = [
    "Need",
    "Understand",
    "Match",
    "Verify",
    "Documents",
    "Apply",
    "Track",
    "Next action",
  ];
  return (
    <Card className={cn("border-line bg-card shadow-none", compact ? "p-4" : "p-5")}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Need → next action
        </span>
        <span className="text-[11px] font-medium text-brand">Step 5 of 8</span>
      </div>
      <div className="flex flex-wrap items-center gap-y-3">
        {steps.map((step, index) => {
          const complete = index < 4;
          const current = index === 4;
          return (
            <div className="flex items-center" key={step}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[10px] font-semibold",
                    complete && "bg-sage text-primary-foreground",
                    current && "animate-flow-pulse bg-brand text-primary-foreground",
                    !complete && !current && "border border-mist bg-card text-muted-foreground",
                  )}
                >
                  {complete ? <Check className="size-3" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    current
                      ? "text-brand"
                      : index > 4
                        ? "text-muted-foreground"
                        : "text-foreground",
                  )}
                >
                  {compact && index > 4 ? "" : step}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span className={cn("mx-2 h-px w-5", index < 4 ? "bg-sage" : "bg-mist")} />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function SchemeCard({
  scheme,
  compact = false,
}: {
  scheme: {
    id: string;
    name: string;
    shortName: string;
    category: string;
    benefit: string;
    match: string;
    status: string;
    source: string;
    description: string;
    docs: number;
    verified: number;
  };
  compact?: boolean;
}) {
  return (
    <Card className="border-line bg-card shadow-none transition-colors hover:border-brand/30">
      <CardContent className={cn("p-5", compact && "p-4")}>
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-primary-foreground font-display text-sm font-semibold">
            {scheme.shortName.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  {scheme.category} · {scheme.source}
                </p>
                <h3 className="mt-1 font-semibold leading-tight">{scheme.name}</h3>
              </div>
              <ConfidenceBadge value={scheme.match} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {scheme.description}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <span className="text-sm font-medium text-brand">{scheme.benefit}</span>
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={
                    scheme.status === "Eligible"
                      ? "complete"
                      : scheme.status === "Needs review"
                        ? "warning"
                        : "active"
                  }
                  label={scheme.status}
                />
                <Button asChild size="sm" variant="ghost" className="text-brand">
                  <Link to="/schemes/$id" params={{ id: scheme.id }}>
                    View <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DocumentCard({
  document,
}: {
  document: {
    name: string;
    type: string;
    source: string;
    status: string;
    tone: Status;
    updated: string;
  };
}) {
  return (
    <Card className="border-line bg-card shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-ice text-brand">
          <FileText className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{document.name}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {document.type} · {document.source}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={document.tone} label={document.status} />
          <p className="mt-1 text-[10px] text-muted-foreground">{document.updated}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApplicationTimeline() {
  const items = [
    [
      "Eligibility confirmed",
      "Eligibility Agent · 2 days ago · 94% confidence",
      "complete" as Status,
    ],
    [
      "5 of 6 documents verified",
      "Document Agent · Yesterday · DigiLocker connected",
      "complete" as Status,
    ],
    [
      "Enrollment certificate required",
      "Tracker Agent · Now · Blocks submission",
      "warning" as Status,
    ],
    ["Final submission", "Application Agent · Waiting for your approval", "idle" as Status],
  ];
  return (
    <Card className="border-line bg-card shadow-none">
      <CardContent className="p-5">
        <div className="relative space-y-5 pl-5">
          <span className="absolute bottom-2 left-[7px] top-2 w-px bg-mist" />
          {items.map(([title, detail, tone]) => (
            <div className="relative" key={title}>
              <span
                className={cn(
                  "absolute -left-5 top-1 size-3.5 rounded-full ring-4 ring-card",
                  tone === "complete"
                    ? "bg-sage"
                    : tone === "warning"
                      ? "animate-pulse-dot bg-amber"
                      : "bg-mist",
                )}
              />
              <p
                className={cn(
                  "text-sm font-medium",
                  tone === "warning" && "text-amber",
                  tone === "idle" && "text-muted-foreground",
                )}
              >
                {title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationCard({
  title,
  time,
  tone,
  unread,
}: {
  title: string;
  time: string;
  tone: Status;
  unread: boolean;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-line px-1 py-3 last:border-b-0">
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          tone === "critical" ? "bg-coral" : tone === "warning" ? "bg-amber" : "bg-sage",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-relaxed", unread && "font-medium")}>{title}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{time}</p>
      </div>
      {unread && <span className="mt-1 size-1.5 rounded-full bg-brand" />}
    </div>
  );
}

export function AuditLog({
  items,
}: {
  items: Array<{ label: string; detail: string; time: string }>;
}) {
  return (
    <Card className="border-line bg-card shadow-none">
      <CardContent className="space-y-4 p-5">
        {items.map((item) => (
          <div className="flex gap-3" key={item.label}>
            <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-ice text-brand">
              <Sparkles className="size-3.5" />
            </div>
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.detail} · {item.time}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NextBestAction({ compact = false }: { compact?: boolean }) {
  return (
    <Card
      className={cn(
        "border-brand bg-brand text-primary-foreground shadow-none",
        compact ? "p-5" : "p-6",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-foreground/10">
          <CircleAlert className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/65">
            Your next best action
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold leading-tight">
            Upload your enrollment certificate to complete scholarship verification.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">
            The Tracker Agent flagged a missing document blocking your National Means-cum-Merit
            Scholarship.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="bg-primary-foreground text-brand hover:bg-primary-foreground/90"
            >
              <Link to="/documents">
                Continue <ChevronRight />
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/applications/nmmse-2024">View application</Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ConsentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <Card className="w-full max-w-md border-line bg-card shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
              <LockKeyhole className="size-5" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close consent details"
            >
              <MoreHorizontal className="size-5 rotate-90" />
            </Button>
          </div>
          <CardTitle id="consent-title" className="mt-4 font-display text-2xl">
            Privacy & consent
          </CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sahayak prepares and coordinates. You decide what is shared and when anything is
            submitted.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 rounded-lg bg-ice p-4 text-sm">
            <p className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-sage" />
              Sensitive documents stay under your control.
            </p>
            <p className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-sage" />
              Every data share is shown before approval.
            </p>
            <p className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-sage" />
              Final submissions always require you.
            </p>
          </div>
          <Button className="mt-5 w-full" onClick={onClose}>
            Got it
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
