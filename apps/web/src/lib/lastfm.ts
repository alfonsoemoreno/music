import type { AgentPlaybackPayload } from "@music/domain";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albums } from "@/db/schema";

interface LastFmResponse { toptags?: { tag?: Array<{ name?: string; count?: number }> }; error?: number; message?: string }

const getTopTags = async (artist: string, album: string): Promise<string[]> => {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) throw new Error("Last.fm is not configured");
  const params = new URLSearchParams({ method: "album.getTopTags", artist, album, api_key: apiKey, format: "json", autocorrect: "0" });
  const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Last.fm returned HTTP ${response.status}`);
  const payload = await response.json() as LastFmResponse;
  if (payload.error) throw new Error(`Last.fm: ${payload.message ?? "API error"}`);
  return (payload.toptags?.tag ?? []).filter((tag) => tag.name).sort((left, right) => (right.count ?? 0) - (left.count ?? 0)).slice(0, 6).map((tag) => tag.name!.trim());
};

/** Stores community tags separately from MusicBrainz genres so their provenance remains clear. */
export const enrichFromLastFm = async (nowPlaying: AgentPlaybackPayload): Promise<void> => {
  if (!database || !nowPlaying.album?.externalId || !process.env.LASTFM_API_KEY) return;
  const [album] = await database.select().from(albums).where(eq(albums.musicBrainzReleaseGroupId, nowPlaying.album.externalId)).limit(1);
  if (!album || album.tags?.length) return;
  const tags = await getTopTags(nowPlaying.artist.name, nowPlaying.album.title);
  await database.update(albums).set({ tags, metadataUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(albums.id, album.id));
};
