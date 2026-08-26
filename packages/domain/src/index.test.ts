import { describe, expect, it } from "vitest";
import { normalizeForFingerprint } from "./index.js";

describe("normalizeForFingerprint", () => {
  it("removes non-identity remix/remaster labels", () => {
    expect(normalizeForFingerprint("Abbey Road (2019 Mix)")).toBe("abbey road");
    expect(normalizeForFingerprint(" ABBEY   ROAD ")).toBe("abbey road");
  });
});
