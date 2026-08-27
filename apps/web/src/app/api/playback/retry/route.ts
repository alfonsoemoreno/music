import { after, NextResponse } from "next/server";
import { enrichPlayback } from "@/lib/playback-ingest";
import { getCurrentPlayback } from "@/lib/playback-store";
import { viewerSession } from "@/lib/viewer-session";

/** Re-runs metadata providers only when the listener explicitly asks for it. */
export const POST = async (): Promise<NextResponse> => {
  const session = await viewerSession();
  const playback = await getCurrentPlayback(session.id);
  if (!playback) return NextResponse.json({ error: "No active playback for this screen" }, { status: 404 });
  // A blank event id means enrichment may update the album cache, but cannot
  // overwrite a newer current track if playback changes while it runs.
  after(() => enrichPlayback(playback, "manual-retry"));
  return NextResponse.json({ accepted: true }, { status: 202 });
};
