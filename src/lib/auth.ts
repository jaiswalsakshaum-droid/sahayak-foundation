import { redirect } from "@tanstack/react-router";
import { supabase, isSupabaseConfigured } from "./supabase";

export type UserRole = "citizen" | "admin";

export type UserProfile = {
  id: string;
  email?: string;
  full_name: string;
  age?: number;
  location?: string;
  occupation?: string;
  annual_income?: number;
  phone?: string;
  role: UserRole;
  created_at?: string;
};

// Used ONLY when Supabase is not configured (local/offline demo). Never used as an error fallback — see Task 9.
export const LOCAL_DEMO_PROFILE: UserProfile = {
  id: "d0000000-0000-0000-0000-000000000001",
  email: "citizen.demo@example.gov.in",
  full_name: "Demo Citizen",
  age: 20,
  location: "Lucknow, Uttar Pradesh",
  occupation: "Student / Agricultural Assistant",
  annual_income: 210000,
  phone: "+91 98765 43210",
  role: "citizen",
};

export const DEMO_PROFILE = LOCAL_DEMO_PROFILE;

/**
 * Gets the current active Supabase session.
 *
 * NOTE: supabase.auth.getSession() reads from localStorage which is
 * unavailable during SSR (TanStack Start server pass). We therefore
 * skip the call entirely on the server and rely on client-side
 * hydration + router invalidation to enforce auth guards.
 */
export async function getSession() {
  // On the server there is no localStorage — always return null and let
  // the client-side beforeLoad re-run after hydration.
  if (typeof window === "undefined") return null;

  if (!isSupabaseConfigured) {
    const isMockAuth = localStorage.getItem("sahayak_auth") === "true";
    if (isMockAuth) {
      return { user: { id: DEMO_PROFILE.id, email: DEMO_PROFILE.email } };
    }
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      // Fallback: validate directly with the Supabase server. This handles
      // cases where the local session storage is stale or the key format
      // (sb_publishable_*) causes getSession to miss the cached token.
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        // Re-fetch the full session after confirming the user is valid.
        const { data: retryData } = await supabase.auth.getSession();
        return retryData?.session ?? null;
      }
      return null;
    }
    return data.session;
  } catch (err) {
    console.error("[Sahayak Auth] Failed to get session:", err);
    return null;
  }
}

/**
 * Gets the current logged-in user profile from public.profiles
 */
export async function getCurrentProfile(): Promise<UserProfile | null> {
  const session = await getSession();
  if (!session) return null;

  if (!isSupabaseConfigured) {
    const role =
      ((typeof window !== "undefined" && localStorage.getItem("sahayak_role")) as UserRole) ||
      "citizen";
    return { ...DEMO_PROFILE, role };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      return {
        id: session.user.id,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || "Citizen User",
        role: "citizen",
      };
    }

    return {
      ...data,
      email: session.user.email,
    };
  } catch (err) {
    console.error("[Sahayak Auth] Failed to fetch profile:", err);
    return null;
  }
}

/**
 * Centralized Route Guard: Requires authentication for protected routes.
 *
 * On the server (SSR pass) we intentionally skip the redirect — the
 * server cannot read localStorage so getSession() always returns null
 * there. TanStack Start will re-run beforeLoad on the client after
 * hydration, at which point localStorage is available and the real
 * session check fires.
 */
export async function requireAuth() {
  // Skip auth enforcement during SSR — localStorage is unavailable.
  if (typeof window === "undefined") return null;

  const session = await getSession();
  if (!session) {
    throw redirect({
      to: "/login",
    });
  }
  return session;
}

/**
 * Centralized Route Guard: Requires admin role for /admin/* routes.
 * Redirects unauthenticated users to /admin/login and non-admin citizens to /dashboard.
 */
export async function requireAdmin() {
  // Skip auth enforcement during SSR — localStorage is unavailable.
  if (typeof window === "undefined") return null;

  const session = await getSession();
  if (!session) {
    throw redirect({
      to: "/admin/login",
    });
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw redirect({
      to: "/dashboard",
    });
  }
  return { session, profile };
}

