import { loadConfig } from "./config.js";
import { sendPlaybackEvent } from "./cloud-client.js";
import { discoverWiiM } from "./discovery.js";
import { PlaybackMonitorService } from "./playback-monitor.js";
import { createStatusServer, type AgentHealth } from "./status-server.js";
import { WiiMHttpClient } from "./wiim-client.js";
import { localArtworkBaseUrl } from "./local-network.js";

const config = loadConfig();
const health: AgentHealth = { wiimConnected: false, cloudConnected: false };
let client: WiiMHttpClient | undefined;
let artworkBaseUrl: string | undefined;
let monitor = new PlaybackMonitorService();
let discoveryAfter = 0;
let polling = false;
createStatusServer(config.localStatusPort, () => health, async () => client ? client.getLocalArtwork(health.localArtworkUrl) : undefined);

const connect = async (): Promise<void> => {
  if (client || Date.now() < discoveryAfter) return;
  discoveryAfter = Date.now() + 8_000;
  const discoveredHost = config.discovery ? await discoverWiiM() : undefined;
  const host = discoveredHost ?? config.wiimHost;
  if (!host) { health.wiimConnected = false; health.lastError = "Waiting for WiiM discovery"; console.log("[Discovery] Waiting for WiiM on the local network…"); return; }
  const candidate = new WiiMHttpClient(host);
  await candidate.getDeviceStatus();
  client = candidate; monitor.reset(); health.wiimHost = host; health.wiimConnected = true; health.lastError = undefined;
  artworkBaseUrl = config.localArtworkBaseUrl ?? localArtworkBaseUrl(host, config.localStatusPort);
  console.log(`[Discovery] WiiM found at ${host}${discoveredHost ? "" : " (manual fallback)"}`);
  if (artworkBaseUrl) console.log(`[Artwork] LAN relay available at ${artworkBaseUrl}/artwork/current`);
};

const poll = async (): Promise<void> => {
  if (polling) return;
  polling = true;
  try {
    await connect();
    if (!client) return;
    const detected = await client.getNowPlaying();
    health.localArtworkUrl = client.isLocalArtworkUrl(detected.album?.artworkUrl) ? detected.album?.artworkUrl : undefined;
    const nowPlaying = artworkBaseUrl && client.isLocalArtworkUrl(detected.album?.artworkUrl) && detected.album ? { ...detected, album: { ...detected.album, artworkUrl: `${artworkBaseUrl}/artwork/current` } } : detected;
    health.wiimConnected = true; health.nowPlaying = nowPlaying;
    const event = monitor.inspect(nowPlaying);
    if (!event) return;
    console.log(`[Playback] ${nowPlaying.artist.name} — ${nowPlaying.track.title} (${nowPlaying.playback.state})`);
    await sendPlaybackEvent(config.cloudApiUrl, config.agentToken, { ...nowPlaying, agentVersion: "0.1.0" });
    health.cloudConnected = true; health.lastError = undefined;
    console.log("[Cloud] Playback change sent successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    health.lastError = message;
    if (message.startsWith("Cloud") || message.includes("AGENT_TOKEN")) health.cloudConnected = false;
    else { health.wiimConnected = false; health.localArtworkUrl = undefined; client = undefined; artworkBaseUrl = undefined; }
    console.error(`[Playback] ${message}`);
  } finally { polling = false; }
};
await poll();
setInterval(() => void poll(), config.pollIntervalMs);
