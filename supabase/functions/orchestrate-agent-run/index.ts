// Supabase Edge Function: orchestrate-agent-run
// Validates citizen JWT, creates agent_runs session, dispatches to Render LangGraph service,
// and returns run_id immediately for Realtime stream subscription.

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
      console.error("[orchestrate-agent-run] INTERNAL_SHARED_SECRET is not configured!");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing internal secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Require a valid Authorization header — no citizen impersonation fallback
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized: missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const citizenId = user.id; // no fallback default, ever

    const body = await req.json().catch(() => ({}));
    const query = body.query || "I need financial support for my daughter's education.";

    // 2. Create agent_runs session in database
    const { data: run, error: runError } = await supabaseAdmin
      .from("agent_runs")
      .insert({
        citizen_id: citizenId,
        input_query: query,
        status: "PROCESSING",
      })
      .select()
      .single();

    if (runError || !run) {
      throw new Error(runError?.message || "Failed to create agent_run record");
    }

    const runId = run.id;

    // 3. Dispatch to Render LangGraph backend (Fire & accept, do not block)
    if (renderUrl) {
      fetch(`${renderUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sahayak-Internal-Secret": internalSecret,
        },
        body: JSON.stringify({
          run_id: runId,
          citizen_id: citizenId,
          query: query,
        }),
      }).catch((err) => {
        console.warn("[orchestrate-agent-run] Dispatch to Render backend error:", err);
      });
    }

    // 4. Return run_id immediately to frontend for Supabase Realtime subscription
    return new Response(
      JSON.stringify({
        status: "orchestrating",
        run_id: runId,
        citizen_id: citizenId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to orchestrate agent run" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
