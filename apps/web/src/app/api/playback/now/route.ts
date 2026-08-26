import { NextResponse } from "next/server";
import { getAlbumCompanion, getCurrentPlayback } from "@/lib/playback-store";
export const dynamic = "force-dynamic";
export const GET = async (): Promise<NextResponse> => {
  const playback = await getCurrentPlayback();
  return NextResponse.json({ playback: playback ?? null, album: await getAlbumCompanion(playback) ?? null });
};
