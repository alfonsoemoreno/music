import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidBrowserSession } from "@/lib/auth";
import { createEnrollmentCode, hashEnrollmentCode } from "@/lib/bridge-auth";
import { database } from "@/db/client";
import { bridgeEnrollmentCodes } from "@/db/schema";

const session = (cookieHeader: string | null): string | undefined => cookieHeader?.match(/(?:^|;\s*)music_browser_session=([^;]+)/)?.[1];
const inputSchema = z.object({});

/** Creates a short-lived, single-use six-digit PIN shown by the Music web UI. */
export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isValidBrowserSession(session(request.headers.get("cookie")))) return NextResponse.json({ error: "Browser session required" }, { status: 401 });
  if (!database) return NextResponse.json({ error: "Neon is required to enroll a bridge" }, { status: 503 });
  if (!inputSchema.safeParse(await request.json().catch(() => ({}))).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
  // A collision is unlikely (one in a million); retry rather than surfacing it to the person pairing the phone.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createEnrollmentCode();
    const inserted = await database.insert(bridgeEnrollmentCodes).values({ codeHash: hashEnrollmentCode(code), expiresAt }).onConflictDoNothing().returning({ id: bridgeEnrollmentCodes.id });
    if (inserted[0]) return NextResponse.json({ code, expiresAt: expiresAt.toISOString(), serverUrl: new URL(request.url).origin });
  }
  return NextResponse.json({ error: "Could not create a pairing PIN. Please try again." }, { status: 503 });
};
