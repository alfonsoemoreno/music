export type PlaybackState = "playing" | "paused" | "stopped";

export interface NowPlaying {
  deviceId: string;
  playbackProvider: string;
  source?: string;
  track: { title: string; durationMs?: number; positionMs?: number; externalId?: string };
  artist: { name: string; externalId?: string };
  album?: { title: string; artworkUrl?: string; externalId?: string };
  playback: { state: PlaybackState };
  audio?: { codec?: string; sampleRate?: number; bitDepth?: number; bitrate?: number };
  rawMetadata?: unknown;
}

export type PlaybackEventKind = "track-changed" | "playback-changed" | "source-changed";

export interface PlaybackEvent {
  kind: PlaybackEventKind;
  occurredAt: string;
  nowPlaying: NowPlaying;
}

export interface AgentPlaybackPayload extends NowPlaying {
  agentVersion: string;
}

export const normalizeForFingerprint = (value: string | undefined): string =>
  (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*(remaster|mix|deluxe|edition)[^)]*\)/gi, "")
    .replace(/\s+-\s+(remaster|mix|deluxe|edition).*$/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const playbackFingerprint = (nowPlaying: NowPlaying): string => {
  const externalId = nowPlaying.track.externalId;
  if (externalId) return `track:${externalId}`;
  return [nowPlaying.playbackProvider, nowPlaying.artist.name, nowPlaying.album?.title, nowPlaying.track.title]
    .map(normalizeForFingerprint)
    .join("|");
};
