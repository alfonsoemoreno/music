"use client";

import { useEffect, useState } from "react";
import type { AlbumEditorial as Editorial } from "@/db/schema";

export const AlbumEditorial = ({ albumId, initial }: { albumId: string; initial?: Editorial }): React.JSX.Element | null => {
  const [editorial, setEditorial] = useState<Editorial | undefined>(initial);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string>();
  useEffect(() => { setEditorial(initial); setState("idle"); setError(undefined); }, [albumId]);
  if (albumId === "demo" || albumId === "unresolved") return null;
  const create = async (): Promise<void> => {
    setState("loading"); setError(undefined);
    try {
      const response = await fetch(`/api/albums/${albumId}/editorial`, { method: "POST" });
      const data = await response.json() as { editorial?: Editorial; error?: string };
      if (!response.ok || !data.editorial) throw new Error(data.error ?? "No fue posible crear la nota.");
      setEditorial(data.editorial); setState("idle");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No fue posible crear la nota."); setState("error"); }
  };
  if (editorial) return <section className="detail-section editorial ai-editorial"><p className="section-label">Notas de escucha</p><h3>{editorial.heading}</h3><p>{editorial.note}</p><ul>{editorial.listeningCues.map((cue) => <li key={cue}>{cue}</li>)}</ul><p className="attribution">Síntesis editorial generada con OpenAI a partir de la ficha disponible; no añade fuentes ni hechos nuevos.</p></section>;
  return <section className="detail-section editorial ai-editorial"><p className="section-label">Notas de escucha</p><p>Una breve lectura editorial construida a partir de los créditos, contexto y tracklist ya disponibles.</p><button className="editorial-action" disabled={state === "loading"} onClick={() => void create()}>{state === "loading" ? "Escribiendo…" : "Crear nota de escucha"}</button>{error ? <p className="empty-state">{error}{error === "OpenAI is not configured" ? ". Agrega `OPENAI_API_KEY` a `apps/web/.env.local`." : " Vuelve a intentarlo."}</p> : null}</section>;
};
