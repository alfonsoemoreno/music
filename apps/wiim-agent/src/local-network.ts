import { networkInterfaces } from "node:os";

interface NetworkAddress { address: string; family: string | number; internal: boolean }
type NetworkMap = Record<string, NetworkAddress[] | undefined>;

const ipv4 = (value: string): number[] | undefined => {
  const parts = value.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : undefined;
};
const sameSubnet = (left: string, right: string): boolean => {
  const a = ipv4(left); const b = ipv4(right);
  return Boolean(a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2]);
};
const privateAddress = (value: string): boolean => {
  const parts = ipv4(value);
  return Boolean(parts && (parts[0] === 10 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31));
};

/** Selects the address most likely reachable by a tablet on the same LAN as the WiiM. */
export const localArtworkBaseUrl = (wiimHost: string, port: number, interfaces: NetworkMap = networkInterfaces()): string | undefined => {
  const candidates = Object.values(interfaces).flatMap((entries) => entries ?? []).filter((entry) => String(entry.family) === "IPv4" && !entry.internal).map((entry) => entry.address);
  const address = candidates.find((candidate) => sameSubnet(candidate, wiimHost)) ?? candidates.find(privateAddress);
  return address ? `http://${address}:${port}` : undefined;
};
