import { createPublicKey, verify } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { database } from "@/db/client";
import { bridgeNonces, bridges } from "@/db/schema";
export { createEnrollmentCode, hashEnrollmentCode } from "./bridge-pairing";
import { hashEnrollmentCode } from "./bridge-pairing";

const maxClockSkewMs = 5 * 60 * 1_000;

const header = (request: Request, name: string): string | undefined => request.headers.get(name) ?? undefined;

export interface VerifiedBridge { id: string; name: string }

/** Verifies Android's Keystore ECDSA signature and consumes each nonce once. */
export const verifyBridgeRequest = async (request: Request, body: string): Promise<VerifiedBridge | undefined> => {
  if (!database) return undefined;
  const bridgeId = header(request, "x-music-bridge-id");
  const timestamp = Number(header(request, "x-music-timestamp"));
  const nonce = header(request, "x-music-nonce");
  const encodedSignature = header(request, "x-music-signature");
  if (!bridgeId || !nonce || !encodedSignature || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > maxClockSkewMs) return undefined;

  const [bridge] = await database.select().from(bridges).where(and(eq(bridges.id, bridgeId), isNull(bridges.revokedAt))).limit(1);
  if (!bridge) return undefined;
  try {
    const valid = verify("sha256", Buffer.from(`${timestamp}.${nonce}.${body}`), createPublicKey({ key: Buffer.from(bridge.publicKey, "base64"), format: "der", type: "spki" }), Buffer.from(encodedSignature, "base64"));
    if (!valid) return undefined;
  } catch { return undefined; }

  const expiresAt = new Date(Date.now() + maxClockSkewMs);
  const inserted = await database.insert(bridgeNonces).values({ bridgeId: bridge.id, nonce, expiresAt }).onConflictDoNothing().returning({ id: bridgeNonces.id });
  if (!inserted[0]) return undefined;
  await database.update(bridges).set({ lastSeenAt: new Date() }).where(eq(bridges.id, bridge.id));
  return { id: bridge.id, name: bridge.name };
};
