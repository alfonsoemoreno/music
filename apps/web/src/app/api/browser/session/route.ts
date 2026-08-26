import { NextResponse } from "next/server";
import { z } from "zod";
import { browserSessionValue, isBrowserBridgeConfigured, isValidBrowserAccessCode, isValidBrowserSession } from "@/lib/auth";

const sessionCookie = "music_browser_session";
const inputSchema = z.object({ code: z.string().min(1).max(500) });

const unavailable = (): NextResponse => NextResponse.json({ error: "Browser bridge is not configured" }, { status: 503 });

export const GET = (request: Request): NextResponse => {
  if (!isBrowserBridgeConfigured()) return unavailable();
  return NextResponse.json({ authenticated: isValidBrowserSession(request.headers.get("cookie")?.match(/(?:^|;\s*)music_browser_session=([^;]+)/)?.[1]) });
};

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!isBrowserBridgeConfigured()) return unavailable();
  const parsed = inputSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success || !isValidBrowserAccessCode(parsed.data.code)) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  const value = browserSessionValue();
  if (!value) return unavailable();
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set({ name: sessionCookie, value, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
};
