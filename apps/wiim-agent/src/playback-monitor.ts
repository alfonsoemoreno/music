import { playbackFingerprint, type NowPlaying, type PlaybackEvent } from "@music/domain";

export class PlaybackMonitorService {
  private previous?: NowPlaying;
  reset(): void { this.previous = undefined; }
  inspect(nowPlaying: NowPlaying): PlaybackEvent | undefined {
    const previous = this.previous;
    this.previous = nowPlaying;
    if (!previous) return { kind: "track-changed", occurredAt: new Date().toISOString(), nowPlaying };
    if (playbackFingerprint(previous) !== playbackFingerprint(nowPlaying)) return { kind: "track-changed", occurredAt: new Date().toISOString(), nowPlaying };
    if (previous.playback.state !== nowPlaying.playback.state) return { kind: "playback-changed", occurredAt: new Date().toISOString(), nowPlaying };
    if (previous.source !== nowPlaying.source) return { kind: "source-changed", occurredAt: new Date().toISOString(), nowPlaying };
    return undefined;
  }
}
