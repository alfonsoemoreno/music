import { describe, expect, it } from "vitest";
import { createEnrollmentCode } from "./bridge-pairing";

describe("createEnrollmentCode", () => {
  it("creates a numeric six-digit PIN, including possible leading zeros", () => {
    expect(createEnrollmentCode()).toMatch(/^\d{6}$/);
  });
});
