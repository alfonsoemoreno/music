import OpenAI from "openai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { database } from "@/db/client";
import { albums, artists, credits, tracks, type AlbumEditorial } from "@/db/schema";

const editorialSchema = z.object({ heading: z.string().min(3).max(90), note: z.string().min(40).max(900), listeningCues: z.array(z.string().min(8).max(180)).max(3) });
const cut = (value: string | null | undefined, length: number): string | undefined => value ? value.slice(0, length) : undefined;
const normalizeEditorial = (value: unknown): AlbumEditorial => {
  const raw = z.object({ heading: z.string(), note: z.string(), listeningCues: z.array(z.string()) }).parse(value);
  return editorialSchema.parse({ heading: raw.heading.trim().slice(0, 90), note: raw.note.trim().slice(0, 900), listeningCues: raw.listeningCues.map((cue) => cue.trim()).filter((cue) => cue.length >= 8).slice(0, 3) });
};

/** Produces a concise, cached synthesis from already-attributed metadata; it never researches or invents facts. */
export const createAlbumEditorial = async (albumId: string): Promise<{ editorial: AlbumEditorial; cached: boolean; model: string }> => {
  if (!database) throw new Error("Database is not configured");
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured");
  const [row] = await database.select({ album: albums, artist: artists }).from(albums).innerJoin(artists, eq(albums.artistId, artists.id)).where(eq(albums.id, albumId)).limit(1);
  if (!row) throw new Error("Album not found");
  if (row.album.editorial && row.album.editorialModel) return { editorial: row.album.editorial, cached: true, model: row.album.editorialModel };
  const [albumTracks, albumCredits] = await Promise.all([
    database.select({ title: tracks.title, position: tracks.position }).from(tracks).where(eq(tracks.albumId, albumId)).limit(30),
    database.select({ personName: credits.personName, role: credits.role }).from(credits).where(eq(credits.albumId, albumId)).limit(24),
  ]);
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const source = { album: row.album.title, artist: row.artist.name, year: row.album.year, genres: row.album.genres ?? [], tags: row.album.tags ?? [], albumContext: cut(row.album.description, 2_400), artistContext: cut(row.artist.biography, 1_200), tracks: albumTracks.map((track) => ({ position: track.position, title: track.title })), credits: albumCredits };
  const response = await client.responses.create({
    model,
    store: false,
    max_output_tokens: 420,
    instructions: "Escribes en español para un libreto musical. Usa exclusivamente los datos JSON entregados; no investigues, no completes lagunas, no atribuyas intenciones ni inventes hechos. Si faltan datos, mantén la nota breve y explícitalo con sobriedad. Devuelve una nota cálida y editorial, no promocional.",
    input: JSON.stringify(source),
    text: { format: { type: "json_schema", name: "album_editorial", strict: true, schema: { type: "object", additionalProperties: false, properties: { heading: { type: "string", minLength: 3, maxLength: 90 }, note: { type: "string", minLength: 40, maxLength: 900 }, listeningCues: { type: "array", items: { type: "string", minLength: 8, maxLength: 180 }, maxItems: 3 } }, required: ["heading", "note", "listeningCues"] } } },
  });
  const editorial = normalizeEditorial(JSON.parse(response.output_text));
  await database.update(albums).set({ editorial, editorialModel: model, editorialUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(albums.id, albumId));
  return { editorial, cached: false, model };
};
