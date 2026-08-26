import { after, NextResponse } from "next/server";
import { verifyBridgeRequest } from "@/lib/bridge-auth";
import { enrichPlayback, playbackSchema } from "@/lib/playback-ingest";
import { setCurrentPlayback } from "@/lib/playback-store";

export const maxDuration = 60;

export const POST = async (request: Request): Promise<NextResponse> => {
  const body = await request.text();
  const bridge = await verifyBridgeRequest(request, body);
  if (!bridge) return NextResponse.json({ error: "Invalid bridge signature" }, { status: 401 });
  let input: unknown;
  try { input = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parsed = playbackSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid playback payload", details: parsed.error.flatten() }, { status: 400 });

  const eventId = await setCurrentPlayback(parsed.data);
  console.info(`[Android bridge:${bridge.name}] ${parsed.data.artist.name} — ${parsed.data.track.title}`);
  after(() => enrichPlayback(parsed.data, eventId));
  return NextResponse.json({ accepted: true, enrichment: "scheduled" }, { status: 202 });
};
