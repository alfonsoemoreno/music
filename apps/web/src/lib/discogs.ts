import type { AgentPlaybackPayload } from "@music/domain";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albums, artwork, credits, releases } from "@/db/schema";

interface SearchResult { id: number; title: string; year?: number; country?: string }
interface SearchResponse { results?: SearchResult[] }
interface ReleaseImage { type?: string; uri?: string; uri150?: string; width?: number; height?: number }
interface ReleaseCredit { id?: number; name: string; role?: string }
interface DiscogsRelease { id: number; title: string; year?: number; country?: string; uri?: string; labels?: Array<{ name?: string; catno?: string }>; formats?: Array<{ name?: string; qty?: string; descriptions?: string[] }>; images?: ReleaseImage[]; extraartists?: ReleaseCredit[] }
const apiRoot = "https://api.discogs.com";
const normalize = (value: string): string => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const cleanName = (name: string): string => name.replace(/\s*\(\d+\)$/, "");

const get = async <T>(path: string): Promise<T> => {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) throw new Error("Discogs is not configured");
  const response = await fetch(`${apiRoot}${path}`, { headers: { accept: "application/json", authorization: `Discogs token=${token}`, "user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Discogs returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
};

const candidateScore = (candidate: SearchResult, artist: string, album: string): number => {
  const text = normalize(candidate.title); const artistText = normalize(artist); const albumText = normalize(album);
  return Number(text.includes(artistText)) * 2 + Number(text.includes(albumText)) * 3 + Number(text === `${artistText} ${albumText}` || text === `${albumText} ${artistText}`) * 10;
};

const storeRelease = async (albumId: string, release: DiscogsRelease): Promise<void> => {
  if (!database) return;
  const format = release.formats?.[0];
  const [stored] = await database.insert(releases).values({ albumId, discogsReleaseId: String(release.id), title: release.title, country: release.country, year: release.year, label: release.labels?.[0]?.name, catalogNumber: release.labels?.[0]?.catno, format: format?.name, formatDescription: format?.descriptions?.join(", "), editionDescription: format?.qty ? `${format.qty}×${format.name ?? ""}` : undefined }).onConflictDoNothing({ target: releases.discogsReleaseId }).returning();
  if (!stored) return;
  for (const image of release.images ?? []) if (image.uri) await database.insert(artwork).values({ albumId, releaseId: stored.id, type: image.type === "primary" ? "front" : "other", url: image.uri, thumbnailUrl: image.uri150, source: "discogs", sourceId: String(release.id), width: image.width, height: image.height });
  for (const credit of release.extraartists ?? []) if (credit.role) await database.insert(credits).values({ albumId, releaseId: stored.id, personName: cleanName(credit.name), role: credit.role, source: "discogs", sourceId: credit.id ? String(credit.id) : undefined, sourceUrl: release.uri });
};

/** Saves a small, varied set of exact release candidates; it never claims streaming is one specific pressing. */
export const enrichFromDiscogs = async (nowPlaying: AgentPlaybackPayload): Promise<void> => {
  if (!database || !nowPlaying.album?.externalId || !process.env.DISCOGS_TOKEN) return;
  const [album] = await database.select().from(albums).where(eq(albums.musicBrainzReleaseGroupId, nowPlaying.album.externalId)).limit(1);
  if (!album) return;
  const query = new URLSearchParams({ type: "release", artist: nowPlaying.artist.name, release_title: nowPlaying.album.title, per_page: "20" });
  const search = await get<SearchResponse>(`/database/search?${query}`);
  const candidates = (search.results ?? []).filter((item) => candidateScore(item, nowPlaying.artist.name, nowPlaying.album!.title) >= 5)
    .sort((a, b) => candidateScore(b, nowPlaying.artist.name, nowPlaying.album!.title) - candidateScore(a, nowPlaying.artist.name, nowPlaying.album!.title) || (a.year ?? 9_999) - (b.year ?? 9_999) || (a.country ?? "").localeCompare(b.country ?? ""));
  const existing = await database.select({ discogsReleaseId: releases.discogsReleaseId }).from(releases).where(eq(releases.albumId, album.id));
  const existingIds = new Set(existing.flatMap((item) => item.discogsReleaseId ? [item.discogsReleaseId] : []));
  const selected = candidates.filter((item) => !existingIds.has(String(item.id))).slice(0, Math.max(0, 3 - existingIds.size));
  for (const candidate of selected) await storeRelease(album.id, await get<DiscogsRelease>(`/releases/${candidate.id}`));
};
