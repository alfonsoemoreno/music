"use client";

import { useEffect, useState } from "react";

interface Edition { id: number; title: string; year?: number; country?: string; format: string[]; label?: string; catalogNumber?: string; thumbnailUrl?: string; isBootleg: boolean }
interface Result { page: number; pages: number; total: number; items: Edition[] }
interface ReleaseDetail { id: number; title: string; year?: number; country?: string; labels: Array<{ name?: string; catalogNumber?: string }>; format: string[]; images: Array<{ url: string; thumbnailUrl: string; type: string; width?: number; height?: number }>; tracks: Array<{ position?: string; title: string; duration?: string }>; credits: Array<{ name: string; role: string }> }
type Collection = "editions" | "bootlegs";

const facts = (item: Edition): string => [item.country, item.year, item.label, item.catalogNumber, item.format.join(", ")].filter(Boolean).join(" · ");

export const DiscogsEditionExplorer = ({ albumId, purpose = "editions", initialOpen = false }: { albumId: string; purpose?: "editions" | "artwork"; initialOpen?: boolean }): React.JSX.Element => {
  const [open, setOpen] = useState(initialOpen);
  const [result, setResult] = useState<Result>();
  const [collection, setCollection] = useState<Collection>("editions");
  const [detail, setDetail] = useState<ReleaseDetail>();
  const [zoom, setZoom] = useState<{ url: string; title: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { setOpen(initialOpen); setResult(undefined); setDetail(undefined); setZoom(undefined); setError(undefined); }, [albumId, initialOpen]);
  const load = async (page: number): Promise<void> => {
    setLoading(true); setError(undefined);
    try {
      const response = await fetch(`/api/albums/${albumId}/discogs-editions?page=${page}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible cargar el catálogo de Discogs.");
      setResult(await response.json() as Result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible cargar el catálogo de Discogs."); }
    finally { setLoading(false); }
  };
  const openDetail = async (releaseId: number): Promise<void> => {
    setLoading(true); setError(undefined);
    try {
      const response = await fetch(`/api/albums/${albumId}/discogs-editions?releaseId=${releaseId}`, { cache: "no-store" });
      if (!response.ok) throw new Error("No fue posible cargar esta ficha de Discogs.");
      setDetail(await response.json() as ReleaseDetail);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible cargar esta ficha de Discogs."); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open && !result && !detail && !loading) void load(1); }, [open, result, detail, loading]);
  if (!open) return <div className="edition-explorer"><button onClick={() => { setOpen(true); void load(1); }}>{purpose === "artwork" ? "Explorar arte de todas las ediciones" : "Explorar archivo Discogs"}</button></div>;
  const visible = result?.items.filter((item) => collection === "bootlegs" ? item.isBootleg : !item.isBootleg) ?? [];
  const title = collection === "bootlegs" ? "Bootlegs y ediciones no oficiales" : "Ediciones físicas";
  if (detail) return <section className="edition-explorer open discogs-record"><div className="explorer-heading"><span>Ficha Discogs</span><button onClick={() => setDetail(undefined)}>Volver al archivo</button></div><p className="discogs-record-type">{collection === "bootlegs" ? "BOOTLEG / NO OFICIAL" : "EDICIÓN FÍSICA"}</p><h3>{detail.title}</h3><p className="discogs-facts">{[detail.country, detail.year, ...detail.labels.flatMap((label) => [label.name, label.catalogNumber]), ...detail.format].filter(Boolean).join(" · ")}</p>{detail.images.length ? <div className="discogs-gallery">{detail.images.map((image, index) => <button className="discogs-image" key={image.url} onClick={() => setZoom({ url: image.url, title: `${detail.title} · ${image.type}` })}><img src={image.thumbnailUrl} alt={`${image.type} de ${detail.title}`} /><span>{index === 0 ? "Portada" : image.type} · ampliar</span></button>)}</div> : <p className="empty-state">Discogs no publicó imágenes para esta ficha.</p>}{detail.tracks.length ? <section className="discogs-detail-block"><p className="section-label">Tracklist de esta edición</p>{detail.tracks.map((track, index) => <p className="discogs-track" key={`${track.position}-${track.title}`}><span>{track.position ?? String(index + 1).padStart(2, "0")}</span><strong>{track.title}</strong><small>{track.duration}</small></p>)}</section> : null}{detail.credits.length ? <section className="discogs-detail-block"><p className="section-label">Créditos publicados</p>{detail.credits.map((credit) => <p className="discogs-credit" key={`${credit.name}-${credit.role}`}><strong>{credit.name}</strong><span>{credit.role}</span></p>)}</section> : null}{zoom ? <div className="artwork-zoom" role="dialog" aria-modal="true" aria-label={zoom.title} onClick={() => setZoom(undefined)}><button onClick={() => setZoom(undefined)}>Cerrar</button><img src={zoom.url} alt={zoom.title} /></div> : null}<p className="attribution">Ficha e imágenes proporcionadas por Discogs.</p></section>;
  return <section className="edition-explorer open"><div className="explorer-heading"><span>{purpose === "artwork" ? "Arte de ediciones Discogs" : "Archivo Discogs"}</span><button onClick={() => setOpen(false)}>Cerrar</button></div><p>{purpose === "artwork" ? "Elige una edición para abrir sus fotografías, portada, contraportada e inserts a tamaño completo." : "Consulta el catálogo sin salir de Music. Las ediciones físicas y los bootlegs se muestran por separado; no se descarga ni almacena el catálogo completo."}</p><div className="explorer-filter"><button className={collection === "editions" ? "selected" : ""} onClick={() => setCollection("editions")}>Ediciones físicas</button><button className={collection === "bootlegs" ? "selected" : ""} onClick={() => setCollection("bootlegs")}>Bootlegs / no oficiales</button></div>{loading ? <p>Cargando archivo…</p> : null}{error ? <p className="explorer-error">{error}</p> : null}{!loading && result ? <><div className="archive-intro"><strong>{title}</strong><span>Página {result.page} de {result.pages}</span></div>{visible.length ? <div className={collection === "bootlegs" ? "explorer-list bootleg-list" : "explorer-list"}>{visible.map((item) => <button className="discogs-item" key={item.id} onClick={() => void openDetail(item.id)}>{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" /> : <span className="edition-thumb">DISC</span>}<span><strong>{item.title}</strong><small>{facts(item)}</small><em>{purpose === "artwork" ? "Abrir fotografías de esta edición" : collection === "bootlegs" ? "Abrir ficha y fotografías" : "Ver ficha de esta edición"}</em></span></button>)}</div> : <p className="empty-state">No hay {collection === "bootlegs" ? "bootlegs" : "ediciones físicas"} en esta página. Puedes avanzar para seguir explorando.</p>}<div className="explorer-pagination"><button disabled={result.page <= 1} onClick={() => void load(result.page - 1)}>Anterior</button><button disabled={result.page >= result.pages} onClick={() => void load(result.page + 1)}>Siguiente</button></div></> : null}</section>;
};
