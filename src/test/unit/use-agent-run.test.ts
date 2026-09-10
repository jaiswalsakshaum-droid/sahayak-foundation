import { describe, it, expect } from "vitest";
import { AGENT_STEPS } from "@/hooks/use-agent-run";

describe("useAgentRun Hook Workflow", () => {
  it("defines the 6 sequential agent lifecycle stages", () => {
    expect(AGENT_STEPS).toHaveLength(6);
    expect(AGENT_STEPS).toEqual([
      { key: "citizen", label: "Citizen Context", agentName: "Citizen Agent" },
      { key: "scheme", label: "Scheme Discovery", agentName: "Scheme Agent" },
      { key: "eligibility", label: "Rule Verification", agentName: "Eligibility Agent" },
      { key: "document", label: "Document Check", agentName: "Document Agent" },
      { key: "application", label: "Draft Preparation", agentName: "Application Agent" },
      { key: "tracker", label: "Journey Tracking", agentName: "Tracker Agent" },
    ]);
  });
});
