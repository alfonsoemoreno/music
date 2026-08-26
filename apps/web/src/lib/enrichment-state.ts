import type { AgentPlaybackPayload } from "@music/domain";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albumEnrichmentStates, albums } from "@/db/schema";

export type EnrichmentSource = "musicbrainz" | "discogs" | "wikipedia" | "lastfm" | "fanart";
export type EnrichmentStatus = "loading" | "completed" | "failed" | "not_configured";

const compactError = (error: unknown): string => error instanceof Error ? error.message.slice(0, 240) : "Unknown enrichment error";

export const setEnrichmentState = async (playback: AgentPlaybackPayload, source: EnrichmentSource, status: EnrichmentStatus, error?: unknown): Promise<void> => {
  if (!database || !playback.album?.externalId) return;
  const [album] = await database.select({ id: albums.id }).from(albums).where(eq(albums.musicBrainzReleaseGroupId, playback.album.externalId)).limit(1);
  if (!album) return;
  await database.insert(albumEnrichmentStates).values({ albumId: album.id, source, status, error: error ? compactError(error) : null, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [albumEnrichmentStates.albumId, albumEnrichmentStates.source], set: { status, error: error ? compactError(error) : null, updatedAt: new Date() } });
};
