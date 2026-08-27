import { NextResponse } from "next/server";
import { getAlbumCompanion, getCurrentPlayback } from "@/lib/playback-store";
import { decodeDisplayValue } from "@/lib/html-entities";
import { viewerSession } from "@/lib/viewer-session";
export const dynamic = "force-dynamic";
export const GET = async (): Promise<NextResponse> => {
  const session = await viewerSession();
  const playback = await getCurrentPlayback(session.id);
  const album = await getAlbumCompanion(playback);
  // Decode at the API boundary too, so cached legacy records and every metadata
  // provider render cleanly without trusting them as HTML.
  return NextResponse.json({ playback: playback ? decodeDisplayValue(playback) : null, album: album ? decodeDisplayValue(album) : null });
};
