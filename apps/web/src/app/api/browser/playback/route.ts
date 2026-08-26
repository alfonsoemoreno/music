import { after, NextResponse } from "next/server";
import { isValidBrowserSession } from "@/lib/auth";
import { enrichPlayback, playbackSchema } from "@/lib/playback-ingest";
import { setCurrentPlayback } from "@/lib/playback-store";

export const maxDuration = 60;

const browserSession = (cookieHeader: string | null): string | undefined => cookieHeader?.match(/(?:^|;\s*)music_browser_session=([^;]+)/)?.[1];

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isValidBrowserSession(browserSession(request.headers.get("cookie")))) {
    return NextResponse.json({ error: "Browser session required" }, { status: 401 });
  }

  const parsed = playbackSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid playback payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const eventId = await setCurrentPlayback(parsed.data);
  console.info(`[Browser playback] ${parsed.data.artist.name} — ${parsed.data.track.title}`);
  after(() => enrichPlayback(parsed.data, eventId));
  return NextResponse.json({ accepted: true, enrichment: "scheduled" }, { status: 202 });
};
