import type { AgentPlaybackPayload } from "@music/domain";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albums, artists } from "@/db/schema";

interface Page {
  title: string;
  extract?: string;
  fullurl?: string;
  pageprops?: { wikibase_item?: string };
}
interface WikipediaResponse { query?: { pages?: Record<string, Page> } }
interface EditorialPage { extract: string; url: string; wikidataId?: string }
interface WikidataEntity {
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>>;
  labels?: Record<string, { value?: string }>;
}
interface WikidataResponse { entities?: Record<string, WikidataEntity> }

const languages = ["es", "en"];
const normalize = (value: string): string => value.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
const compact = (value: string): string => value.replace(/\s+/g, " ").trim().slice(0, 1_400);

/** Resolves a linked country label from the entity's country or citizenship statements. */
const wikidataCountry = async (wikidataId: string | undefined): Promise<string | undefined> => {
  if (!wikidataId) return undefined;
  const entityParams = new URLSearchParams({ action: "wbgetentities", format: "json", ids: wikidataId, props: "claims" });
  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams}`, { headers: { "api-user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 0 }, signal: AbortSignal.timeout(8_000) });
  if (!entityResponse.ok) throw new Error(`Wikidata returned HTTP ${entityResponse.status}`);
  const entity = (await entityResponse.json() as WikidataResponse).entities?.[wikidataId];
  const countryId = ["P27", "P17"].flatMap((property) => entity?.claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value?.id).find((id): id is string => Boolean(id));
  if (!countryId) return undefined;
  const labelParams = new URLSearchParams({ action: "wbgetentities", format: "json", ids: countryId, props: "labels", languages: "es|en" });
  const labelResponse = await fetch(`https://www.wikidata.org/w/api.php?${labelParams}`, { headers: { "api-user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 0 }, signal: AbortSignal.timeout(8_000) });
  if (!labelResponse.ok) throw new Error(`Wikidata returned HTTP ${labelResponse.status}`);
  const labels = (await labelResponse.json() as WikidataResponse).entities?.[countryId]?.labels;
  return labels?.es?.value ?? labels?.en?.value;
};

const pageScore = (page: Page, requiredTerms: string[], preferredTitle?: string): number => {
  const title = normalize(page.title);
  const preferred = preferredTitle ? normalize(preferredTitle) : undefined;
  const titleMatch = preferred ? title === preferred ? 1_000 : title.includes(preferred) ? 500 : -1_000 : 0;
  return titleMatch + requiredTerms.reduce((score, term) => score + (title.includes(normalize(term)) ? 10 : 0), 0) + (page.extract?.length ?? 0) / 10_000;
};

const searchWikipedia = async (query: string, requiredTerms: string[], preferredTitle?: string): Promise<EditorialPage | undefined> => {
  for (const language of languages) {
    const params = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrnamespace: "0", gsrlimit: "5", gsrsearch: query, prop: "extracts|info|pageprops", exintro: "1", explaintext: "1", inprop: "url" });
    const response = await fetch(`https://${language}.wikipedia.org/w/api.php?${params}`, { headers: { "api-user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 0 }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}`);
    const pages = Object.values((await response.json() as WikipediaResponse).query?.pages ?? {});
    const candidate = pages.filter((page) => page.extract && page.fullurl).sort((a, b) => pageScore(b, requiredTerms, preferredTitle) - pageScore(a, requiredTerms, preferredTitle))[0];
    if (preferredTitle && (!candidate || !normalize(candidate.title).includes(normalize(preferredTitle)))) continue;
    if (candidate?.extract && candidate.fullurl) return { extract: compact(candidate.extract), url: candidate.fullurl, wikidataId: candidate.pageprops?.wikibase_item };
  }
  return undefined;
};

/** Stores concise, attributed introductory context; it never copies a full Wikipedia article. */
export const enrichFromWikipedia = async (nowPlaying: AgentPlaybackPayload): Promise<void> => {
  const db = database;
  if (!db || !nowPlaying.album?.externalId) return;
  const rows = await db.select({ album: albums, artist: artists }).from(albums).innerJoin(artists, eq(albums.artistId, artists.id)).where(eq(albums.musicBrainzReleaseGroupId, nowPlaying.album.externalId)).limit(1);
  const row = rows[0];
  if (!row) return;
  const now = new Date();
  const tasks: Promise<void>[] = [];
  if (!row.artist.biography || !row.artist.country) tasks.push(searchWikipedia(row.artist.name, [row.artist.name]).then(async (page) => {
    if (!page) return;
    const country = row.artist.country ?? await wikidataCountry(page.wikidataId).catch(() => undefined);
    await db.update(artists).set({ biography: row.artist.biography ?? page.extract, wikipediaUrl: row.artist.wikipediaUrl ?? page.url, wikidataId: page.wikidataId, country, metadataUpdatedAt: now, updatedAt: now }).where(eq(artists.id, row.artist.id));
  }));
  const albumNeedsCorrection = !row.album.description || row.album.wikipediaUrl === row.artist.wikipediaUrl;
  if (albumNeedsCorrection) tasks.push(searchWikipedia(`${row.album.title} ${row.artist.name}`, [row.album.title, row.artist.name], row.album.title).then(async (page) => {
    if (page) await db.update(albums).set({ description: page.extract, wikipediaUrl: page.url, wikidataId: page.wikidataId, metadataUpdatedAt: now, updatedAt: now }).where(eq(albums.id, row.album.id));
    else await db.update(albums).set({ description: null, wikipediaUrl: null, wikidataId: null, metadataUpdatedAt: now, updatedAt: now }).where(eq(albums.id, row.album.id));
  }));
  await Promise.allSettled(tasks);
};
