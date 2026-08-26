import { describe, expect, it } from "vitest";
import type { AgentPlaybackPayload } from "@music/domain";
import { isSamePlaybackTrack } from "./playback-identity";

const playback = (title: string): AgentPlaybackPayload => ({ agentVersion: "test", deviceId: "device", playbackProvider: "tidal", artist: { name: "Diana Krall" }, album: { title: "This Dream Of You" }, track: { title }, playback: { state: "playing" } });

describe("isSamePlaybackTrack", () => {
  it("allows an enrichment to merge after a pause or resume of the same track", () => {
    expect(isSamePlaybackTrack(playback("But Beautiful"), { ...playback("But Beautiful"), playback: { state: "paused" } })).toBe(true);
  });
  it("does not allow a previous track to replace a new one", () => {
    expect(isSamePlaybackTrack(playback("But Beautiful"), playback("Main Theme"))).toBe(false);
  });
});
