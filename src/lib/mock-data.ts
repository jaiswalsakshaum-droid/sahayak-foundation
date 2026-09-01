import {
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  SearchCheck,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type Status = "active" | "ready" | "warning" | "critical" | "idle" | "complete";

export const journeySteps = [
  { label: "Need", status: "complete" as Status },
  { label: "Understand", status: "complete" as Status },
  { label: "Match", status: "complete" as Status },
  { label: "Verify", status: "complete" as Status },
  { label: "Documents", status: "warning" as Status },
  { label: "Apply", status: "idle" as Status },
  { label: "Track", status: "idle" as Status },
  { label: "Next action", status: "active" as Status },
];

export const agents: Array<{
  name: string;
  purpose: string;
  description: string;
  status: string;
  tone: Status;
  icon: LucideIcon;
}> = [
  { name: "Citizen Agent", purpose: "Your context", description: "Keeps your need, preferences and consent in one place.", status: "Active", tone: "active", icon: ShieldCheck },
  { name: "Scheme Agent", purpose: "Finds the fit", description: "Scans central and state schemes for what fits your situation.", status: "Idle", tone: "idle", icon: SearchCheck },
  { name: "Eligibility Agent", purpose: "Checks the rules", description: "Cross-checks income, age, residence and category criteria.", status: "Verifying", tone: "active", icon: ClipboardCheck },
  { name: "Document Agent", purpose: "Prepares the proof", description: "Finds what is ready, flags gaps and prepares clean uploads.", status: "1 missing", tone: "warning", icon: FileCheck2 },
  { name: "Application Agent", purpose: "Builds the draft", description: "Assembles forms and waits for your explicit sign-off.", status: "Standby", tone: "idle", icon: FileText },
  { name: "Tracker Agent", purpose: "Watches the journey", description: "Monitors source portals and tells you the next best action.", status: "Monitoring", tone: "active", icon: Landmark },
];

export const schemes = [
  { id: "nmmse", name: "National Means-cum-Merit Scholarship", shortName: "NMMSS", category: "Education", benefit: "₹12,000 / year", match: "92% match", status: "Eligible", source: "myScheme", description: "Financial support for meritorious students continuing secondary education.", docs: 6, verified: 5 },
  { id: "hostel", name: "UP Post-Matric Hostel Subsidy", shortName: "Hostel Subsidy", category: "Education", benefit: "Up to ₹2,400 / month", match: "87% match", status: "In progress", source: "UP Scholarship", description: "Support for eligible undergraduate students living away from home in Uttar Pradesh.", docs: 5, verified: 5 },
  { id: "pds", name: "National Food Security — PDS", shortName: "Food Security", category: "Food & essentials", benefit: "Subsidised grains", match: "74% match", status: "Needs review", source: "UMANG", description: "Household food security support based on income and family details.", docs: 4, verified: 2 },
];

export const documents = [
  { name: "Aadhaar card", type: "Identity", source: "DigiLocker", status: "Verified", tone: "complete" as Status, updated: "Today" },
  { name: "Income certificate", type: "Income proof", source: "Uploaded by you", status: "Verified", tone: "complete" as Status, updated: "Yesterday" },
  { name: "Bank passbook", type: "Banking", source: "DigiLocker", status: "Verified", tone: "complete" as Status, updated: "Yesterday" },
  { name: "Caste certificate", type: "Category proof", source: "DigiLocker", status: "Verified", tone: "complete" as Status, updated: "18 Apr" },
  { name: "Residence certificate", type: "Address proof", source: "Uploaded by you", status: "Verified", tone: "complete" as Status, updated: "18 Apr" },
  { name: "Enrollment certificate", type: "Education proof", source: "Needed for NMMSS", status: "Missing", tone: "warning" as Status, updated: "Action needed" },
];

export const applications = [
  { id: "nmmse-2024", name: "National Means-cum-Merit Scholarship", schemeId: "nmmse", status: "Needs your action", tone: "warning" as Status, progress: 62, step: "Enrollment certificate pending", updated: "12 minutes ago" },
  { id: "hostel-2024", name: "UP Post-Matric Hostel Subsidy", schemeId: "hostel", status: "Under review", tone: "active" as Status, progress: 88, step: "Step 7 of 8", updated: "Yesterday" },
];

export const activity = [
  { agent: "Tracker Agent", text: "flagged an enrollment certificate missing from your scholarship application.", time: "12 min ago", tone: "warning" as Status },
  { agent: "Document Agent", text: "verified 3 files from DigiLocker.", time: "1 hr ago", tone: "complete" as Status },
  { agent: "Scheme Agent", text: "matched 3 benefits to your profile.", time: "Yesterday", tone: "active" as Status },
];

export const notifications = [
  { title: "Action needed: upload enrollment certificate.", time: "12 min ago", tone: "critical" as Status, unread: true },
  { title: "Income certificate expires in 3 days.", time: "1 hr ago", tone: "critical" as Status, unread: true },
  { title: "Hostel subsidy moved to review stage.", time: "Yesterday", tone: "active" as Status, unread: false },
];