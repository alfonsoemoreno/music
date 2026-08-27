import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashEnrollmentCode } from "@/lib/bridge-auth";
import { database } from "@/db/client";
import { bridgeEnrollmentCodes, bridges } from "@/db/schema";

const inputSchema = z.object({ enrollmentCode: z.string().regex(/^\d{6}$/), installationId: z.string().uuid(), name: z.string().min(1).max(100), publicKey: z.string().min(100).max(2_000) });

/** Exchanges the one-time code for a bridge identity whose events are signed by its Android Keystore key. */
export const POST = async (request: Request): Promise<NextResponse> => {
  if (!database) return NextResponse.json({ error: "Neon is required to activate a bridge" }, { status: 503 });
  const parsed = inputSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid activation payload", details: parsed.error.flatten() }, { status: 400 });
  const now = new Date();
  const [enrollment] = await database.select().from(bridgeEnrollmentCodes).where(and(eq(bridgeEnrollmentCodes.codeHash, hashEnrollmentCode(parsed.data.enrollmentCode)), gt(bridgeEnrollmentCodes.expiresAt, now), isNull(bridgeEnrollmentCodes.consumedAt))).limit(1);
  if (!enrollment) return NextResponse.json({ error: "Enrollment code is invalid or expired" }, { status: 401 });

  const consumed = await database.update(bridgeEnrollmentCodes).set({ consumedAt: now }).where(and(eq(bridgeEnrollmentCodes.id, enrollment.id), isNull(bridgeEnrollmentCodes.consumedAt))).returning({ id: bridgeEnrollmentCodes.id });
  if (!consumed[0]) return NextResponse.json({ error: "Enrollment code has already been used" }, { status: 409 });
  const [bridge] = await database.insert(bridges).values({ installationId: parsed.data.installationId, viewerId: enrollment.viewerId, name: parsed.data.name, publicKey: parsed.data.publicKey })
    .onConflictDoUpdate({ target: bridges.installationId, set: { viewerId: enrollment.viewerId, name: parsed.data.name, publicKey: parsed.data.publicKey, revokedAt: null } })
    .returning({ id: bridges.id, name: bridges.name });
  return NextResponse.json({ bridgeId: bridge.id, name: bridge.name });
};
