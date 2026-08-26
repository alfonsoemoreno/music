"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentPlaybackPayload, PlaybackState } from "@music/domain";

const storageKey = "music.wiim.host";
const candidates = ["wiim.local", "wiim-ultra.local"];

type BridgeStatus = "idle" | "connecting" | "connected" | "error";
type WiiMRecord = Record<string, unknown>;

const asRecord = (value: unknown): WiiMRecord => value && typeof value === "object" && !Array.isArray(value) ? value as WiiMRecord : {};
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const number = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};
const decode = (value: unknown): string | undefined => {
  const raw = text(value);
  if (!raw) return undefined;
  const compact = raw.replace(/\s/g, "");
  if (compact.length % 2 === 0 && /^[0-9a-f]+$/i.test(compact)) {
    try {
      const bytes = Uint8Array.from(compact.match(/.{1,2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
      const decoded = new TextDecoder().decode(bytes);
      if (decoded && !decoded.includes("�")) return decoded;
    } catch { /* Preserve the original value if a malformed device field is received. */ }
  }
  return raw.replace(/&apos;|&#39;|&#x27;/gi, "'").replace(/&quot;/gi, "\"").replace(/&amp;/gi, "&");
};
const playbackState = (value: unknown): PlaybackState => value === "play" || value === "playing" ? "playing" : value === "pause" || value === "paused" ? "paused" : "stopped";
const provider = (value: unknown): { key: string; label: string } => {
  const raw = decode(value) ?? "WiiM";
  const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "") || "wiim";
  return { key, label: ({ qobuz: "Qobuz", tidal: "Tidal", spotify: "Spotify" }[key] ?? raw) };
};
const safeHost = (input: string): string | undefined => {
  const normalized = input.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(normalized) ? normalized : undefined;
};

const fetchCommand = async (host: string, command: string): Promise<WiiMRecord> => {
  const response = await fetch(`http://${host}/httpapi.asp?command=${encodeURIComponent(command)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`WiiM respondió HTTP ${response.status}`);
  return asRecord(await response.json());
};

const toPlayback = (host: string, device: WiiMRecord, player: WiiMRecord): AgentPlaybackPayload => {
  const source = provider(player.vendor);
  const albumTitle = decode(player.album) ?? decode(player.Album);
  const artworkUrl = text(player.album_art) ?? text(player.artwork);
  return {
    agentVersion: "browser-bridge-0.1.0",
    deviceId: String(device.uuid ?? device.DeviceName ?? host),
    playbackProvider: source.key,
    source: source.label,
    artist: { name: decode(player.artist) ?? decode(player.Artist) ?? "Unknown artist" },
    track: { title: decode(player.media_title) ?? decode(player.title) ?? decode(player.Title) ?? "Unknown track", durationMs: number(player.totlen) },
    album: albumTitle ? { title: albumTitle, artworkUrl } : undefined,
    playback: { state: playbackState(player.status) },
  };
};

export const WiiMBrowserBridge = (): React.JSX.Element => {
  const [status, setStatus] = useState<BridgeStatus>("idle");
  const [host, setHost] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("Conecta tu WiiM mientras esta pestaña permanezca abierta.");
  const activeHost = useRef<string>();
  const lastFingerprint = useRef<string>();
  const timer = useRef<number>();

  const stop = (): void => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = undefined;
    activeHost.current = undefined;
    lastFingerprint.current = undefined;
    setStatus("idle");
    setMessage("La sincronización local está detenida.");
  };

  const start = async (requestedHost?: string): Promise<void> => {
    setStatus("connecting");
    setMessage("Buscando el WiiM en tu red local…");
    const supplied = requestedHost ? [requestedHost] : candidates;
    let selected: string | undefined;
    let device: WiiMRecord | undefined;
    for (const candidate of supplied) {
      const valid = safeHost(candidate);
      if (!valid) continue;
      try { device = await fetchCommand(valid, "getStatusEx"); selected = valid; break; } catch { /* Try the next local name. */ }
    }
    if (!selected || !device) {
      setStatus("error");
      setMessage(requestedHost ? "No fue posible acceder al WiiM. Comprueba la dirección o el bloqueo del navegador a la red local." : "No se encontró automáticamente. Indica una dirección local del WiiM para emparejarlo una vez.");
      return;
    }
    activeHost.current = selected;
    window.localStorage.setItem(storageKey, selected);
    setHost(selected);
    const poll = async (): Promise<void> => {
      const currentHost = activeHost.current;
      if (!currentHost) return;
      try {
        const [currentDevice, player] = await Promise.all([fetchCommand(currentHost, "getStatusEx"), fetchCommand(currentHost, "getPlayerStatus")]);
        const payload = toPlayback(currentHost, currentDevice, player);
        const fingerprint = [payload.playbackProvider, payload.artist.name, payload.album?.title, payload.track.title, payload.playback.state].join("|").toLocaleLowerCase();
        if (fingerprint !== lastFingerprint.current) {
          const response = await fetch("/api/browser/playback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error(response.status === 401 ? "La sesión local venció; vuelve a conectar." : `Cloud respondió HTTP ${response.status}`);
          lastFingerprint.current = fingerprint;
        }
        setStatus("connected");
        setMessage(`WiiM conectado en ${currentHost}. Sincronizando solo cambios relevantes.`);
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "No fue posible sincronizar con el WiiM.");
      } finally {
        if (activeHost.current) timer.current = window.setTimeout(() => void poll(), 4_000);
      }
    };
    await poll();
  };

  const connect = async (): Promise<void> => {
    const codeResponse = await fetch("/api/browser/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: accessCode }) });
    if (!codeResponse.ok) {
      setStatus("error");
      setMessage(codeResponse.status === 503 ? "Esta instalación aún no tiene configurado el acceso local." : "El código de acceso no es válido.");
      return;
    }
    await start(host || undefined);
  };

  useEffect(() => {
    const storedHost = window.localStorage.getItem(storageKey) ?? "";
    setHost(storedHost);
    void fetch("/api/browser/session", { cache: "no-store" }).then(async (response) => response.ok ? response.json() as Promise<{ authenticated: boolean }> : { authenticated: false }).then((session) => {
      if (session.authenticated && storedHost) void start(storedHost);
    }).catch(() => undefined);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  // The bridge intentionally starts once. `start` owns its polling lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <section className={`local-wiim-bridge ${status}`} aria-live="polite">
    <div><p className="section-label">WiiM local</p><p>{message}</p></div>
    {status === "connected" || status === "connecting" ? <button type="button" onClick={stop}>Desconectar</button> : <div className="bridge-controls"><input aria-label="Dirección local del WiiM" value={host} onChange={(event) => setHost(event.target.value)} placeholder="WiiM local o 192.168.1.81" /><input aria-label="Código de acceso" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Código de acceso" type="password" /><button type="button" onClick={() => void connect()}>Conectar WiiM</button></div>}
  </section>;
};
