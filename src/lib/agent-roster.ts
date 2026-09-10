import {
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  SearchCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Status } from "@/components/sahayak/components";

export interface AgentDescriptor {
  id: string;
  name: string;
  key: "citizen" | "scheme" | "eligibility" | "document" | "application" | "tracker";
  purpose: string;
  description: string;
  status: string;
  defaultStatus: string;
  tone: Status;
  icon: LucideIcon;
}

export const journeySteps: Array<{ label: string; status: Status }> = [
  { label: "Need", status: "complete" },
  { label: "Understand", status: "complete" },
  { label: "Match", status: "complete" },
  { label: "Verify", status: "complete" },
  { label: "Documents", status: "warning" },
  { label: "Apply", status: "idle" },
  { label: "Track", status: "idle" },
  { label: "Next action", status: "active" },
];

export const SAHAYAK_AGENT_ROSTER: AgentDescriptor[] = [
  {
    id: "agent-citizen",
    name: "Citizen Agent",
    key: "citizen",
    purpose: "Your context",
    description: "Keeps your need, preferences and consent in one place.",
    status: "Active",
    defaultStatus: "Active",
    tone: "active",
    icon: ShieldCheck,
  },
  {
    id: "agent-scheme",
    name: "Scheme Agent",
    key: "scheme",
    purpose: "Finds the fit",
    description: "Scans central and state schemes for what fits your situation.",
    status: "Idle",
    defaultStatus: "Idle",
    tone: "idle",
    icon: SearchCheck,
  },
  {
    id: "agent-eligibility",
    name: "Eligibility Agent",
    key: "eligibility",
    purpose: "Checks the rules",
    description: "Cross-checks income, age, residence and category criteria.",
    status: "Idle",
    defaultStatus: "Idle",
    tone: "idle",
    icon: ClipboardCheck,
  },
  {
    id: "agent-document",
    name: "Document Agent",
    key: "document",
    purpose: "Prepares the proof",
    description: "Finds what is ready, flags gaps and prepares clean uploads.",
    status: "Idle",
    defaultStatus: "Idle",
    tone: "idle",
    icon: FileCheck2,
  },
  {
    id: "agent-application",
    name: "Application Agent",
    key: "application",
    purpose: "Builds the draft",
    description: "Assembles forms and waits for your explicit sign-off.",
    status: "Standby",
    defaultStatus: "Standby",
    tone: "idle",
    icon: FileText,
  },
  {
    id: "agent-tracker",
    name: "Tracker Agent",
    key: "tracker",
    purpose: "Watches the journey",
    description: "Monitors application stages and calculates the next best action.",
    status: "Monitoring",
    defaultStatus: "Monitoring",
    tone: "ready",
    icon: Landmark,
  },
];

export const agents = SAHAYAK_AGENT_ROSTER;

