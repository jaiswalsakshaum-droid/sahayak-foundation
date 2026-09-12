import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your-project-id") &&
  supabaseUrl.startsWith("http"),
);

if (typeof window !== "undefined") {
  if (isSupabaseConfigured) {
    console.info(`[Sahayak Boot] Supabase connected successfully: ${supabaseUrl}`);
  } else {
    console.warn(
      "[Sahayak Boot] Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not set or invalid. Running with local fallback mode.",
    );
  }
}

// Singleton Supabase client
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder-project.supabase.co",
  isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Explicitly use localStorage (client-only). During SSR this is
      // undefined which prevents Supabase from attempting any storage I/O
      // on the server — the root cause of the "logged out on refresh" bug.
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  },
);
