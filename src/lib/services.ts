export type NeedIntent = {
  category: string;
  urgency: 'low' | 'medium' | 'high';
  keywords: string[];
};

export type SchemeMatch = {
  id: string;
  name: string;
  category: string;
  benefit: string;
  matchScore: number;
  description: string;
  official: boolean;
  reqDocs: string[];
  lastVerified: string;
};

export type EligibilityCriterion = {
  name: string;
  citizenInfo: string;
  requirement: string;
  evidenceSource: string;
  status: 'verified' | 'missing' | 'mismatch';
};

export type NextAction = {
  type: 'upload_document' | 'review_application' | 'provide_info';
  description: string;
  agent: string;
};

// Mock Database of schemes
const MOCK_SCHEMES_DB: SchemeMatch[] = [
  {
    id: "s1",
    name: "National Means-cum-Merit Scholarship",
    category: "Education",
    benefit: "₹12,000 / year",
    matchScore: 92,
    description: "Financial support for meritorious students continuing secondary education.",
    official: true,
    reqDocs: ["Income Certificate", "Enrollment Certificate", "Identity Proof"],
    lastVerified: "Today"
  },
  {
    id: "s2",
    name: "PM-KISAN Samman Nidhi",
    category: "Agriculture",
    benefit: "₹6,000 / year",
    matchScore: 98,
    description: "Income support to all landholding farmer families.",
    official: true,
    reqDocs: ["Aadhaar", "Land Ownership Record", "Bank Account Details"],
    lastVerified: "Yesterday"
  },
  {
    id: "s3",
    name: "PM Awas Yojana (Urban)",
    category: "Housing",
    benefit: "Up to ₹2.67 Lakh subsidy",
    matchScore: 85,
    description: "Housing for all in urban areas through credit linked subsidy.",
    official: true,
    reqDocs: ["Income Proof", "Aadhaar", "Self-declaration of not owning a pucca house"],
    lastVerified: "1 week ago"
  },
  {
    id: "s4",
    name: "Atal Pension Yojana",
    category: "Employment & Pension",
    benefit: "₹1,000 - ₹5,000 / month pension",
    matchScore: 78,
    description: "Guaranteed minimum pension for unorganized sector workers.",
    official: true,
    reqDocs: ["Aadhaar", "Savings Bank Account"],
    lastVerified: "2 days ago"
  },
  {
    id: "s5",
    name: "Sukanya Samriddhi Yojana",
    category: "Women & Child",
    benefit: "High interest savings for girl child",
    matchScore: 88,
    description: "Small deposit scheme for the girl child to meet education and marriage expenses.",
    official: true,
    reqDocs: ["Birth Certificate of girl child", "Parent/Guardian ID proof", "Address Proof"],
    lastVerified: "Today"
  }
];

export async function understandCitizenNeed(query: string): Promise<NeedIntent> {
  // Simulate AI latency
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const lowerQuery = query.toLowerCase();
  
  let category = "General";
  if (lowerQuery.includes("scholarship") || lowerQuery.includes("education") || lowerQuery.includes("college") || lowerQuery.includes("school")) {
    category = "Education";
  } else if (lowerQuery.includes("farm") || lowerQuery.includes("agriculture") || lowerQuery.includes("kisan")) {
    category = "Agriculture";
  } else if (lowerQuery.includes("house") || lowerQuery.includes("home") || lowerQuery.includes("housing")) {
    category = "Housing";
  } else if (lowerQuery.includes("job") || lowerQuery.includes("employment") || lowerQuery.includes("work")) {
    category = "Employment & Pension";
  } else if (lowerQuery.includes("women") || lowerQuery.includes("girl") || lowerQuery.includes("daughter")) {
    category = "Women & Child";
  }

  return {
    category,
    urgency: lowerQuery.includes("urgent") || lowerQuery.includes("lost my job") ? 'high' : 'medium',
    keywords: lowerQuery.split(" ").filter(w => w.length > 4)
  };
}

export async function findRelevantSchemes(intent: NeedIntent): Promise<SchemeMatch[]> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (intent.category === "General") {
    return MOCK_SCHEMES_DB.slice(0, 3);
  }
  
  const filtered = MOCK_SCHEMES_DB.filter(s => s.category === intent.category);
  // Return filtered or fallback to some default if empty
  return filtered.length > 0 ? filtered : MOCK_SCHEMES_DB.slice(0, 2);
}

