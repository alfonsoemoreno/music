import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getAlbumCompanion, getCurrentPlayback } from "@/lib/playback-store";
import { decodeDisplayValue } from "@/lib/html-entities";
import { attachViewerSession, createViewerRecoveryToken, recoverViewerSession, viewerSession } from "@/lib/viewer-session";
export const dynamic = "force-dynamic";
export const GET = async (request: Request): Promise<NextResponse> => {
  let session = await viewerSession();
  const recoveryToken = request.headers.get("x-music-viewer-recovery") ?? undefined;
  if (session.isNew) {
    const recovered = await recoverViewerSession(recoveryToken);
    if (recovered) session = { id: recovered.id, isNew: true };
  }
  const playback = await getCurrentPlayback(session.id);
  const album = await getAlbumCompanion(playback);
  // Decode at the API boundary too, so cached legacy records and every metadata
  // provider render cleanly without trusting them as HTML.
  const payload = { playback: playback ? decodeDisplayValue(playback) : null, album: album ? decodeDisplayValue(album) : null };
  const etag = `"${createHash("sha256").update(JSON.stringify(payload)).digest("base64url")}"`;
  const issuedRecoveryToken = !recoveryToken && !session.isNew ? await createViewerRecoveryToken(session.id) : undefined;
  const headers = { "cache-control": "private, no-cache", etag, vary: "cookie", ...(issuedRecoveryToken ? { "x-music-viewer-recovery": issuedRecoveryToken } : {}) };
  if (request.headers.get("if-none-match") === etag) return attachViewerSession(new NextResponse(null, { status: 304, headers }), session);
  return attachViewerSession(NextResponse.json(payload, { headers }), session);
};
