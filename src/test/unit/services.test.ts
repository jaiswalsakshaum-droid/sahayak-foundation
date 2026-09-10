import { describe, it, expect } from "vitest";
import { CANONICAL_SCHEME_IDS, CANONICAL_SCHEME_LIST } from "@/lib/scheme-constants";
import { ok, err, isOk, isErr, unwrapOr } from "@/lib/result";
import { SAHAYAK_AGENT_ROSTER, journeySteps } from "@/lib/agent-roster";

describe("Canonical Scheme Consistency", () => {
  it("defines exactly 5 canonical scheme UUIDs matching seed.sql", () => {
    expect(Object.keys(CANONICAL_SCHEME_IDS)).toHaveLength(5);
    expect(CANONICAL_SCHEME_IDS.NMMSS).toBe("a0000000-0000-0000-0000-000000000001");
    expect(CANONICAL_SCHEME_IDS.PM_KISAN).toBe("a0000000-0000-0000-0000-000000000002");
    expect(CANONICAL_SCHEME_IDS.PMAY_U).toBe("a0000000-0000-0000-0000-000000000003");
    expect(CANONICAL_SCHEME_IDS.APY).toBe("a0000000-0000-0000-0000-000000000004");
    expect(CANONICAL_SCHEME_IDS.SUKANYA_SAMRIDDHI).toBe("a0000000-0000-0000-0000-000000000005");
  });

  it("ensures every scheme in CANONICAL_SCHEME_LIST has non-empty document requirements", () => {
    expect(CANONICAL_SCHEME_LIST).toHaveLength(5);
    for (const scheme of CANONICAL_SCHEME_LIST) {
      expect(scheme.id).toMatch(/^a0000000-0000-0000-0000-00000000000[1-5]$/);
      expect(scheme.name.length).toBeGreaterThan(0);
      expect(scheme.documentRequirements.length).toBeGreaterThan(0);
    }
  });
});

describe("ServiceResult Monad Pattern", () => {
  it("constructs and matches Ok result correctly", () => {
    const res = ok({ count: 42 });
    expect(isOk(res)).toBe(true);
    expect(isErr(res)).toBe(false);
    expect(unwrapOr(res, { count: 0 })).toEqual({ count: 42 });
  });

  it("constructs and matches Err result correctly", () => {
    const res = err("Failed network request", "NETWORK_ERROR");
    expect(isOk(res)).toBe(false);
    expect(isErr(res)).toBe(true);
    if (!res.ok) {
      expect(res.error).toBe("Failed network request");
      expect(res.code).toBe("NETWORK_ERROR");
    }
    expect(unwrapOr(res, "fallback")).toBe("fallback");
  });
});

describe("Agent Workforce Roster", () => {
  it("includes all 6 specialized agents including Tracker Agent", () => {
    expect(SAHAYAK_AGENT_ROSTER).toHaveLength(6);
    const keys = SAHAYAK_AGENT_ROSTER.map((a) => a.key);
    expect(keys).toEqual(["citizen", "scheme", "eligibility", "document", "application", "tracker"]);
  });

  it("defines standard citizen journey steps", () => {
    expect(journeySteps.length).toBeGreaterThanOrEqual(6);
    expect(journeySteps.map((s) => s.label)).toContain("Need");
    expect(journeySteps.map((s) => s.label)).toContain("Next action");
  });
});
