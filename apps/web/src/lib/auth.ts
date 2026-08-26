import { createHmac, timingSafeEqual } from "node:crypto";

const safeCompare = (expected: string | undefined, supplied: string | undefined): boolean => {
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
};

export const isValidAgentToken = (authorization: string | null): boolean => {
  const expected = process.env.AGENT_TOKEN;
  const supplied = authorization?.replace(/^Bearer\s+/i, "");
  return safeCompare(expected, supplied);
};

const browserSessionSecret = (): string | undefined => process.env.BROWSER_SESSION_SECRET ?? process.env.AUTH_SECRET;

export const isBrowserBridgeConfigured = (): boolean => Boolean(process.env.BROWSER_ACCESS_CODE && browserSessionSecret());

export const isValidBrowserAccessCode = (code: string | undefined): boolean => safeCompare(process.env.BROWSER_ACCESS_CODE, code);

export const browserSessionValue = (): string | undefined => {
  const secret = browserSessionSecret();
  const code = process.env.BROWSER_ACCESS_CODE;
  if (!secret || !code) return undefined;
  return createHmac("sha256", secret).update(`music-browser:${code}`).digest("base64url");
};

export const isValidBrowserSession = (value: string | undefined): boolean => safeCompare(browserSessionValue(), value);
