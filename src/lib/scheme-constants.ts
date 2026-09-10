/**
 * Canonical Scheme IDs and metadata.
 * Single source of truth for all frontend scheme references, matching supabase/seed.sql.
 */

export const CANONICAL_SCHEME_IDS = {
  NMMSS: "a0000000-0000-0000-0000-000000000001",
  PM_KISAN: "a0000000-0000-0000-0000-000000000002",
  PMAY_U: "a0000000-0000-0000-0000-000000000003",
  APY: "a0000000-0000-0000-0000-000000000004",
  SUKANYA_SAMRIDDHI: "a0000000-0000-0000-0000-000000000005",
} as const;

export type CanonicalSchemeId =
  (typeof CANONICAL_SCHEME_IDS)[keyof typeof CANONICAL_SCHEME_IDS];

export const CANONICAL_SCHEME_LIST: {
  id: CanonicalSchemeId;
  name: string;
  category: string;
  jurisdiction: "Central" | "State";
  benefit: string;
  description: string;
  officialSource: string;
  documentRequirements: string[];
}[] = [
  {
    id: CANONICAL_SCHEME_IDS.NMMSS,
    name: "National Means-cum-Merit Scholarship",
    category: "Education",
    jurisdiction: "Central",
    benefit: "₹12,000 / year",
    description:
      "Financial support for meritorious students continuing secondary education in government and aided schools.",
    officialSource: "myScheme / Ministry of Education",
    documentRequirements: [
      "Aadhaar Card",
      "Income Certificate",
      "Enrollment Certificate",
      "Bank Passbook",
    ],
  },
  {
    id: CANONICAL_SCHEME_IDS.PM_KISAN,
    name: "PM-KISAN Samman Nidhi",
    category: "Agriculture",
    jurisdiction: "Central",
    benefit: "₹6,000 / year in 3 installments",
    description:
      "Income support scheme providing ₹6,000 per year directly into bank accounts of all landholding farmer families.",
    officialSource: "PM Kisan Portal",
    documentRequirements: [
      "Aadhaar Card",
      "Land Ownership Record (RoR)",
      "Bank Account Details",
    ],
  },
  {
    id: CANONICAL_SCHEME_IDS.PMAY_U,
    name: "PM Awas Yojana (Urban)",
    category: "Housing",
    jurisdiction: "Central",
    benefit: "Up to ₹2.67 Lakh subsidy",
    description:
      "Housing for all in urban areas through credit-linked interest subsidy and direct construction assistance.",
    officialSource: "PMAY Portal",
    documentRequirements: [
      "Aadhaar Card",
      "Income Certificate",
      "Residence Proof",
      "Affidavit / Self Declaration",
    ],
  },
  {
    id: CANONICAL_SCHEME_IDS.APY,
    name: "Atal Pension Yojana",
    category: "Employment & Pension",
    jurisdiction: "Central",
    benefit: "₹1,000 - ₹5,000 / month guaranteed pension",
    description:
      "Guaranteed minimum pension for unorganized sector workers with government co-contribution.",
    officialSource: "PFRDA / Jansuraksha",
    documentRequirements: ["Aadhaar Card", "Savings Bank Account Passbook"],
  },
  {
    id: CANONICAL_SCHEME_IDS.SUKANYA_SAMRIDDHI,
    name: "Sukanya Samriddhi Yojana",
    category: "Women & Child",
    jurisdiction: "Central",
    benefit: "High interest tax-free savings for girl child",
    description:
      "Small deposit savings scheme targeted at building a fund for education and marriage expenses of girl children.",
    officialSource: "India Post / RBI",
    documentRequirements: [
      "Birth Certificate of Girl Child",
      "Parent/Guardian Aadhaar Card",
      "Address Proof",
    ],
  },
];
