import { createFileRoute, Link } from "@tanstack/react-router";
import {
  User,
  Shield,
  CreditCard,
  Link as LinkIcon,
  CheckCircle2,
  Bot,
  ShieldCheck,
  Edit2,
  Save,
  X,
  Loader2,
  ArrowLeft,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ConsentModal, AppShell } from "@/components/sahayak";
import { requireAuth, getCurrentProfile, type UserProfile } from "@/lib/auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  beforeLoad: async () => {
    await requireAuth();
  },
  component: ProfilePage,
});

function ProfilePage() {
  const [consentOpen, setConsentOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    full_name: "",
    age: "",
    location: "",
    occupation: "",
    annual_income: "",
    phone: "",
  });

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const userProfile = await getCurrentProfile();
        if (isMounted && userProfile) {
          setProfile(userProfile);
          setFormData({
            full_name: userProfile.full_name || "",
            age: userProfile.age ? String(userProfile.age) : "",
            location: userProfile.location || "",
            occupation: userProfile.occupation || "",
            annual_income: userProfile.annual_income ? String(userProfile.annual_income) : "",
            phone: userProfile.phone || "",
          });
        }
      } catch (err) {
        console.error("[Profile] Failed to load profile:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    setSaving(true);

    try {
      const updates = {
        full_name: formData.full_name.trim() || profile.full_name,
        age: formData.age ? parseInt(formData.age, 10) : null,
        location: formData.location.trim() || null,
        occupation: formData.occupation.trim() || null,
        annual_income: formData.annual_income ? parseFloat(formData.annual_income) : null,
        phone: formData.phone.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured) {
        const { error } = await supabase.from("profiles").update(updates).eq("id", profile.id);

        if (error) throw error;
      }

      setProfile((prev) => (prev ? ({ ...prev, ...updates } as any) : null));
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = (profile?.full_name || "Citizen")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => (n[0] || "").toUpperCase())
    .join("");

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        {/* Navigation Breadcrumb / Top Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-card px-2.5 py-1 rounded-full border border-line">
            <span className="size-1.5 rounded-full bg-sage animate-pulse" />
            Citizen Agent · Identity Vault
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber flex items-center justify-between">
            <span>Demo mode active — running with local mock fallback profile.</span>
            <span className="font-semibold uppercase tracking-wider text-[10px]">Demo</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
              Citizen Profile
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your verified identity, ecosystem integrations, and consent preferences.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConsentOpen(true)}
            className="self-start sm:self-auto"
          >
            <ShieldCheck className="mr-2 size-4 text-sage" />
            Privacy & Consent
          </Button>
        </div>

        {loading ? (
          <div className="bg-card rounded-xl border border-line p-8 shadow-sm flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin mr-2" /> Loading profile...
          </div>
        ) : isEditing ? (
          <form
            onSubmit={handleSaveProfile}
            className="bg-card rounded-xl border border-line p-6 shadow-sm space-y-5"
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-lg font-semibold">Edit Profile</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                <X className="size-4 mr-1" /> Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="e.g. Aditi Roy"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  placeholder="e.g. 24"
                  min={0}
                  max={120}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="location">Location (City, State)</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Patna, Bihar"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="occupation">Occupation / Category</Label>
                <Input
                  id="occupation"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  placeholder="e.g. Student / Farmer"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="annual_income">Annual Family Income (₹)</Label>
                <Input
                  id="annual_income"
                  type="number"
                  value={formData.annual_income}
                  onChange={(e) => setFormData({ ...formData, annual_income: e.target.value })}
                  placeholder="e.g. 180000"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +91 98765 43210"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Save className="size-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-card rounded-xl border border-line p-6 shadow-sm flex flex-col sm:flex-row items-start gap-4">
            <div className="grid size-16 shrink-0 place-items-center rounded-full bg-brand/10 text-brand text-2xl font-semibold">
              {initials || "CU"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{profile?.full_name || "Citizen User"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {profile?.age ? `${profile.age} years old` : "Age not specified"} •{" "}
                {profile?.location || "Location not set"}
              </p>
              {profile?.email && (
                <p className="text-xs text-muted-foreground mt-0.5">{profile.email}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-2.5 py-1 bg-ice-2 border border-line rounded-md text-xs font-medium">
                  {profile?.occupation || "Occupation: Not specified"}
                </span>
                <span className="px-2.5 py-1 bg-ice-2 border border-line rounded-md text-xs font-medium">
                  Income:{" "}
                  {profile?.annual_income
                    ? `₹${Number(profile.annual_income).toLocaleString()}`
                    : "Not specified"}
                </span>
                {profile?.phone && (
                  <span className="px-2.5 py-1 bg-ice-2 border border-line rounded-md text-xs font-medium">
                    Phone: {profile.phone}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="shrink-0 mt-2 sm:mt-0"
            >
              <Edit2 className="size-3.5 mr-1.5" /> Edit Profile
            </Button>
          </div>
        )}

        <div className="bg-card rounded-xl border border-line shadow-sm overflow-hidden">
          <div className="p-5 border-b border-line bg-ice-2/50">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <LinkIcon className="size-5 text-brand" /> Ecosystem Integrations
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <IntegrationRow
              name="DigiLocker"
              desc="Import verified documents seamlessly"
              icon={Shield}
              comingSoon
            />
            <IntegrationRow
              name="UMANG API"
              desc="Sync government benefit statuses"
              icon={Bot}
              comingSoon
            />
            <IntegrationRow
              name="Bank Account"
              status="Not Connected"
              desc="Required for direct benefit transfer (DBT)"
              icon={CreditCard}
            />
          </div>
        </div>

        {/* Security / Ecosystem footer */}
        <div className="rounded-xl border border-line bg-card/60 p-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-sage" />
            <span>
              Profile and identity attributes are encrypted end-to-end and shared only with verified
              civic schemes upon citizen consent.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConsentOpen(true)}
            className="h-7 text-xs text-brand font-medium"
          >
            Manage Consent
          </Button>
        </div>

        <ConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
      </div>
    </AppShell>
  );
}

function IntegrationRow({
  name,
  desc,
  icon: Icon,
  active: initialActive = false,
  comingSoon = false,
}: {
  name: string;
  desc: string;
  icon: any;
  status?: string;
  active?: boolean;
  comingSoon?: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setActive(true);
    }, 1000);
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border border-line bg-ice-2">
      <div className="flex items-center gap-4">
        <div
          className={`grid size-10 place-items-center rounded-lg ${
            active
              ? "bg-sage/10 text-sage"
              : comingSoon
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-card text-muted-foreground"
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{name}</h4>
            {comingSoon && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div>
        {comingSoon ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-mist/60 px-2.5 py-1 rounded-full border border-line">
            Coming Soon
          </span>
        ) : active ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-sage bg-sage/10 px-2.5 py-1 rounded-full border border-sage/20">
            <CheckCircle2 className="size-3.5" /> Connected
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? "Connecting..." : "Connect"}
          </Button>
        )}
      </div>
    </div>
  );
}
