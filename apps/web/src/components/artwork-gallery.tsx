"use client";

import { useState } from "react";

export interface GalleryArtwork { id: string; url: string; type: string; source: string }

export const ArtworkGallery = ({ title, items, empty }: { title: string; items: GalleryArtwork[]; empty: string }): React.JSX.Element => {
  const [zoom, setZoom] = useState<{ url: string; title: string }>();
  return <section className="art-source"><div className="art-source-heading"><p className="section-label">{title}</p><span>{items.length ? `${items.length} imágenes` : "Sin imágenes"}</span></div>{items.length ? <div className="artwork-grid">{items.map((item) => <button className="artwork-tile" key={item.id} onClick={() => setZoom({ url: item.url, title: `${item.type} · ${title}` })}><img src={item.url} alt={`${item.type} de ${title}`} /><span>{item.type} · ampliar</span></button>)}</div> : <p className="empty-state">{empty}</p>}{zoom ? <div className="artwork-zoom" role="dialog" aria-modal="true" aria-label={zoom.title} onClick={() => setZoom(undefined)}><button onClick={() => setZoom(undefined)}>Cerrar</button><img src={zoom.url} alt={zoom.title} /></div> : null}</section>;
};
