import type { AgentPlaybackPayload } from "@music/domain";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { database } from "@/db/client";
import { albumEnrichmentStates, albums, artists, artwork, bridges, credits, currentPlayback, devices, releases, tracks, type AlbumEditorial } from "@/db/schema";
import { isSamePlaybackTrack } from "./playback-identity";

declare global { var musicDevelopmentPlayback: AgentPlaybackPayload | undefined; var musicDevelopmentPlaybackEventId: string | undefined; }

/** Uses Neon when configured. The global fallback only makes local setup usable before Neon is provisioned. */
export const setCurrentPlayback = async (payload: AgentPlaybackPayload, eventId = randomUUID(), bridgeId?: string): Promise<string> => {
  if (!database) { globalThis.musicDevelopmentPlayback = payload; globalThis.musicDevelopmentPlaybackEventId = eventId; return eventId; }
  const now = new Date();
  await database.insert(devices).values({ id: payload.deviceId, bridgeId, name: payload.deviceId, deviceType: "WiiM", lastSeenAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: devices.id, set: { bridgeId, lastSeenAt: now, updatedAt: now } });
  await database.insert(currentPlayback).values({ deviceId: payload.deviceId, eventId, payload, updatedAt: now })
    .onConflictDoUpdate({ target: currentPlayback.deviceId, set: { eventId, payload, updatedAt: now } });
  return eventId;
};

/** Prevents a slow enrichment for an older song from overwriting a newer playback event. */
export const setCurrentPlaybackIfEventIsCurrent = async (payload: AgentPlaybackPayload, eventId: string): Promise<void> => {
  if (!database) { if (globalThis.musicDevelopmentPlaybackEventId === eventId) globalThis.musicDevelopmentPlayback = payload; return; }
  const [current] = await database.select({ eventId: currentPlayback.eventId, payload: currentPlayback.payload }).from(currentPlayback).where(eq(currentPlayback.deviceId, payload.deviceId)).limit(1);
  if (!current) return;
  if (current.eventId === eventId) {
    await database.update(currentPlayback).set({ payload, updatedAt: new Date() }).where(and(eq(currentPlayback.deviceId, payload.deviceId), eq(currentPlayback.eventId, eventId)));
    return;
  }
  const currentPayload = current.payload as AgentPlaybackPayload;
  if (!isSamePlaybackTrack(currentPayload, payload)) return;
  const merged: AgentPlaybackPayload = {
    ...currentPayload,
    artist: { ...currentPayload.artist, externalId: payload.artist.externalId ?? currentPayload.artist.externalId },
    album: currentPayload.album && payload.album ? { ...currentPayload.album, externalId: payload.album.externalId ?? currentPayload.album.externalId, artworkUrl: currentPayload.album.artworkUrl ?? payload.album.artworkUrl } : currentPayload.album ?? payload.album,
    track: { ...currentPayload.track, externalId: payload.track.externalId ?? currentPayload.track.externalId },
  };
  await database.update(currentPlayback).set({ payload: merged, updatedAt: new Date() }).where(and(eq(currentPlayback.deviceId, payload.deviceId), eq(currentPlayback.eventId, current.eventId)));
};

export const getCurrentPlaybackForDevice = async (deviceId: string): Promise<AgentPlaybackPayload | undefined> => {
  if (!database) return globalThis.musicDevelopmentPlayback;
  const rows = await database.select({ payload: currentPlayback.payload }).from(currentPlayback).where(eq(currentPlayback.deviceId, deviceId)).limit(1);
  return rows[0]?.payload as AgentPlaybackPayload | undefined;
};

export const getCurrentPlayback = async (viewerId?: string): Promise<AgentPlaybackPayload | undefined> => {
  if (!database) return globalThis.musicDevelopmentPlayback;
  if (!viewerId) return undefined;
  const rows = await database.select({ payload: currentPlayback.payload }).from(currentPlayback)
    .innerJoin(devices, eq(currentPlayback.deviceId, devices.id))
    .innerJoin(bridges, eq(devices.bridgeId, bridges.id))
    .where(eq(bridges.viewerId, viewerId)).orderBy(desc(currentPlayback.updatedAt)).limit(1);
  return rows[0]?.payload as AgentPlaybackPayload | undefined;
};

