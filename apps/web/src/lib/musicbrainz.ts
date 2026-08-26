import type { AgentPlaybackPayload } from "@music/domain";
import { and, eq, ilike } from "drizzle-orm";
import { database } from "@/db/client";
import { albums, artists, credits, releases, tracks } from "@/db/schema";
import { chooseReleaseGroupCandidate, normalizeMusicText, trackTitleMatches } from "./musicbrainz-matching";

const apiRoot = "https://musicbrainz.org/ws/2";
let lastRequestAt = 0;
let nextAllowedRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();
interface ArtistCredit { name: string; artist: { id: string; name: string } }
interface ReleaseGroup { id: string; title: string; score: number; "first-release-date"?: string; "artist-credit"?: ArtistCredit[] }
interface ReleaseGroupDetails { genres?: Array<{ name: string; count?: number }> }
interface ReleaseSearch { "release-groups": ReleaseGroup[] }
interface RecordingSearchResult { id: string; title: string; score: number; "artist-credit"?: ArtistCredit[]; releases?: Array<{ title: string; "release-group"?: { id: string } }> }
interface RecordingSearch { recordings: RecordingSearchResult[] }
interface ReleaseTrack { title?: string; number?: string; length?: number; recording?: { id: string; title: string; length?: number } }
interface Release { id: string; title: string; date?: string; country?: string; "label-info"?: Array<{ "catalog-number"?: string; label?: { name: string } }>; media?: Array<{ format?: string; tracks?: ReleaseTrack[] }> }
interface ReleasesResponse { releases: Release[] }
const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
const escapeSearch = (value: string): string => value.replace(/[\\"]/g, "\\$&");
const releaseYear = (date: string | undefined): number | undefined => date ? Number(date.slice(0, 4)) || undefined : undefined;
const artworkUrl = (id: string): string => `https://coverartarchive.org/release-group/${id}/front-500`;
const normalize = (value: string): string => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const baseAlbumTitle = (value: string): string => value.replace(/\s*[\[(].*?[\])]\s*$/u, "").trim() || value;
export const isMusicBrainzId = (value: string | undefined): value is string => Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value));
const releaseTracks = (release: Release): ReleaseTrack[] => release.media?.flatMap((medium) => medium.tracks ?? []) ?? [];
const orderedGenres = (genres: ReleaseGroupDetails["genres"]): string[] => (genres ?? []).sort((left, right) => (right.count ?? 0) - (left.count ?? 0) || left.name.localeCompare(right.name)).slice(0, 4).map((genre) => genre.name);

/** Prefer an official, standard-length edition over singles, samples, or oversized deluxe editions. */
const chooseCanonicalRelease = (releasesToRank: Release[], albumTitle: string, currentTrack: string): Release | undefined => releasesToRank
  .filter((release) => releaseTracks(release).length > 0)
  .sort((left, right) => {
    const score = (release: Release): number => {
      const count = releaseTracks(release).length;
      const exactTitle = normalize(release.title) === normalize(albumTitle) ? 100 : 0;
      const containsCurrentTrack = releaseTracks(release).some((track) => trackTitleMatches(track.title ?? track.recording?.title ?? "", currentTrack)) ? 30 : 0;
      return exactTitle + containsCurrentTrack + Math.min(count, 16) * 2 - Math.max(0, count - 16) * 3 - Math.abs(count - 12);
    };
    return score(right) - score(left) || releaseTracks(left).length - releaseTracks(right).length || (left.date ?? "").localeCompare(right.date ?? "");
  })[0];

/** Prevent concurrent playback events from bypassing MusicBrainz's one-request-per-second rule. */
const serializeMusicBrainzRequest = async <T>(operation: () => Promise<T>): Promise<T> => {
  const previous = requestQueue;
  let releaseQueue!: () => void;
  requestQueue = new Promise<void>((resolve) => { releaseQueue = resolve; });
  await previous;
  try {
    const delay = Math.max(0, nextAllowedRequestAt - Date.now(), 1_100 - (Date.now() - lastRequestAt));
    if (delay) await wait(delay);
    lastRequestAt = Date.now();
    return await operation();
  } finally {
    releaseQueue();
  }
};

const musicBrainzGet = async <T>(path: string): Promise<T> => {
  const appName = process.env.MUSICBRAINZ_APP_NAME;
  const contact = process.env.MUSICBRAINZ_CONTACT;
  if (!appName || !contact) throw new Error("MusicBrainz is not configured");
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await serializeMusicBrainzRequest(() => fetch(`${apiRoot}${path}`, { headers: { accept: "application/json", "user-agent": `${appName}/0.1.0 (${contact})` }, next: { revalidate: 0 }, signal: AbortSignal.timeout(10_000) }));
    } catch (error) {
      if (attempt === 1) throw error;
      nextAllowedRequestAt = Date.now() + 2_000;
      await wait(2_000);
      continue;
    }
    if (response.ok) return response.json() as Promise<T>;
    if (response.status !== 429 && response.status !== 503 || attempt === 1) throw new Error(`MusicBrainz returned HTTP ${response.status}`);
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const cooldownMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1_000 : 5_000;
    nextAllowedRequestAt = Date.now() + cooldownMs;
    await wait(cooldownMs);
  }
  throw new Error("MusicBrainz request exhausted unexpectedly");
};

