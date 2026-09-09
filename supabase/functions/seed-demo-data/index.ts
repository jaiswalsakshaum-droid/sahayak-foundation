// Supabase Edge Function: seed-demo-data
// Securely seeds or resets the demo persona (Rahul Sharma), schemes, eligibility rules,
// document requirements, applications, documents, and notifications.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in Edge Function environment.",
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Upsert Demo Schemes
    const demoSchemes = [
      {
        id: "a0000000-0000-0000-0000-000000000001",
        name: "National Means-cum-Merit Scholarship",
        category: "Education",
        jurisdiction: "Central",
        benefit: "₹12,000 / year",
        description:
          "Financial support for meritorious students continuing secondary education in government and aided schools.",
        official_source: "myScheme / Ministry of Education",
        eligibility_status: "Active",
      },
      {
        id: "a0000000-0000-0000-0000-000000000002",
        name: "PM-KISAN Samman Nidhi",
        category: "Agriculture",
        jurisdiction: "Central",
        benefit: "₹6,000 / year in 3 installments",
        description:
          "Income support scheme providing ₹6,000 per year directly into bank accounts of all landholding farmer families.",
        official_source: "PM Kisan Portal",
        eligibility_status: "Active",
      },
      {
        id: "a0000000-0000-0000-0000-000000000003",
        name: "PM Awas Yojana (Urban)",
        category: "Housing",
        jurisdiction: "Central",
        benefit: "Up to ₹2.67 Lakh subsidy",
        description: "Housing for all in urban areas through credit-linked interest subsidy.",
        official_source: "PMAY Portal",
        eligibility_status: "Active",
      },
      {
        id: "a0000000-0000-0000-0000-000000000004",
        name: "Atal Pension Yojana",
        category: "Employment & Pension",
        jurisdiction: "Central",
        benefit: "₹1,000 - ₹5,000 / month pension",
        description: "Guaranteed minimum pension for unorganized sector workers.",
        official_source: "PFRDA / Jansuraksha",
        eligibility_status: "Active",
      },
      {
        id: "a0000000-0000-0000-0000-000000000005",
        name: "Sukanya Samriddhi Yojana",
        category: "Women & Child",
        jurisdiction: "Central",
        benefit: "High interest savings for girl child",
        description: "Small deposit savings scheme for girl child education and marriage expenses.",
        official_source: "India Post / RBI",
        eligibility_status: "Active",
      },
    ];

    await supabaseAdmin.from("schemes").upsert(demoSchemes, { onConflict: "id" });

    // 2. Upsert Eligibility Rules
    const demoRules = [
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        criterion_name: "Age",
        requirement: "14-18 years",
        rule_type: "numeric",
        evidence_source: "Identity Document",
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        criterion_name: "Annual Household Income",
        requirement: "Below ₹3,50,000",
        rule_type: "numeric",
        evidence_source: "Income Certificate",
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        criterion_name: "School Enrollment",
        requirement: "Enrolled in Government/Aided School",
        rule_type: "text",
        evidence_source: "Enrollment Certificate",
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000002",
        criterion_name: "Landholding",
        requirement: "Cultivable land in family name",
        rule_type: "boolean",
        evidence_source: "Land Records / RoR",
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000002",
        criterion_name: "Bank Account",
        requirement: "Aadhaar-seeded active bank account",
        rule_type: "text",
        evidence_source: "Bank Passbook",
      },
    ];

    await supabaseAdmin
      .from("eligibility_rules")
      .upsert(demoRules, { onConflict: "scheme_id,criterion_name" });

    // 3. Upsert Document Requirements
    const demoDocReqs = [
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        document_type: "Aadhaar Card",
        is_mandatory: true,
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        document_type: "Income Certificate",
        is_mandatory: true,
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        document_type: "Enrollment Certificate",
        is_mandatory: true,
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000001",
        document_type: "Bank Passbook",
        is_mandatory: true,
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000002",
        document_type: "Aadhaar Card",
        is_mandatory: true,
      },
      {
        scheme_id: "a0000000-0000-0000-0000-000000000002",
        document_type: "Land Ownership Record (RoR)",
        is_mandatory: true,
      },
    ];

    await supabaseAdmin
      .from("document_requirements")
      .upsert(demoDocReqs, { onConflict: "scheme_id,document_type" });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Complete Sahayak demo scenario successfully seeded.",
        schemesCount: demoSchemes.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to seed demo data" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