export interface AlbumCompanionData {
  id: string;
  artistId: string;
  title: string;
  artist: string;
  year?: number;
  releaseDate?: string;
  artworkUrl?: string;
  label?: string;
  format?: string;
  description?: string;
  wikipediaUrl?: string;
  artistBiography?: string;
  artistWikipediaUrl?: string;
  artistCountry?: string;
  editorial?: AlbumEditorial;
  genres: string[];
  tags: string[];
  enrichment: Array<{ source: string; status: string; error?: string; updatedAt: string }>;
  tracks: Array<{ id: string; title: string; position?: number; durationMs?: number; musicBrainzId?: string }>;
  editions: Array<{ id: string; discogsReleaseId?: string; title: string; country?: string; year?: number; label?: string; catalogNumber?: string; format?: string; formatDescription?: string }>;
  credits: Array<{ id: string; releaseId?: string; personName: string; role: string }>;
  artwork: Array<{ id: string; releaseId?: string; type: string; url: string; thumbnailUrl?: string; source: string }>;
}

export const getAlbumCompanion = async (playback: AgentPlaybackPayload | undefined): Promise<AlbumCompanionData | undefined> => {
  if (!database || !playback?.album?.title) return undefined;
  let rows = playback.album.externalId ? await database.select({ album: albums, artist: artists }).from(albums).innerJoin(artists, eq(albums.artistId, artists.id))
    .where(eq(albums.musicBrainzReleaseGroupId, playback.album.externalId)).limit(1) : [];
  if (!rows[0]) rows = await database.select({ album: albums, artist: artists }).from(albums).innerJoin(artists, eq(albums.artistId, artists.id))
    .where(and(ilike(albums.title, playback.album.title), ilike(artists.name, playback.artist.name))).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  const albumReleases = await database.select().from(releases).where(eq(releases.albumId, row.album.id)).orderBy(asc(releases.year));
  const [edition] = albumReleases;
  const albumTracks = await database.select().from(tracks).where(eq(tracks.albumId, row.album.id)).orderBy(asc(tracks.position));
  const albumCredits = await database.select().from(credits).where(eq(credits.albumId, row.album.id)).limit(18);
  const albumArtwork = await database.select().from(artwork).where(eq(artwork.albumId, row.album.id)).limit(24);
  const enrichment = await database.select().from(albumEnrichmentStates).where(eq(albumEnrichmentStates.albumId, row.album.id));
  const uniqueTracks = [...new Map(albumTracks.map((track) => [track.musicBrainzId ?? `${track.position}:${track.title}`, track])).values()];
  const uniqueReleases = [...new Map(albumReleases.map((release) => [release.discogsReleaseId ?? release.musicBrainzReleaseId ?? release.id, release])).values()];
  return { id: row.album.id, artistId: row.artist.id, title: row.album.title, artist: row.artist.name, year: row.album.year ?? undefined, releaseDate: row.album.releaseDate ?? undefined, artworkUrl: row.album.primaryArtworkUrl ?? undefined, label: edition?.label ?? undefined, format: edition?.format ?? undefined, genres: row.album.genres ?? [], tags: row.album.tags ?? [], description: row.album.description ?? undefined, wikipediaUrl: row.album.wikipediaUrl ?? undefined, artistBiography: row.artist.biography ?? undefined, artistWikipediaUrl: row.artist.wikipediaUrl ?? undefined, artistCountry: row.artist.country ?? undefined, editorial: row.album.editorial ?? undefined, enrichment: enrichment.map((item) => ({ source: item.source, status: item.status, error: item.error ?? undefined, updatedAt: item.updatedAt.toISOString() })), tracks: uniqueTracks.map((track) => ({ id: track.id, title: track.title, position: track.position ?? undefined, durationMs: track.durationMs ?? undefined, musicBrainzId: track.musicBrainzId ?? undefined })), editions: uniqueReleases.map((item) => ({ id: item.id, discogsReleaseId: item.discogsReleaseId ?? undefined, title: item.title, country: item.country ?? undefined, year: item.year ?? undefined, label: item.label ?? undefined, catalogNumber: item.catalogNumber ?? undefined, format: item.format ?? undefined, formatDescription: item.formatDescription ?? undefined })), credits: albumCredits.map((item) => ({ id: item.id, releaseId: item.releaseId ?? undefined, personName: item.personName, role: item.role })), artwork: albumArtwork.map((item) => ({ id: item.id, releaseId: item.releaseId ?? undefined, type: item.type, url: item.url, thumbnailUrl: item.thumbnailUrl ?? undefined, source: item.source })) };
};
