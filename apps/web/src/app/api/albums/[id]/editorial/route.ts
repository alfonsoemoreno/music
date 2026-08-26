import { NextResponse } from "next/server";
import { z } from "zod";
import { createAlbumEditorial } from "@/lib/album-editorial";

const paramsSchema = z.object({ id: z.string().uuid() });
export const maxDuration = 30;
export const POST = async (_request: Request, context: { params: Promise<{ id: string }> }): Promise<NextResponse> => {
  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return NextResponse.json({ error: "Invalid album id" }, { status: 400 });
  try { return NextResponse.json(await createAlbumEditorial(params.data.id)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Could not create editorial note";
    const status = message === "Album not found" ? 404 : message === "OpenAI is not configured" ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
};
