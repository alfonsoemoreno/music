import dgram from "node:dgram";

/** Uses the renderer-specific and broad SSDP searches because WiiM firmware varies in its responses. */
export const discoverWiiM = async (timeoutMs = 2_500): Promise<string | undefined> => new Promise((resolve) => {
  const socket = dgram.createSocket("udp4");
  const message = (target: string): Buffer => Buffer.from(`M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: ${target}\r\n\r\n`);
  const finish = (host?: string) => { socket.close(); resolve(host); };
  const timer = setTimeout(() => finish(), timeoutMs);
  socket.on("message", (data) => {
    const response = data.toString("utf8");
    const server = /server:\s*([^\r\n]+)/i.exec(response)?.[1] ?? "";
    const location = /location:\s*(https?:\/\/[^\r\n]+)/i.exec(response)?.[1];
    let host: string | undefined;
    try { host = location ? new URL(location).hostname : undefined; } catch { host = undefined; }
    if (/wiim|linkplay/i.test(server) && host) { clearTimeout(timer); finish(host); }
  });
  for (const target of ["urn:schemas-upnp-org:device:MediaRenderer:1", "upnp:rootdevice", "ssdp:all"]) socket.send(message(target), 1900, "239.255.255.250", () => undefined);
});
