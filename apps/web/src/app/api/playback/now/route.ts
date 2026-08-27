import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAlbumCompanion, getCurrentPlayback } from "@/lib/playback-store";
import { decodeDisplayValue } from "@/lib/html-entities";
import { viewerSession } from "@/lib/viewer-session";
export const dynamic = "force-dynamic";
export const GET = async (request: Request): Promise<NextResponse> => {
  const session = await viewerSession();
  const playback = await getCurrentPlayback(session.id);
  const album = await getAlbumCompanion(playback);
  // Decode at the API boundary too, so cached legacy records and every metadata
  // provider render cleanly without trusting them as HTML.
  const payload = { playback: playback ? decodeDisplayValue(playback) : null, album: album ? decodeDisplayValue(album) : null };
  const etag = `"${createHash("sha256").update(JSON.stringify(payload)).digest("base64url")}"`;
  const headers = { "cache-control": "private, no-cache", etag, vary: "cookie" };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return NextResponse.json(payload, { headers });
};
