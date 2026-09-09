// Supabase Edge Function: seed-demo-data
// Securely seeds or resets the demo persona (Rahul Sharma) and demo schemes using service role permissions.

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

    // Verify caller has admin privileges if auth header is provided
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
        error: userError,
      } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Seed or update demo schemes
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

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sahayak demo data successfully seeded.",
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
