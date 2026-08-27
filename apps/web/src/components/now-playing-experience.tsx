"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentPlaybackPayload } from "@music/domain";
import type { AlbumCompanionData } from "@/lib/playback-store";
import { AlbumArchive } from "./album-archive";
import { AlbumEditorial } from "./album-editorial";
import { WikipediaReader } from "./wikipedia-reader";
import { WiiMBrowserBridge } from "./wiim-browser-bridge";

type View = "album" | "archive" | "artist";
const views: Array<{ id: View; label: string }> = [{ id: "album", label: "El disco" }, { id: "archive", label: "Archivo" }, { id: "artist", label: "Artista" }];
const duration = (milliseconds?: number): string => milliseconds ? `${Math.floor(milliseconds / 60_000)}:${String(Math.round(milliseconds / 1_000) % 60).padStart(2, "0")}` : "";
const enrichmentLabel = (status: string): string => ({ completed: "listo", loading: "completando", failed: "pendiente", not_configured: "no configurado" })[status] ?? status;

export const NowPlayingExperience = (): React.JSX.Element => {
  const [playback, setPlayback] = useState<AgentPlaybackPayload>();
  const [album, setAlbum] = useState<AlbumCompanionData>();
  const [live, setLive] = useState(false);
  const [view, setView] = useState<View>("album");
  const [isResolving, setIsResolving] = useState(false);
  const latestRequest = useRef(0);
  const lastPlaybackKey = useRef<string | undefined>(undefined);
  const fastPollingUntil = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const load = async (): Promise<void> => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      try {
        const response = await fetch("/api/playback/now", { cache: "no-store" });
        const data = await response.json() as { playback: AgentPlaybackPayload | null; album: AlbumCompanionData | null };
        if (requestId !== latestRequest.current) return;
        if (!data.playback) { setPlayback(undefined); setAlbum(undefined); setLive(false); setIsResolving(false); return; }
        const playbackKey = [data.playback.playbackProvider, data.playback.artist.name, data.playback.album?.title, data.playback.track.title].join("|");
        if (lastPlaybackKey.current && lastPlaybackKey.current !== playbackKey) { fastPollingUntil.current = Date.now() + 8_000; setView("album"); }
        lastPlaybackKey.current = playbackKey;
        setPlayback(data.playback); setLive(true); setIsResolving(!data.album);
        setAlbum(data.album ?? { id: data.playback.album?.externalId ?? "unresolved", artistId: "unresolved", title: data.playback.album?.title ?? "Single", artist: data.playback.artist.name, artworkUrl: data.playback.album?.artworkUrl, genres: [], tags: [], enrichment: [], tracks: [], editions: [], credits: [], artwork: [] });
      } catch { if (requestId === latestRequest.current) setLive(false); }
      finally { if (!cancelled) timer = window.setTimeout(() => void load(), Date.now() < fastPollingUntil.current ? 700 : 2_000); }
    };
    void load();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, []);

  if (!playback || !album) return <main className="pairing-shell"><header className="masthead"><span>Music <i>— Digital Album Companion</i></span><span className="signal">● Configuración inicial</span></header><WiiMBrowserBridge /><footer>La música sigue en tu reproductor. Aquí vuelve a aparecer el álbum.</footer></main>;

  const cover = album.artworkUrl ?? playback.album?.artworkUrl;
  const progress = Math.min(100, Math.round((playback.track.positionMs ?? 0) / (playback.track.durationMs ?? 1) * 100));
  const fanartArtwork = album.artwork.filter((item) => item.source === "fanart");
  const loadingRows = <div className="track-skeleton" aria-label="Preparando tracklist">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>;
  const editorialLoading = <div className="editorial-skeleton" aria-label="Preparando libreto"><i /><i /><i /></div>;

  const albumView = <div className="album-reading"><section className="reading-lede"><p className="section-label">Liner notes</p>{album.description ? <><p>{album.description}</p>{album.wikipediaUrl ? <a href={album.wikipediaUrl} target="_blank" rel="noreferrer">Leer la fuente en Wikipedia</a> : null}<WikipediaReader kind="album" entityId={album.id} /></> : isResolving ? editorialLoading : <p className="empty-state">La historia de esta edición aún se está reuniendo.</p>}</section><AlbumEditorial albumId={album.id} initial={album.editorial} /><section className="tracklist"><div className="tracklist-heading"><span>Tracklist</span><span>{album.tracks.length ? `${album.tracks.length} pistas` : isResolving ? "Preparando" : "Sin tracklist"}</span></div>{album.tracks.length ? album.tracks.map((item) => { const active = item.musicBrainzId ? item.musicBrainzId === playback.track.externalId : item.title.toLowerCase() === playback.track.title.toLowerCase(); return <div className={active ? "track-row active" : "track-row"} key={item.id}><span>{String(item.position ?? "—").padStart(2, "0")}</span><strong>{item.title}</strong><span>{duration(item.durationMs)}</span></div>; }) : isResolving ? loadingRows : <p className="empty-state">La ficha se está completando.</p>}</section></div>;
  const archiveView = <AlbumArchive albumId={album.id} fanart={fanartArtwork} />;
  const artistView = <section className="detail-section artist-panel"><p className="section-label">Artista</p><h3>{album.artist}</h3>{album.artistCountry ? <p className="artist-origin">{album.artistCountry}</p> : null}{album.artistBiography ? <><p>{album.artistBiography}</p>{album.artistWikipediaUrl ? <a href={album.artistWikipediaUrl} target="_blank" rel="noreferrer">Ver fuente y contexto en Wikipedia</a> : null}<WikipediaReader kind="artist" entityId={album.artistId} /></> : isResolving ? editorialLoading : <p className="empty-state">La biografía se está completando.</p>}</section>;
  const content = ({ album: albumView, archive: archiveView, artist: artistView })[view];

  return <main className="album-shell"><header className="masthead"><span>Music <i>— Digital Album Companion</i></span><span className={live ? "signal online" : "signal"}>● {live ? "Escuchando ahora" : "Esperando reproducción"}</span></header><div className="album-grid"><aside className="record-object"><div className="cover-frame">{cover ? <img className="album-cover" src={cover} alt={`Portada de ${album.title}`} /> : <div className="cover-placeholder">MUSIC</div>}</div><div className="record-spine"><span>{album.artist}</span><span>{album.title}</span></div><div className="record-facts"><span>{[album.year, album.label, album.format].filter(Boolean).join(" · ") || (isResolving ? "Identificando edición" : "Álbum digital")}</span>{album.genres.length ? <span>{album.genres.join(" · ")}</span> : null}</div></aside><article className="album-copy"><header className="album-header"><p className="kicker">En reproducción</p><h1>{album.title}</h1><h2>{album.artist}</h2>{album.tags.length ? <p className="tags">{album.tags.join(" · ")}</p> : null}</header><section className="now-playing-card"><div className="now-playing-heading"><span>Ahora suena</span><span>{playback.playback.state === "playing" ? "● En curso" : playback.playback.state}</span></div><div className="track"><strong>{playback.track.title}</strong><span>{duration(playback.track.durationMs)}</span></div><div className="progress"><i style={{ width: `${progress}%` }} /></div><p className="technical">{playback.source ?? playback.playbackProvider} <b>•</b> WiiM Ultra</p></section>{isResolving ? <p className="preparing">Preparando la ficha del álbum…</p> : album.enrichment.length ? <div className="enrichment-status" aria-label="Estado de fuentes">{album.enrichment.map((item) => <span className={item.status} key={item.source} title={item.error}>{item.source} · {enrichmentLabel(item.status)}</span>)}</div> : null}<nav className="album-nav" aria-label="Contenido del álbum">{views.map((item) => <button className={view === item.id ? "selected" : ""} key={item.id} onClick={() => setView(item.id)}>{item.label}</button>)}</nav><section className="album-content">{content}</section></article></div><footer>La música sigue en tu reproductor. Aquí tienes el álbum.</footer></main>;
};
