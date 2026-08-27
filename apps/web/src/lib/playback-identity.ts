import { normalizeForFingerprint, type AgentPlaybackPayload } from "@music/domain";

/** Compares musical identity without provider IDs, which can be upgraded after enrichment. */
export const isSamePlaybackTrack = (left: AgentPlaybackPayload, right: AgentPlaybackPayload): boolean => [left.playbackProvider, left.artist.name, left.album?.title, left.track.title].map(normalizeForFingerprint).join("|") === [right.playbackProvider, right.artist.name, right.album?.title, right.track.title].map(normalizeForFingerprint).join("|");

/** Track changes are lightweight when artist + album have already been resolved. */
export const isSamePlaybackAlbum = (left: AgentPlaybackPayload, right: AgentPlaybackPayload): boolean => [left.playbackProvider, left.artist.name, left.album?.title].map(normalizeForFingerprint).join("|") === [right.playbackProvider, right.artist.name, right.album?.title].map(normalizeForFingerprint).join("|");
