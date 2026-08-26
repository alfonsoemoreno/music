import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albums, artists } from "@/db/schema";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ page: z.coerce.number().int().positive().max(100).default(1), releaseId: z.coerce.number().int().positive().optional() });
interface DiscogsResult { id: number; title: string; year?: number; country?: string; format?: string[]; label?: string[]; catno?: string; thumb?: string; uri?: string }
interface DiscogsResponse { pagination?: { page: number; pages: number; items: number }; results?: DiscogsResult[] }
interface DiscogsRelease { id: number; title: string; year?: number; country?: string; labels?: Array<{ name?: string; catno?: string }>; formats?: Array<{ name?: string; qty?: string; descriptions?: string[] }>; images?: Array<{ type?: string; uri?: string; uri150?: string; width?: number; height?: number }>; tracklist?: Array<{ position?: string; title?: string; duration?: string }>; extraartists?: Array<{ name?: string; role?: string }> }

const normalize = (value: string): string => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const score = (result: DiscogsResult, artist: string, title: string): number => Number(normalize(result.title).includes(normalize(artist))) * 2 + Number(normalize(result.title).includes(normalize(title))) * 3;
const bootleg = (result: DiscogsResult): boolean => (result.format ?? []).some((format) => /unofficial|bootleg/i.test(format));

/** Browse Discogs releases one page at a time; the complete catalogue is intentionally not cached. */
export const GET = async (request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> => {
  const params = paramsSchema.safeParse(await context.params);
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!params.success || !query.success || !database) return NextResponse.json({ error: "Invalid edition request" }, { status: 400 });
  const token = process.env.DISCOGS_TOKEN;
  if (!token) return NextResponse.json({ error: "Discogs is not configured" }, { status: 503 });
  const [row] = await database.select({ album: albums, artist: artists }).from(albums).innerJoin(artists, eq(albums.artistId, artists.id)).where(eq(albums.id, params.data.id)).limit(1);
  if (!row) return NextResponse.json({ error: "Album not found" }, { status: 404 });
  if (query.data.releaseId) {
    const response = await fetch(`https://api.discogs.com/releases/${query.data.releaseId}`, { headers: { accept: "application/json", authorization: `Discogs token=${token}`, "user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 300 }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return NextResponse.json({ error: `Discogs returned HTTP ${response.status}` }, { status: 502 });
    const release = await response.json() as DiscogsRelease;
    const format = release.formats?.map((item) => [item.qty && `${item.qty}×`, item.name, item.descriptions?.join(", ")].filter(Boolean).join(" ")).filter(Boolean) ?? [];
    return NextResponse.json({ id: release.id, title: release.title, year: release.year, country: release.country, labels: release.labels?.map((item) => ({ name: item.name, catalogNumber: item.catno })).filter((item) => item.name || item.catalogNumber) ?? [], format, images: (release.images ?? []).filter((image) => image.uri).map((image) => ({ url: image.uri!, thumbnailUrl: image.uri150 ?? image.uri!, type: image.type ?? "other", width: image.width, height: image.height })), tracks: (release.tracklist ?? []).filter((track) => track.title).map((track) => ({ position: track.position, title: track.title!, duration: track.duration })), credits: (release.extraartists ?? []).filter((credit) => credit.name && credit.role).map((credit) => ({ name: credit.name!, role: credit.role! })) });
  }
  const search = new URLSearchParams({ type: "release", artist: row.artist.name, release_title: row.album.title, per_page: "50", page: String(query.data.page) });
  const response = await fetch(`https://api.discogs.com/database/search?${search}`, { headers: { accept: "application/json", authorization: `Discogs token=${token}`, "user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 300 }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) return NextResponse.json({ error: `Discogs returned HTTP ${response.status}` }, { status: 502 });
  const payload = await response.json() as DiscogsResponse;
  const items = (payload.results ?? []).filter((item) => score(item, row.artist.name, row.album.title) >= 5).map((item) => ({ id: item.id, title: item.title, year: item.year, country: item.country, format: item.format ?? [], label: item.label?.[0], catalogNumber: item.catno, thumbnailUrl: item.thumb, isBootleg: bootleg(item), url: item.uri ? `https://www.discogs.com${item.uri}` : `https://www.discogs.com/release/${item.id}` }));
  return NextResponse.json({ page: payload.pagination?.page ?? query.data.page, pages: payload.pagination?.pages ?? 1, total: payload.pagination?.items ?? items.length, items });
};
