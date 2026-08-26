"use client";

import { useState } from "react";

type EntityKind = "album" | "artist";
interface Article { title: string; html: string; sourceUrl: string; license?: { title?: string; url?: string }; revision?: { id?: number; timestamp?: string } }

export const WikipediaReader = ({ entityId, kind }: { entityId: string; kind: EntityKind }): React.JSX.Element => {
  const [article, setArticle] = useState<Article>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const load = async (): Promise<void> => {
    setLoading(true); setError(undefined);
    try {
      const response = await fetch(`/api/wikipedia/article?kind=${kind}&id=${entityId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible cargar el artículo completo.");
      setArticle(await response.json() as Article);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible cargar el artículo completo."); }
    finally { setLoading(false); }
  };
  if (!article) return <div className="article-reader"><button onClick={() => void load()} disabled={loading}>{loading ? "Cargando artículo…" : "Leer artículo completo"}</button>{error ? <p>{error}</p> : null}</div>;
  return <section className="full-article"><div className="full-article-heading"><span>Lectura completa</span><button onClick={() => setArticle(undefined)}>Cerrar</button></div><h4>{article.title}</h4><div className="wikipedia-html" dangerouslySetInnerHTML={{ __html: article.html }} /><p className="attribution">Contenido de Wikipedia, {article.license?.title ?? "según su licencia aplicable"}. <a href={article.sourceUrl} target="_blank" rel="noreferrer">Ver artículo y autores.</a>{article.revision?.id ? ` Revisión ${article.revision.id}.` : ""}</p></section>;
};
