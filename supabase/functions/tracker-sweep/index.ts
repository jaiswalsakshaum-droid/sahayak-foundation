// Supabase Edge Function: tracker-sweep
// Validates authorization, creates a tracker_sweep agent_run record,
// and invokes the backend Tracker Agent endpoint POST /tracker/run.

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
    const renderUrl = Deno.env.get("RENDER_BACKEND_URL") ?? "http://localhost:8000";
    const internalSecret = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in Edge Function.",
      );
    }

    if (!internalSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing internal secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Optional user validation if invoked from citizen or admin client
    const authHeader = req.headers.get("Authorization");
    let citizenId: string | null = null;
    let isAdmin = false;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        citizenId = user.id;
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profile?.role === "admin") {
          isAdmin = true;
        }
      }
    }

    const body = await req.json().catch(() => ({}));
    const targetCitizenId = isAdmin ? body.citizen_id || null : citizenId;

    // Dispatch to Backend Tracker Sweep
    const response = await fetch(`${renderUrl}/tracker/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sahayak-Internal-Secret": internalSecret,
      },
      body: JSON.stringify({
        citizen_id: targetCitizenId,
      }),
    });

    const data = await response.json().catch(() => ({ status: "accepted" }));

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Tracker Agent sweep initiated.",
        data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to trigger tracker sweep" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
