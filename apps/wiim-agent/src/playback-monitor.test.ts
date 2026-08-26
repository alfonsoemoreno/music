import { describe, expect, it } from "vitest";
import type { NowPlaying } from "@music/domain";
import { PlaybackMonitorService } from "./playback-monitor.js";
const make = (title: string, positionMs = 0): NowPlaying => ({ deviceId: "living-room", playbackProvider: "qobuz", artist: { name: "The Beatles" }, album: { title: "Abbey Road" }, track: { title, positionMs }, playback: { state: "playing" } });
describe("PlaybackMonitorService", () => { it("does not emit for progress only", () => { const monitor = new PlaybackMonitorService(); expect(monitor.inspect(make("Something"))?.kind).toBe("track-changed"); expect(monitor.inspect(make("Something", 2_000))).toBeUndefined(); expect(monitor.inspect(make("Come Together"))?.kind).toBe("track-changed"); }); });