/**
 * Dedicated Admin Sign-In: strictly enforces role === 'admin'
 */
export async function adminSignIn(
  emailOrIdentifier: string,
  password: string,
): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
  const cleanEmail = emailOrIdentifier.trim();

  if (!isSupabaseConfigured) {
    if (cleanEmail === "admin" && (password === "admin" || password === "1234")) {
      if (typeof window !== "undefined") {
        localStorage.setItem("sahayak_auth", "true");
        localStorage.setItem("sahayak_role", "admin");
      }
      return { success: true, profile: { ...LOCAL_DEMO_PROFILE, role: "admin", full_name: "Admin Officer" } };
    }
    return {
      success: false,
      error: "Access denied: Invalid credentials or account does not have administrative privileges.",
    };
  }

  try {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (signInError || !signInData.session) {
      return {
        success: false,
        error: "Access denied: Invalid credentials or account does not have administrative privileges.",
      };
    }

    // Verify role in profiles table
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", signInData.session.user.id)
      .single();

    if (profileError || !profileData || profileData.role !== "admin") {
      // Revert session immediately to prevent unauthorized access
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("sahayak_auth");
        localStorage.removeItem("sahayak_role");
      }
      return {
        success: false,
        error: "Access denied: Citizen accounts cannot access the administrative portal.",
      };
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("sahayak_auth", "true");
      localStorage.setItem("sahayak_role", "admin");
    }

    return {
      success: true,
      profile: {
        ...profileData,
        email: signInData.session.user.email,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "An unexpected authentication error occurred.",
    };
  }
}

/**
 * Convenience helper to check if a user is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session;
}

/**
 * Convenience helper to check if current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === "admin";
}

/**
 * Convenience helper to get current user role
 */
export async function getRole(): Promise<UserRole> {
  const profile = await getCurrentProfile();
  return profile?.role || "citizen";
}

/**
 * Sign in with email and password
 */
export async function signIn(
  emailOrIdentifier: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  // If Supabase is not configured, use local fallback mode
  if (!isSupabaseConfigured) {
    if (
      (emailOrIdentifier === "4321" ||
        emailOrIdentifier === "rahul@sahayak.gov.in" ||
        emailOrIdentifier === "admin") &&
      (password === "1234" || password === "admin")
    ) {
      if (typeof window !== "undefined") {
        localStorage.setItem("sahayak_auth", "true");
        localStorage.setItem("sahayak_role", emailOrIdentifier === "admin" ? "admin" : "citizen");
      }
      return { success: true };
    }
    if (password.length >= 4) {
      if (typeof window !== "undefined") {
        localStorage.setItem("sahayak_auth", "true");
        localStorage.setItem("sahayak_role", "citizen");
      }
      return { success: true };
    }
    return { success: false, error: "Invalid credentials. Try demo credentials: 4321 / 1234" };
  }

  // Supabase is configured: direct authentication without backdoors or auto-provisioning
  try {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: emailOrIdentifier.trim(),
      password,
    });

    if (!signInError && signInData.session) {
      if (typeof window !== "undefined") {
        localStorage.setItem("sahayak_auth", "true");
      }
      return { success: true };
    }

    return {
      success: false,
      error: signInError?.message || "Invalid credentials. Please check your login details.",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to sign in" };
  }
}

/**
 * Sign up a new user and create profile
 */
export async function signUp(
  email: string,
  password: string,
  fullName: string,
  phone?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    if (typeof window !== "undefined") {
      localStorage.setItem("sahayak_auth", "true");
      localStorage.setItem("sahayak_role", "citizen");
      localStorage.setItem("sahayak_user_name", fullName);
    }
    return { success: true };
  }

  const cleanEmail = email.trim();

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone?.trim() || null,
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("sahayak_auth", "true");
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to sign up" };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("sahayak_auth");
    localStorage.removeItem("sahayak_role");
    localStorage.removeItem("sahayak_user_name");
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("[Sahayak Auth] Error signing out:", err);
    }
  }
}
