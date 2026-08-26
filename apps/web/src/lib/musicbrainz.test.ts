import { describe, expect, it } from "vitest";
import { chooseReleaseGroupCandidate, trackTitleMatches } from "./musicbrainz-matching";

describe("MusicBrainz matching", () => {
  it("prefers an exact album title over a higher-scored combined release group", () => {
    const selected = chooseReleaseGroupCandidate([{ id: "combined", title: "A Hard Day’s Night / A Hard Day’s Night", score: 100 }, { id: "album", title: "A Hard Day’s Night", score: 99 }], "A Hard Day's Night", 75);
    expect(selected?.id).toBe("album");
  });
  it("accepts a small local-tag typo in a track title", () => {
    expect(trackTitleMatches("I Sould Have Known Better", "I Should Have Known Better")).toBe(true);
  });
  it("does not accept a materially different local track title", () => {
    expect(trackTitleMatches("I Sould Have Known Better", "A Day in the Life")).toBe(false);
  });
});
