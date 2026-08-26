import { after, NextResponse } from "next/server";
import { isValidAgentToken } from "@/lib/auth";
import { enrichPlayback, playbackSchema } from "@/lib/playback-ingest";
import { setCurrentPlayback } from "@/lib/playback-store";

/** Accept immediately; Vercel/Next keeps bounded enrichment alive after the response. */
export const maxDuration = 60;

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isValidAgentToken(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = playbackSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid playback payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const eventId = await setCurrentPlayback(parsed.data);
  console.info(`[Playback] ${parsed.data.artist.name} — ${parsed.data.track.title}`);
  after(() => enrichPlayback(parsed.data, eventId));
  return NextResponse.json({ accepted: true, enrichment: "scheduled" }, { status: 202 });
};
