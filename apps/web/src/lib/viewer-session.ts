import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { database } from "@/db/client";
import { viewerRecoveryTokens } from "@/db/schema";

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

const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");

/** Issues a long-lived, opaque recovery token for the current PWA installation. */
export const createViewerRecoveryToken = async (viewerId: string): Promise<string | undefined> => {
  if (!database) return undefined;
  const token = randomBytes(32).toString("base64url");
  await database.insert(viewerRecoveryTokens).values({ tokenHash: tokenHash(token), viewerId, expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000) });
  return token;
};

/** Restores only the viewer identity; the raw token is never stored in the database. */
export const recoverViewerSession = async (token?: string): Promise<{ id: string } | undefined> => {
  if (!database || !token || token.length > 200) return undefined;
  const [record] = await database.select({ viewerId: viewerRecoveryTokens.viewerId }).from(viewerRecoveryTokens)
    .where(and(eq(viewerRecoveryTokens.tokenHash, tokenHash(token)), gt(viewerRecoveryTokens.expiresAt, new Date()))).limit(1);
  return record ? { id: record.viewerId } : undefined;
};
