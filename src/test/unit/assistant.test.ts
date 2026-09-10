import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Assistant Route Hardening", () => {
  it("verifies assistant.tsx does not use setTimeout simulation chains", () => {
    const assistantFilePath = path.resolve(__dirname, "../../routes/assistant.tsx");
    const content = fs.readFileSync(assistantFilePath, "utf-8");

    // Must not contain artificial step timeouts
    expect(content).not.toMatch(/setTimeout\s*\(\s*\(\)\s*=>\s*\{\s*setStep/);
    expect(content).not.toMatch(/const\s+MOCK_SCHEMES\s*=/);
    expect(content).toContain("useAgentRun");
  });
});
