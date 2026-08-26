import { createServer } from "node:http";
import type { NowPlaying } from "@music/domain";

export interface AgentHealth { wiimHost?: string; wiimConnected: boolean; cloudConnected: boolean; nowPlaying?: NowPlaying; localArtworkUrl?: string; lastError?: string }
const loopback = (address: string | undefined): boolean => address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
export const createStatusServer = (port: number, getHealth: () => AgentHealth, getArtwork?: () => Promise<{ body: Buffer; contentType: string } | undefined>): void => {
  createServer(async (request, response) => {
    const health = getHealth();
    if (request.url === "/debug") {
      if (!loopback(request.socket.remoteAddress)) { response.writeHead(403); response.end("Debug is only available locally."); return; }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify({ wiimHost: health.wiimHost, wiimConnected: health.wiimConnected, cloudConnected: health.cloudConnected, lastError: health.lastError, rawMetadata: health.nowPlaying?.rawMetadata ?? null }, null, 2));
      return;
    }
    if (request.url === "/artwork/current") {
      try {
        const artwork = await getArtwork?.();
        if (!artwork) { response.writeHead(404); response.end("No local artwork available."); return; }
        response.writeHead(200, { "content-type": artwork.contentType, "cache-control": "no-store", "x-content-type-options": "nosniff" });
        response.end(artwork.body);
      } catch { response.writeHead(502); response.end("Could not retrieve WiiM artwork."); }
      return;
    }
    const current = health.nowPlaying;
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><title>Digital Album Companion Agent</title><style>body{font:16px system-ui;max-width:650px;margin:3rem auto;color:#251d18}h1{font-family:Georgia}dt{font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;color:#806f62}dd{margin:0 0 1.2rem} .ok{color:#39734a}.off{color:#a34a3d}</style><h1>Digital Album Companion Agent</h1><dl><dt>WiiM ${health.wiimHost ?? "—"}</dt><dd class="${health.wiimConnected ? "ok" : "off"}">● ${health.wiimConnected ? "Connected" : "Waiting"}</dd><dt>Cloud</dt><dd class="${health.cloudConnected ? "ok" : "off"}">● ${health.cloudConnected ? "Connected" : "Waiting"}${health.lastError ? `<br><small>${health.lastError}</small>` : ""}</dd><dt>Now playing</dt><dd>${current ? `${current.artist.name}<br>${current.track.title}<br>${current.album?.title ?? ""}` : "Nothing detected"}</dd><dt>Agent version</dt><dd>0.1.0</dd></dl><p><a href="/debug">Ver diagnóstico técnico</a></p>`);
  }).listen(port, getArtwork ? "0.0.0.0" : "127.0.0.1", () => console.log(`[Status] http://${getArtwork ? "0.0.0.0" : "localhost"}:${port}`));
};
