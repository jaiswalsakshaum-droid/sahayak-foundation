// Supabase Edge Function: extract-document
// Validates citizen JWT, verifies document ownership, and dispatches
// Groq Vision extraction to the Render backend (fire-and-accept pattern).

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
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing Supabase credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!internalSecret) {
      console.error("[extract-document] INTERNAL_SHARED_SECRET is not configured!");
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: missing internal secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Require a valid Authorization header — no impersonation fallback
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const citizenId = user.id;

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const documentId: string = body.document_id ?? "";

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "Bad request: document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Verify the requesting citizen actually owns this document
    const { data: docRecord, error: docError } = await supabaseAdmin
      .from("documents")
      .select("id, citizen_id, document_type, status")
      .eq("id", documentId)
      .single();

    if (docError || !docRecord) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (docRecord.citizen_id !== citizenId) {
      console.warn(
        `[extract-document] Citizen ${citizenId} tried to extract doc ${documentId} owned by ${docRecord.citizen_id}`,
      );
      return new Response(
        JSON.stringify({ error: "Forbidden: document does not belong to authenticated citizen" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Dispatch to Render backend (fire-and-accept — extraction is async)
    if (renderUrl) {
      fetch(`${renderUrl}/extract-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sahayak-Internal-Secret": internalSecret,
        },
        body: JSON.stringify({ document_id: documentId }),
      }).catch((err) => {
        console.warn("[extract-document] Dispatch to Render backend failed:", err);
      });
    }

    // 5. Return accepted immediately — client polls or subscribes for the document row update
    return new Response(
      JSON.stringify({
        status: "accepted",
        document_id: documentId,
        document_type: docRecord.document_type,
        message: "Document intelligence extraction queued. Subscribe to the documents table for status updates.",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[extract-document] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