export const enrichFromMusicBrainz = async (nowPlaying: AgentPlaybackPayload): Promise<AgentPlaybackPayload> => {
  if (!database || !nowPlaying.album?.title || nowPlaying.artist.name === "Unknown artist" || nowPlaying.track.title === "Unknown track") return nowPlaying;
  const cached = await database.select({ album: albums, artist: artists }).from(albums).innerJoin(artists, eq(albums.artistId, artists.id)).where(and(ilike(albums.title, nowPlaying.album.title), ilike(artists.name, nowPlaying.artist.name))).limit(1);
  const cachedTracks = cached[0] ? await database.select({ id: tracks.id }).from(tracks).where(eq(tracks.albumId, cached[0].album.id)).limit(4) : [];
  if (cached[0]?.album.musicBrainzReleaseGroupId && cachedTracks.length >= 4) {
    if (!cached[0].album.genres?.length) {
      const details = await musicBrainzGet<ReleaseGroupDetails>(`/release-group/${cached[0].album.musicBrainzReleaseGroupId}?fmt=json&inc=genres`);
      await database.update(albums).set({ genres: orderedGenres(details.genres), metadataUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(albums.id, cached[0].album.id));
    }
    const [cachedTrack] = await database.select({ musicBrainzId: tracks.musicBrainzId }).from(tracks).where(and(eq(tracks.albumId, cached[0].album.id), ilike(tracks.title, nowPlaying.track.title))).limit(1);
    return { ...nowPlaying, artist: { ...nowPlaying.artist, externalId: cached[0].artist.musicBrainzId ?? undefined }, album: { ...nowPlaying.album, externalId: cached[0].album.musicBrainzReleaseGroupId, artworkUrl: nowPlaying.album.artworkUrl ?? cached[0].album.primaryArtworkUrl ?? undefined }, track: { ...nowPlaying.track, externalId: cachedTrack?.musicBrainzId ?? nowPlaying.track.externalId } };
  }

  let candidate: ReleaseGroup | undefined;
  let artistCredit: ArtistCredit | undefined;
  let usedTitleFallback = false;
  if (cached[0]?.album.musicBrainzReleaseGroupId) {
    candidate = { id: cached[0].album.musicBrainzReleaseGroupId, title: cached[0].album.title, score: 100, "first-release-date": cached[0].album.releaseDate ?? undefined };
    artistCredit = { name: cached[0].artist.name, artist: { id: cached[0].artist.musicBrainzId ?? "", name: cached[0].artist.name } };
  } else {
    const query = `releasegroup:"${escapeSearch(nowPlaying.album.title)}" AND artist:"${escapeSearch(nowPlaying.artist.name)}"`;
    const search = await musicBrainzGet<ReleaseSearch>(`/release-group?fmt=json&limit=5&query=${encodeURIComponent(query)}`);
    candidate = chooseReleaseGroupCandidate(search["release-groups"], nowPlaying.album.title, 75);
    artistCredit = candidate?.["artist-credit"]?.[0];
    const baseTitle = baseAlbumTitle(nowPlaying.album.title);
    if (!candidate && normalize(baseTitle) !== normalize(nowPlaying.album.title)) {
      const baseQuery = `releasegroup:"${escapeSearch(baseTitle)}" AND artist:"${escapeSearch(nowPlaying.artist.name)}"`;
      const baseSearch = await musicBrainzGet<ReleaseSearch>(`/release-group?fmt=json&limit=5&query=${encodeURIComponent(baseQuery)}`);
      candidate = chooseReleaseGroupCandidate(baseSearch["release-groups"].filter((group) => normalize(group.title) === normalize(baseTitle)), baseTitle, 60);
      artistCredit = candidate?.["artist-credit"]?.[0];
      usedTitleFallback = Boolean(candidate);
    }
    if (!candidate) {
      const titleQuery = `releasegroup:"${escapeSearch(baseTitle)}"`;
      const titleSearch = await musicBrainzGet<ReleaseSearch>(`/release-group?fmt=json&limit=10&query=${encodeURIComponent(titleQuery)}`);
      candidate = chooseReleaseGroupCandidate(titleSearch["release-groups"].filter((group) => normalize(group.title) === normalize(baseTitle)), baseTitle, 60);
      artistCredit = candidate?.["artist-credit"]?.[0];
      usedTitleFallback = Boolean(candidate);
    }
    // Local USB tags often have a slightly wrong album title while the artist and track are
    // still usable.  Only use this path when the matched recording is attached to an
    // explicitly matching release title; it is a fallback, never a guess across albums.
    if (!candidate) {
      const recordingQuery = `recording:"${escapeSearch(nowPlaying.track.title)}" AND artist:"${escapeSearch(nowPlaying.artist.name)}"`;
      const recordingSearch = await musicBrainzGet<RecordingSearch>(`/recording?fmt=json&limit=10&query=${encodeURIComponent(recordingQuery)}`);
      const recording = recordingSearch.recordings.find((item) => item.score >= 85 && trackTitleMatches(item.title, nowPlaying.track.title) && item["artist-credit"]?.some((credit) => normalizeMusicText(credit.artist.name) === normalizeMusicText(nowPlaying.artist.name)));
      const release = recording?.releases?.find((item) => normalizeMusicText(item.title) === normalizeMusicText(baseTitle));
      const releaseGroupId = release?.["release-group"]?.id;
      if (recording && releaseGroupId) {
        candidate = { id: releaseGroupId, title: release.title, score: recording.score };
        artistCredit = recording["artist-credit"]?.[0];
        usedTitleFallback = true;
      }
    }
  }
  if (!candidate || !artistCredit || !artistCredit.artist.id) return nowPlaying;
  const groupDetails = await musicBrainzGet<ReleaseGroupDetails>(`/release-group/${candidate.id}?fmt=json&inc=genres`);
  const releaseResults = await musicBrainzGet<ReleasesResponse>(`/release?fmt=json&limit=100&status=official&release-group=${candidate.id}&inc=recordings+labels+artist-credits`);
  const release = chooseCanonicalRelease(releaseResults.releases, candidate.title, nowPlaying.track.title);
  if (!release || !artistCredit) return nowPlaying;
  const mediaTracks = releaseTracks(release);
  const currentTrackWasFound = mediaTracks.some((track) => trackTitleMatches(track.title ?? track.recording?.title ?? "", nowPlaying.track.title));
  if (usedTitleFallback && !currentTrackWasFound) return nowPlaying;
  // WiiM exposes provider artwork in Now Playing for some sources. Keep it ahead of the CAA fallback.
  const now = new Date(); const cover = nowPlaying.album.artworkUrl ?? cached[0]?.album.primaryArtworkUrl ?? artworkUrl(candidate.id);
  const [artist] = await database.insert(artists).values({ name: artistCredit.artist.name, sortName: artistCredit.artist.name, musicBrainzId: artistCredit.artist.id, metadataUpdatedAt: now }).onConflictDoUpdate({ target: artists.musicBrainzId, set: { name: artistCredit.artist.name, metadataUpdatedAt: now, updatedAt: now } }).returning();
  const [album] = await database.insert(albums).values({ artistId: artist.id, title: candidate.title, musicBrainzReleaseGroupId: candidate.id, year: releaseYear(candidate["first-release-date"]), releaseDate: candidate["first-release-date"], genres: orderedGenres(groupDetails.genres), primaryArtworkUrl: cover, metadataUpdatedAt: now }).onConflictDoUpdate({ target: albums.musicBrainzReleaseGroupId, set: { title: candidate.title, artistId: artist.id, genres: orderedGenres(groupDetails.genres), primaryArtworkUrl: cover, metadataUpdatedAt: now, updatedAt: now } }).returning();
  const label = release["label-info"]?.[0];
  const existingRelease = await database.select({ id: releases.id }).from(releases).where(eq(releases.musicBrainzReleaseId, release.id)).limit(1);
  if (!existingRelease[0]) await database.insert(releases).values({ albumId: album.id, musicBrainzReleaseId: release.id, title: release.title, country: release.country, year: releaseYear(release.date), label: label?.label?.name, catalogNumber: label?.["catalog-number"], format: release.media?.[0]?.format });
  if (mediaTracks.length) {
    await database.update(credits).set({ trackId: null }).where(eq(credits.albumId, album.id));
    await database.delete(tracks).where(eq(tracks.albumId, album.id));
  }
  for (const [index, track] of mediaTracks.entries()) {
    if (!track.recording) continue;
    await database.insert(tracks).values({ albumId: album.id, title: track.title ?? track.recording.title, position: Number(track.number) || index + 1, durationMs: track.length ?? track.recording.length, musicBrainzId: track.recording.id }).onConflictDoNothing({ target: [tracks.albumId, tracks.musicBrainzId] });
  }
  const matchingTrack = mediaTracks.find((track) => trackTitleMatches(track.title ?? track.recording?.title ?? "", nowPlaying.track.title));
  return { ...nowPlaying, artist: { ...nowPlaying.artist, name: artistCredit.artist.name, externalId: artistCredit.artist.id }, album: { ...nowPlaying.album, title: candidate.title, externalId: candidate.id, artworkUrl: cover }, track: { ...nowPlaying.track, externalId: matchingTrack?.recording?.id } };
};
