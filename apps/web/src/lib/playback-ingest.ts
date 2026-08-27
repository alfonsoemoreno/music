import { z } from "zod";
import { setCurrentPlayback, setCurrentPlaybackIfEventIsCurrent } from "@/lib/playback-store";
import { enrichFromMusicBrainz, isMusicBrainzId } from "@/lib/musicbrainz";
import { enrichFromDiscogs } from "@/lib/discogs";
import { enrichFromWikipedia } from "@/lib/wikipedia";
import { enrichFromLastFm } from "@/lib/lastfm";
import { enrichFromFanart } from "@/lib/fanart";
import { setEnrichmentState } from "@/lib/enrichment-state";
import { decodeHtmlEntities } from "@/lib/html-entities";

const metadataText = z.string().transform(decodeHtmlEntities);
const requiredMetadataText = z.string().min(1).transform(decodeHtmlEntities);

export const playbackSchema = z.object({ deviceId: z.string().min(1).max(200), playbackProvider: requiredMetadataText, source: metadataText.optional(), track: z.object({ title: requiredMetadataText, durationMs: z.number().int().nonnegative().optional(), positionMs: z.number().int().nonnegative().optional(), externalId: z.string().optional() }), artist: z.object({ name: requiredMetadataText, externalId: z.string().optional() }), album: z.object({ title: requiredMetadataText, artworkUrl: z.string().url().optional(), externalId: z.string().optional() }).optional(), playback: z.object({ state: z.enum(["playing", "paused", "stopped"]) }), audio: z.object({ codec: metadataText.optional(), sampleRate: z.number().int().positive().optional(), bitDepth: z.number().int().positive().optional(), bitrate: z.number().int().positive().optional() }).optional(), rawMetadata: z.unknown().optional(), agentVersion: z.string().min(1) });
export type PlaybackPayload = z.infer<typeof playbackSchema>;

export const enrichPlayback = async (payload: PlaybackPayload, eventId: string): Promise<void> => {
  let enriched = payload;
  try { enriched = await enrichFromMusicBrainz(payload); const resolved = isMusicBrainzId(enriched.album?.externalId); await setEnrichmentState(enriched, "musicbrainz", resolved ? "completed" : "failed", resolved ? undefined : new Error("No confident MusicBrainz match")); if (resolved) console.info(`[MusicBrainz] Resolved ${enriched.album?.title}`); }
  catch (error) { await setEnrichmentState(enriched, "musicbrainz", "failed", error).catch(() => undefined); console.warn(`[MusicBrainz] ${error instanceof Error ? error.message : "Enrichment failed"}`); }
  await setCurrentPlaybackIfEventIsCurrent(enriched, eventId);
  if (!isMusicBrainzId(enriched.album?.externalId)) { console.info("[Metadata] Skipped secondary providers: no confident MusicBrainz release group"); return; }
  await Promise.allSettled([
    (async (): Promise<void> => { try { await setEnrichmentState(enriched, "discogs", process.env.DISCOGS_TOKEN ? "loading" : "not_configured"); await enrichFromDiscogs(enriched); if (process.env.DISCOGS_TOKEN) await setEnrichmentState(enriched, "discogs", "completed"); } catch (error) { await setEnrichmentState(enriched, "discogs", "failed", error).catch(() => undefined); console.warn(`[Discogs] ${error instanceof Error ? error.message : "Enrichment failed"}`); } })(),
    (async (): Promise<void> => { try { await setEnrichmentState(enriched, "wikipedia", "loading"); await enrichFromWikipedia(enriched); await setEnrichmentState(enriched, "wikipedia", "completed"); } catch (error) { await setEnrichmentState(enriched, "wikipedia", "failed", error).catch(() => undefined); console.warn(`[Wikipedia] ${error instanceof Error ? error.message : "Enrichment failed"}`); } })(),
    (async (): Promise<void> => { try { await setEnrichmentState(enriched, "lastfm", process.env.LASTFM_API_KEY ? "loading" : "not_configured"); await enrichFromLastFm(enriched); if (process.env.LASTFM_API_KEY) await setEnrichmentState(enriched, "lastfm", "completed"); } catch (error) { await setEnrichmentState(enriched, "lastfm", "failed", error).catch(() => undefined); console.warn(`[Last.fm] ${error instanceof Error ? error.message : "Enrichment failed"}`); } })(),
    (async (): Promise<void> => { try { await setEnrichmentState(enriched, "fanart", process.env.FANARTTV_API_KEY ? "loading" : "not_configured"); await enrichFromFanart(enriched); if (process.env.FANARTTV_API_KEY) await setEnrichmentState(enriched, "fanart", "completed"); } catch (error) { await setEnrichmentState(enriched, "fanart", "failed", error).catch(() => undefined); console.warn(`[Fanart] ${error instanceof Error ? error.message : "Enrichment failed"}`); } })(),
  ]);
};
