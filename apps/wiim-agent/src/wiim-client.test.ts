import { describe, expect, it } from "vitest";
import { normalizeWiiMStatus, parseMetaInfo, parseUpnpPositionInfo, providerIdentity } from "./wiim-client.js";
import { localArtworkBaseUrl } from "./local-network.js";
describe("normalizeWiiMStatus", () => {
  it("normalizes a documented player response without assuming metadata", () => {
    const result = normalizeWiiMStatus({ uuid: "abc" }, { status: "play", mode: "32", curpos: "184919", totlen: "240000" });
    expect(result).toMatchObject({ deviceId: "abc", playbackProvider: "tidal", playback: { state: "playing" }, track: { positionMs: 184919, durationMs: 240000 } });
  });
  it("decodes hexadecimal Qobuz metadata from WiiM Ultra firmware", () => {
    const result = normalizeWiiMStatus({ uuid: "ultra" }, { vendor: "Qobuz", status: "play", mode: "10", Title: "4D6F76656D656E742036", Artist: "466C6F6174696E6720506F696E7473", Album: "50726F6D69736573" });
    expect(result).toMatchObject({ playbackProvider: "qobuz", artist: { name: "Floating Points" }, track: { title: "Movement 6" }, album: { title: "Promises" } });
  });
  it("decodes HTML entities returned by a streaming provider", () => {
    const result = normalizeWiiMStatus({ uuid: "ultra" }, { status: "play", Title: "You Know I&apos;m No Good", Artist: "Amy Winehouse", Album: "Back To Black" });
    expect(result.track.title).toBe("You Know I'm No Good");
  });
  it("reads Qobuz artwork and audio properties from AVTransport DIDL-Lite", () => {
    const soap = "<TrackMetaData>&lt;item&gt;&lt;song:id&gt;98755916&lt;/song:id&gt;&lt;song:singerid&gt;37277&lt;/song:singerid&gt;&lt;song:albumid&gt;y12i2o992cg9b&lt;/song:albumid&gt;&lt;upnp:albumArtURI&gt;https://static.qobuz.com/cover.jpg&lt;/upnp:albumArtURI&gt;&lt;song:bitrate&gt;2639&lt;/song:bitrate&gt;&lt;song:format_s&gt;24&lt;/song:format_s&gt;&lt;song:rate_hz&gt;96000&lt;/song:rate_hz&gt;&lt;/item&gt;</TrackMetaData>";
    expect(parseUpnpPositionInfo(soap)).toEqual({ artworkUrl: "https://static.qobuz.com/cover.jpg", trackId: "98755916", artistId: "37277", albumId: "y12i2o992cg9b", bitrate: 2639, bitDepth: 24, sampleRate: 96000 });
  });
  it("extracts a Spotify album identifier embedded in WiiM vendor metadata", () => {
    expect(providerIdentity("spotify:album:5qC5YqtLMlsm5Pyl6GtfpP", "31")).toEqual({ key: "spotify", label: "Spotify", albumId: "5qC5YqtLMlsm5Pyl6GtfpP" });
  });
  it("reads USB artwork and technical metadata from getMetaInfo", () => {
    expect(parseMetaInfo({ metaData: { title: "Shake It Off", artist: "Taylor Swift", album: "1989", albumArtURI: "https://wiim.local/data/cover.jpeg", sampleRate: "44100", bitDepth: "16", bitRate: "1037", trackId: "1$7$73$5" } })).toEqual({ title: "Shake It Off", artist: "Taylor Swift", album: "1989", artworkUrl: "https://wiim.local/data/cover.jpeg", sampleRate: 44100, bitDepth: 16, bitrate: 1037, trackId: "1$7$73$5" });
  });
});

describe("localArtworkBaseUrl", () => {
  it("chooses the agent address on the WiiM subnet without configuration", () => {
    expect(localArtworkBaseUrl("192.168.1.88", 3847, { lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }], en0: [{ address: "192.168.1.20", family: "IPv4", internal: false }], bridge0: [{ address: "172.17.0.1", family: "IPv4", internal: false }] })).toBe("http://192.168.1.20:3847");
  });
});
