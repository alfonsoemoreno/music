import type { AgentPlaybackPayload } from "@music/domain";
import { and, eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albums, artwork } from "@/db/schema";

interface FanartImage { url?: string; likes?: string; width?: number | string; height?: number | string }
interface FanartAlbum { release_group_id?: string; albumcover?: FanartImage[]; cdart?: FanartImage[] }
interface FanartResponse { albums?: FanartAlbum[] | Record<string, Omit<FanartAlbum, "release_group_id">> }

const numeric = (value: number | string | undefined): number | undefined => value === undefined ? undefined : Number(value) || undefined;
const imageScore = (image: FanartImage): number => Number(image.likes) || 0;

/** Adds optional artwork keyed by MusicBrainz IDs; it never replaces provider artwork from WiiM. */
export const enrichFromFanart = async (nowPlaying: AgentPlaybackPayload): Promise<void> => {
  const apiKey = process.env.FANARTTV_API_KEY;
  if (!database || !apiKey || !nowPlaying.album?.externalId || !nowPlaying.artist.externalId) return;
  const [album] = await database.select().from(albums).where(eq(albums.musicBrainzReleaseGroupId, nowPlaying.album.externalId)).limit(1);
  if (!album) return;
  const existing = await database.select({ id: artwork.id }).from(artwork).where(and(eq(artwork.albumId, album.id), eq(artwork.source, "fanart"))).limit(1);
  if (existing[0]) return;
  const params = new URLSearchParams({ client_key: apiKey });
  const response = await fetch(`https://webservice.fanart.tv/v3.2/music/${nowPlaying.artist.externalId}?${params}`, { next: { revalidate: 0 }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Fanart.tv returned HTTP ${response.status}`);
  const payload = await response.json() as FanartResponse;
  const entries = Array.isArray(payload.albums) ? payload.albums : Object.entries(payload.albums ?? {}).map(([releaseGroupId, entry]) => ({ ...entry, release_group_id: releaseGroupId }));
  const source = entries.find((entry) => entry.release_group_id === nowPlaying.album!.externalId);
  if (!source) return;
  const images = [
    ...(source.albumcover ?? []).map((image) => ({ image, type: "front" })),
    ...(source.cdart ?? []).map((image) => ({ image, type: "label" })),
  ].filter((item) => item.image.url).sort((left, right) => imageScore(right.image) - imageScore(left.image)).slice(0, 6);
  for (const { image, type } of images) await database.insert(artwork).values({ albumId: album.id, type, url: image.url!, source: "fanart", sourceId: nowPlaying.album.externalId, width: numeric(image.width), height: numeric(image.height) });
};
