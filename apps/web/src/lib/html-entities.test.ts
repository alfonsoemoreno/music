import { describe, expect, it } from "vitest";
import { decodeHtmlEntities } from "./html-entities";

describe("decodeHtmlEntities", () => {
  it("decodes named and numeric entities from playback metadata", () => {
    expect(decodeHtmlEntities("I&apos;ll String Along With You &amp; Friends &#8212; #1")).toBe("I'll String Along With You & Friends — #1");
  });

  it("handles a value encoded twice without changing ordinary text", () => {
    expect(decodeHtmlEntities("Rock &amp;apos;n&amp;apos; Roll")).toBe("Rock 'n' Roll");
    expect(decodeHtmlEntities("Kind of Blue")).toBe("Kind of Blue");
  });
});
