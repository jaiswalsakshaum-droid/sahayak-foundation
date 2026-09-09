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

// Fallback demo profile when Supabase keys are not yet configured or for fast offline demo
export const DEMO_PROFILE: UserProfile = {
  id: "d0000000-0000-0000-0000-000000000001",
  email: "rahul.sharma@example.gov.in",
  full_name: "Rahul Sharma",
  age: 20,
  location: "Lucknow, Uttar Pradesh",
  occupation: "Student / Agricultural Assistant",
  annual_income: 210000,
  phone: "+91 98765 43210",
  role: "citizen",
};

/**
 * Gets the current active Supabase session
 */
export async function getSession() {
  if (!isSupabaseConfigured) {
    const isMockAuth =
      typeof window !== "undefined" && localStorage.getItem("sahayak_auth") === "true";
    if (isMockAuth) {
      return { user: { id: DEMO_PROFILE.id, email: DEMO_PROFILE.email } };
    }
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
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
 * Centralized Route Guard: Requires authentication for protected routes
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw redirect({
      to: "/login",
    });
  }
  return session;
}

/**
 * Centralized Route Guard: Requires admin role for /admin/* routes
 */
export async function requireAdmin() {
  const session = await requireAuth();
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "admin") {
    // If not admin, redirect to citizen dashboard
    throw redirect({
      to: "/dashboard",
    });
  }
  return { session, profile };
}

/**
 * Sign in with email and password
 */
export async function signIn(
  emailOrIdentifier: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  // Demo shortcut credentials for presentations (4321 / 1234 or admin / admin)
  if (
    emailOrIdentifier === "4321" ||
    emailOrIdentifier === "rahul@sahayak.gov.in" ||
    emailOrIdentifier === "admin"
  ) {
    if (password === "1234" || password === "admin") {
      if (typeof window !== "undefined") {
        localStorage.setItem("sahayak_auth", "true");
        localStorage.setItem("sahayak_role", emailOrIdentifier === "admin" ? "admin" : "citizen");
      }
      return { success: true };
    }
  }

  if (!isSupabaseConfigured) {
    if (password.length >= 4) {
      if (typeof window !== "undefined") {
        localStorage.setItem("sahayak_auth", "true");
        localStorage.setItem("sahayak_role", "citizen");
      }
      return { success: true };
    }
    return { success: false, error: "Invalid credentials. Try demo credentials: 4321 / 1234" };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailOrIdentifier.includes("@")
        ? emailOrIdentifier
        : `${emailOrIdentifier}@sahayak.local`,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("sahayak_auth", "true");
    }
    return { success: true };
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

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
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
