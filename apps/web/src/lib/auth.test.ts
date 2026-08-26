import { describe, expect, it } from "vitest";
import { isValidAgentToken } from "./auth.js";
describe("isValidAgentToken", () => {
  it("rejects absent and wrong agent credentials", () => {
    const previous = process.env.AGENT_TOKEN; process.env.AGENT_TOKEN = "valid-token";
    expect(isValidAgentToken(null)).toBe(false); expect(isValidAgentToken("Bearer wrong-token")).toBe(false); expect(isValidAgentToken("Bearer valid-token")).toBe(true);
    process.env.AGENT_TOKEN = previous;
  });
});
