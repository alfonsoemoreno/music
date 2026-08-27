import { after, NextResponse } from "next/server";
import { verifyBridgeRequest } from "@/lib/bridge-auth";
import { enrichPlayback, playbackSchema } from "@/lib/playback-ingest";
import { getCurrentPlaybackForDevice, setCurrentPlayback } from "@/lib/playback-store";
import { isSamePlaybackAlbum } from "@/lib/playback-identity";

export const maxDuration = 60;

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = await request.text();
  const bridge = await verifyBridgeRequest(request, body);
  if (!bridge) return NextResponse.json({ error: "Invalid bridge signature" }, { status: 401 });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = playbackSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid playback payload", details: parsed.error.flatten() }, { status: 400 });

  const previous = await getCurrentPlaybackForDevice(parsed.data.deviceId);
  const sameResolvedAlbum = Boolean(previous?.album?.externalId && isSamePlaybackAlbum(previous, parsed.data));
  // Retain the resolved album identity while swapping tracks. This makes the
  // album view and its cover available in the first client poll after a track
  // change instead of treating every track as a new metadata job.
  const payload = sameResolvedAlbum && previous ? {
    ...parsed.data,
    artist: { ...parsed.data.artist, externalId: previous.artist.externalId },
    album: parsed.data.album ? { ...parsed.data.album, externalId: previous.album?.externalId, artworkUrl: parsed.data.album.artworkUrl ?? previous.album?.artworkUrl } : previous.album,
  } : parsed.data;
  const eventId = await setCurrentPlayback(payload, undefined, bridge.id);
  console.info(`[Android bridge:${bridge.name}] ${payload.artist.name} — ${payload.track.title}`);
  if (!sameResolvedAlbum) after(() => enrichPlayback(payload, eventId));
  return NextResponse.json({ accepted: true, enrichment: sameResolvedAlbum ? "reused" : "scheduled" }, { status: 202 });
};
