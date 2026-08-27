import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const cookieName = "music_viewer";

/** A private browser identity for the personal, no-login pairing flow. */
export const viewerSession = async (): Promise<{ id: string; isNew: boolean }> => {
  const store = await cookies();
  const existing = store.get(cookieName)?.value;
  return existing ? { id: existing, isNew: false } : { id: randomUUID(), isNew: true };
};

export const attachViewerSession = (response: NextResponse, session: { id: string; isNew: boolean }): NextResponse => {
  if (session.isNew) response.cookies.set(cookieName, session.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return response;
};
