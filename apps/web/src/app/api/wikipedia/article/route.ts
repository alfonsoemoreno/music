import sanitizeHtml from "sanitize-html";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { albums, artists } from "@/db/schema";

const querySchema = z.object({ kind: z.enum(["album", "artist"]), id: z.string().uuid() });
interface WikipediaPage { title?: string; html?: string; latest?: { id?: number; timestamp?: string }; license?: { title?: string; url?: string } }

const sourceFromStoredUrl = (storedUrl: string): { endpoint: string; sourceUrl: string } | undefined => {
  try {
    const source = new URL(storedUrl);
    if (!source.hostname.endsWith(".wikipedia.org") || !source.pathname.startsWith("/wiki/")) return undefined;
    const title = decodeURIComponent(source.pathname.slice("/wiki/".length));
    return { endpoint: `https://${source.hostname}/w/rest.php/v1/page/${encodeURIComponent(title)}/with_html`, sourceUrl: source.toString() };
  } catch { return undefined; }
};

const cleanArticleHtml = (html: string): string => sanitizeHtml(html, {
  allowedTags: ["p", "h2", "h3", "h4", "ul", "ol", "li", "b", "i", "strong", "em", "a", "blockquote", "dl", "dt", "dd", "table", "tbody", "tr", "th", "td", "sup", "sub", "small", "br", "hr"],
  allowedAttributes: { a: ["href", "title"] },
  allowedSchemes: ["http", "https"],
});

/** Retrieves a stored, already attributed Wikipedia article on demand; it never accepts arbitrary URLs. */
export const GET = async (request: Request): Promise<NextResponse> => {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success || !database) return NextResponse.json({ error: "Invalid article request" }, { status: 400 });
  const storedUrl = parsed.data.kind === "album"
    ? (await database.select({ url: albums.wikipediaUrl }).from(albums).where(eq(albums.id, parsed.data.id)).limit(1))[0]?.url
    : (await database.select({ url: artists.wikipediaUrl }).from(artists).where(eq(artists.id, parsed.data.id)).limit(1))[0]?.url;
  if (!storedUrl) return NextResponse.json({ error: "No Wikipedia article available" }, { status: 404 });
  const source = sourceFromStoredUrl(storedUrl);
  if (!source) return NextResponse.json({ error: "Unsupported Wikipedia source" }, { status: 400 });
  const response = await fetch(source.endpoint, { headers: { accept: "application/json", "api-user-agent": "DigitalAlbumCompanion/0.1.0" }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return NextResponse.json({ error: `Wikipedia returned HTTP ${response.status}` }, { status: 502 });
  const page = await response.json() as WikipediaPage;
  if (!page.html || !page.title) return NextResponse.json({ error: "Wikipedia article is unavailable" }, { status: 404 });
  return NextResponse.json({ title: page.title, html: cleanArticleHtml(page.html), sourceUrl: source.sourceUrl, license: page.license, revision: page.latest });
};