export async function checkEligibility(schemeId: string, citizenData: any): Promise<{ isEligible: boolean, criteria: EligibilityCriterion[] }> {
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Mock logic based on scheme
  const criteria: EligibilityCriterion[] = [
    {
      name: "Age",
      citizenInfo: "20",
      requirement: "18-25",
      evidenceSource: "Profile",
      status: "verified"
    },
    {
      name: "Household Income",
      citizenInfo: "₹2.1L",
      requirement: "Below ₹3L",
      evidenceSource: "Income Certificate",
      status: "verified"
    }
  ];

  if (schemeId === "s1" || schemeId === "demo-1") {
    criteria.push({
      name: "Enrollment Certificate",
      citizenInfo: "Missing",
      requirement: "Required",
      evidenceSource: "—",
      status: "missing"
    });
  }

  const isEligible = criteria.every(c => c.status === "verified");

  return {
    isEligible,
    criteria
  };
}

export async function generateNextAction(eligibility: { isEligible: boolean, criteria: EligibilityCriterion[] }): Promise<NextAction> {
  await new Promise(resolve => setTimeout(resolve, 600));

  const missing = eligibility.criteria.find(c => c.status === "missing");
  
  if (missing) {
    return {
      type: "upload_document",
      description: `Please upload your ${missing.name} to continue.`,
      agent: "Document Agent"
    };
  }
  
  return {
    type: "review_application",
    description: "All criteria met. Please review the draft application.",
    agent: "Application Agent"
  };
}

export type DocumentValidationResult = {
  isValid: boolean;
  type: string;
  name: string;
  issueDate: string;
  validity: string;
  confidence: number;
  extractedFields: Record<string, string>;
};

export async function validateDocument(file: any): Promise<DocumentValidationResult> {
  await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate OCR and AI processing
  
  return {
    isValid: true,
    type: "Identity Proof",
    name: "Aadhaar Card",
    issueDate: "12-05-2018",
    validity: "Lifetime",
    confidence: 96,
    extractedFields: {
      "Name": "Sakshi Kumari",
      "DOB": "15-08-2003",
      "Aadhaar Number": "XXXX-XXXX-1234"
    }
  };
}

export async function extractDocumentFields(file: any): Promise<Record<string, string>> {
  const result = await validateDocument(file);
  return result.extractedFields;
}

export async function matchDocumentToRequirement(file: any, requirementId: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 800));
  return true;
}

export type ApplicationDraft = {
  id: string;
  schemeId: string;
  schemeName: string;
  status: 'draft' | 'awaiting_approval' | 'submitted' | 'under_review' | 'approved';
  applicantInfo: Record<string, { value: string; status: 'verified' | 'needs_review' | 'missing' }>;
  documents: { name: string; status: 'verified' | 'missing' | 'needs_review' }[];
};

export async function prepareApplication(schemeId: string): Promise<ApplicationDraft> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  return {
    id: "SAH-2026-004281",
    schemeId,
    schemeName: schemeId === 's1' ? "National Means-cum-Merit Scholarship" : "Demo Scheme",
    status: "awaiting_approval",
    applicantInfo: {
      "Full Name": { value: "Sakshi Kumari", status: "verified" },
      "Date of Birth": { value: "15-08-2003", status: "verified" },
      "Education Level": { value: "Undergraduate", status: "verified" },
      "Annual Income": { value: "₹2,10,000", status: "verified" },
      "Bank Account": { value: "XXXX-XXXX-9876", status: "needs_review" },
    },
    documents: [
      { name: "Aadhaar", status: "verified" },
      { name: "Income Certificate", status: "verified" },
      { name: "Enrollment Certificate", status: "verified" }
    ]
  };
}

export async function saveApplicationDraft(draft: ApplicationDraft): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
}

export async function recordConsent(applicationId: string, citizenId: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 800));
  return true;
}

export async function submitApplication(applicationId: string): Promise<{ success: boolean; trackingId: string }> {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { success: true, trackingId: applicationId };
}

export async function getApplicationStatus(applicationId: string): Promise<{ status: string; timeline: { step: string; status: 'completed' | 'current' | 'pending' }[] }> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    status: "submitted",
    timeline: [
      { step: "Application prepared", status: "completed" },
      { step: "Citizen approved", status: "completed" },
      { step: "Submitted", status: "completed" },
      { step: "Under department review", status: "current" },
      { step: "Decision", status: "pending" },
      { step: "Benefit disbursement", status: "pending" }
    ]
  };
}
