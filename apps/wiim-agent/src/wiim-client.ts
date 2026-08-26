import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { NowPlaying, PlaybackState } from "@music/domain";

export interface WiiMPlayerStatus { status?: string; curpos?: string; totlen?: string; mode?: string; vendor?: string; media_title?: string; title?: string; Title?: string; artist?: string; Artist?: string; album?: string; Album?: string; album_art?: string; artwork?: string; [key: string]: unknown }
export interface WiiMDeviceStatus { uuid?: string; DeviceName?: string; ssid?: string; project?: string; firmware?: string; [key: string]: unknown }

const requestJson = async (url: URL): Promise<Record<string, unknown>> => new Promise((resolve, reject) => {
  const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, { rejectUnauthorized: false, timeout: 4_000 }, (response) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => { body += chunk; });
    response.on("end", () => {
      if ((response.statusCode ?? 500) >= 400) return reject(new Error(`WiiM returned HTTP ${response.statusCode}`));
      try { resolve(JSON.parse(body) as Record<string, unknown>); } catch { reject(new Error("WiiM returned non-JSON data")); }
    });
  });
  request.on("timeout", () => request.destroy(new Error("WiiM request timed out")));
  request.on("error", reject);
  request.end();
});

const requestText = async (url: URL, body: string, soapAction: string): Promise<string> => new Promise((resolve, reject) => {
  const request = httpRequest(url, { timeout: 4_000, method: "POST", headers: { "content-type": "text/xml; charset=utf-8", soapaction: `"${soapAction}"`, "content-length": Buffer.byteLength(body) } }, (response) => {
    let responseBody = "";
    response.setEncoding("utf8");
    response.on("data", (chunk: string) => { responseBody += chunk; });
    response.on("end", () => (response.statusCode ?? 500) >= 400 ? reject(new Error(`WiiM UPnP returned HTTP ${response.statusCode}`)) : resolve(responseBody));
  });
  request.on("timeout", () => request.destroy(new Error("WiiM UPnP request timed out")));
  request.on("error", reject);
  request.end(body);
});

const numeric = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

