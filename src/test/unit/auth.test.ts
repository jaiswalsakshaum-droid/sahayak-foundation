import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRole, isAuthenticated, isAdmin } from "@/lib/auth";

describe("Auth Helper Functions", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to citizen role when unauthenticated", async () => {
    const role = await getRole();
    expect(role).toBe("citizen");
  });

  it("detects unauthenticated state when no session exists", async () => {
    const authed = await isAuthenticated();
    expect(authed).toBe(false);
    const admin = await isAdmin();
    expect(admin).toBe(false);
  });
});
