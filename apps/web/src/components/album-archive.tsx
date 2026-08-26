"use client";

import { useState } from "react";
import { ArtworkGallery, type GalleryArtwork } from "./artwork-gallery";
import { DiscogsEditionExplorer } from "./discogs-edition-explorer";

export const AlbumArchive = ({ albumId, fanart }: { albumId: string; fanart: GalleryArtwork[] }): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  if (!open) return <section className="album-archive"><div className="content-heading"><p className="section-label">Archivo del álbum</p><p>Ediciones físicas, bootlegs, scans e imágenes complementarias. Se consulta sólo cuando decides abrirlo.</p></div><button className="archive-action" onClick={() => setOpen(true)}>Abrir archivo de ediciones y arte</button></section>;
  return <section className="album-archive"><div className="explorer-heading"><span>Archivo del álbum</span><button onClick={() => setOpen(false)}>Cerrar</button></div><p className="archive-intro-copy">Discogs proporciona las ediciones y sus fotografías a demanda. Fanart.tv aporta imágenes complementarias del álbum o artista, sin atribuirlas a una edición física concreta.</p><DiscogsEditionExplorer albumId={albumId} purpose="artwork" initialOpen /><ArtworkGallery title="Arte complementario · Fanart.tv" items={fanart} empty="Fanart.tv no tiene imágenes complementarias para este álbum." /><p className="attribution">Las fichas, scans e imágenes conservan su fuente original: Discogs o Fanart.tv.</p></section>;
};