/** Linkplay/WiiM currently returns Qobuz Title, Artist and Album as hexadecimal UTF-8. */
const decodeHtmlEntities = (value: string): string => value.replace(/&(?:apos|quot|amp|lt|gt|#39|#x27);/gi, (entity) => ({ "&apos;": "'", "&quot;": "\"", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'", "&#x27;": "'" })[entity.toLowerCase()] ?? entity);
const decodeWiiMText = (value: unknown): string | undefined => {
  if (typeof value !== "string" || !value) return undefined;
  const compact = value.replace(/\s/g, "");
  if (compact.length % 2 === 0 && /^[0-9a-f]+$/i.test(compact)) {
    const decoded = Buffer.from(compact, "hex").toString("utf8");
    if (decoded && !decoded.includes("�")) return decodeHtmlEntities(decoded);
  }
  return decodeHtmlEntities(value);
};

const stateFrom = (value: unknown): PlaybackState => value === "play" || value === "playing" ? "playing" : value === "pause" || value === "paused" ? "paused" : "stopped";
const providerFromMode = (mode: unknown): string => ({ "31": "spotify", "32": "tidal", "1": "airplay", "2": "dlna", "40": "aux", "41": "bluetooth", "43": "optical" }[String(mode)] ?? "wiim");
interface ProviderIdentity { key: string; label: string; albumId?: string }
export const providerIdentity = (vendor: unknown, mode: unknown): ProviderIdentity => {
  const raw = decodeWiiMText(vendor) ?? providerFromMode(mode);
  const spotifyAlbum = /^spotify:album:([a-z0-9]+)$/i.exec(raw);
  const key = spotifyAlbum ? "spotify" : raw.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "") || "wiim";
  const label = ({ spotify: "Spotify", tidal: "Tidal", qobuz: "Qobuz", airplay: "AirPlay", dlna: "DLNA", aux: "Aux", bluetooth: "Bluetooth", optical: "Optical", wiim: "WiiM" }[key] ?? raw);
  return { key, label, albumId: spotifyAlbum?.[1] };
};
interface UpnpTrackMetadata { artworkUrl?: string; trackId?: string; artistId?: string; albumId?: string; bitrate?: number; bitDepth?: number; sampleRate?: number }
interface WiiMMetaInfo { title?: string; artist?: string; album?: string; artworkUrl?: string; trackId?: string; bitrate?: number; bitDepth?: number; sampleRate?: number }
export interface LocalArtwork { body: Buffer; contentType: string }
const valueFromDidl = (metadata: string, name: string): string | undefined => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(metadata)?.[1];

/** Parses only safe metadata from AVTransport; streaming TrackURI is deliberately ignored. */
export const parseUpnpPositionInfo = (soapResponse: string): UpnpTrackMetadata => {
  const didl = decodeHtmlEntities(valueFromDidl(soapResponse, "TrackMetaData") ?? "");
  const number = (name: string): number | undefined => {
    const value = Number(decodeHtmlEntities(valueFromDidl(didl, name) ?? ""));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const text = (name: string): string | undefined => decodeHtmlEntities(valueFromDidl(didl, name) ?? "") || undefined;
  return { artworkUrl: text("upnp:albumArtURI"), trackId: text("song:id"), artistId: text("song:singerid"), albumId: text("song:albumid"), bitrate: number("song:bitrate"), bitDepth: number("song:format_s"), sampleRate: number("song:rate_hz") };
};

/** USB/library playback exposes its richer metadata through getMetaInfo instead of AVTransport on some firmware. */
export const parseMetaInfo = (response: Record<string, unknown>): WiiMMetaInfo => {
  const raw = response.metaData;
  if (!raw || typeof raw !== "object") return {};
  const metadata = raw as Record<string, unknown>;
  return { title: decodeWiiMText(metadata.title), artist: decodeWiiMText(metadata.artist), album: decodeWiiMText(metadata.album), artworkUrl: typeof metadata.albumArtURI === "string" ? metadata.albumArtURI : undefined, trackId: decodeWiiMText(metadata.trackId), bitrate: numeric(metadata.bitRate), bitDepth: numeric(metadata.bitDepth), sampleRate: numeric(metadata.sampleRate) };
};

export const normalizeWiiMStatus = (device: WiiMDeviceStatus, player: WiiMPlayerStatus): NowPlaying => {
  const provider = providerIdentity(player.vendor, player.mode);
  const albumTitle = decodeWiiMText(player.album) ?? decodeWiiMText(player.Album);
  return {
    deviceId: String(device.uuid ?? device.DeviceName ?? device.ssid ?? "wiim-unknown"),
    playbackProvider: provider.key,
    source: provider.label,
    artist: { name: decodeWiiMText(player.artist) ?? decodeWiiMText(player.Artist) ?? "Unknown artist" },
    track: { title: decodeWiiMText(player.media_title) ?? decodeWiiMText(player.title) ?? decodeWiiMText(player.Title) ?? "Unknown track", positionMs: numeric(player.curpos), durationMs: numeric(player.totlen) },
    album: albumTitle ? { title: albumTitle, artworkUrl: typeof player.album_art === "string" ? player.album_art : typeof player.artwork === "string" ? player.artwork : undefined } : undefined,
    playback: { state: stateFrom(player.status) },
    rawMetadata: { device, player },
  };
};

export class WiiMHttpClient {
  constructor(private readonly host: string) {}
  private async command(command: string): Promise<Record<string, unknown>> {
    const paths = ["https", "http"];
    let lastError: unknown;
    for (const protocol of paths) {
      try { return await requestJson(new URL(`${protocol}://${this.host}/httpapi.asp?command=${encodeURIComponent(command)}`)); }
      catch (error) { lastError = error; }
    }
    throw lastError instanceof Error ? lastError : new Error("Could not reach WiiM HTTP API");
  }
  async getDeviceStatus(): Promise<WiiMDeviceStatus> { return this.command("getStatusEx"); }
  async getPlayerStatus(): Promise<WiiMPlayerStatus> { return this.command("getPlayerStatus"); }
  async getMetaInfo(): Promise<WiiMMetaInfo> { return parseMetaInfo(await this.command("getMetaInfo")); }
  isLocalArtworkUrl(value: string | undefined): boolean {
    if (!value) return false;
    try { return new URL(value).hostname === this.host; } catch { return false; }
  }
  async getLocalArtwork(value: string | undefined): Promise<LocalArtwork | undefined> {
    if (!this.isLocalArtworkUrl(value) || !value) return undefined;
    const url = new URL(value);
    return new Promise((resolve, reject) => {
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, { rejectUnauthorized: false, timeout: 8_000 }, (response) => {
        const contentType = response.headers["content-type"]?.split(";")[0] ?? "image/jpeg";
        if ((response.statusCode ?? 500) >= 400 || !contentType.startsWith("image/")) { response.resume(); reject(new Error("WiiM artwork is unavailable")); return; }
        const chunks: Buffer[] = []; let size = 0;
        response.on("data", (chunk: Buffer) => { size += chunk.length; if (size > 6_000_000) request.destroy(new Error("WiiM artwork exceeds size limit")); else chunks.push(chunk); });
        response.on("end", () => resolve({ body: Buffer.concat(chunks), contentType }));
      });
      request.on("timeout", () => request.destroy(new Error("WiiM artwork request timed out")));
      request.on("error", reject);
      request.end();
    });
  }
  async getUpnpPositionInfo(): Promise<UpnpTrackMetadata> {
    const body = '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:GetPositionInfo></s:Body></s:Envelope>';
    const response = await requestText(new URL(`http://${this.host}:49152/upnp/control/rendertransport1`), body, "urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo");
    return parseUpnpPositionInfo(response);
  }
  async getNowPlaying(): Promise<NowPlaying> {
    const [device, player, upnp, meta] = await Promise.all([this.getDeviceStatus(), this.getPlayerStatus(), this.getUpnpPositionInfo().catch(() => undefined), this.getMetaInfo().catch(() => undefined)]);
    const nowPlaying = normalizeWiiMStatus(device, player);
    const providerInfo = providerIdentity(player.vendor, player.mode);
    const provider = providerInfo.key;
    const providerId = (kind: string, id: string | undefined): string | undefined => id ? `${provider}:${kind}:${id}` : undefined;
    const artist = nowPlaying.artist.name === "Unknown artist" && meta?.artist ? { ...nowPlaying.artist, name: meta.artist } : nowPlaying.artist;
    const track = nowPlaying.track.title === "Unknown track" && meta?.title ? { ...nowPlaying.track, title: meta.title } : nowPlaying.track;
    const album = nowPlaying.album ?? (meta?.album ? { title: meta.album } : undefined);
    return { ...nowPlaying, artist: { ...artist, externalId: providerId("artist", upnp?.artistId) }, track: { ...track, externalId: providerId("track", upnp?.trackId ?? meta?.trackId) }, album: album ? { ...album, externalId: providerId("album", upnp?.albumId ?? providerInfo.albumId), artworkUrl: upnp?.artworkUrl ?? meta?.artworkUrl ?? album.artworkUrl } : album, audio: upnp || meta ? { bitrate: upnp?.bitrate ?? meta?.bitrate, bitDepth: upnp?.bitDepth ?? meta?.bitDepth, sampleRate: upnp?.sampleRate ?? meta?.sampleRate } : undefined, rawMetadata: { device, player, upnp, meta } };
  }
}
