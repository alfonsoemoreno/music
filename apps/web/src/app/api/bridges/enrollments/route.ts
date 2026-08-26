import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidBrowserSession } from "@/lib/auth";
import { createEnrollmentCode, hashEnrollmentCode } from "@/lib/bridge-auth";
import { database } from "@/db/client";
import { bridgeEnrollmentCodes } from "@/db/schema";

const session = (cookieHeader: string | null): string | undefined => cookieHeader?.match(/(?:^|;\s*)music_browser_session=([^;]+)/)?.[1];
const inputSchema = z.object({});

/** Creates a ten-minute, single-use enrollment code shown by the Music web UI. */
export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isValidBrowserSession(session(request.headers.get("cookie")))) return NextResponse.json({ error: "Browser session required" }, { status: 401 });
  if (!database) return NextResponse.json({ error: "Neon is required to enroll a bridge" }, { status: 503 });
  if (!inputSchema.safeParse(await request.json().catch(() => ({}))).success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const code = createEnrollmentCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1_000);
  await database.insert(bridgeEnrollmentCodes).values({ codeHash: hashEnrollmentCode(code), expiresAt });
  return NextResponse.json({ code, expiresAt: expiresAt.toISOString(), serverUrl: new URL(request.url).origin });
};
