export interface AgentConfig {
  cloudApiUrl: string;
  agentToken?: string;
  wiimHost?: string;
  discovery: boolean;
  pollIntervalMs: number;
  localStatusPort: number;
  localArtworkBaseUrl?: string;
}

const integer = (value: string | undefined, fallback: number): number => {
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : fallback;
};

export const loadConfig = (env = process.env): AgentConfig => ({
  cloudApiUrl: env.CLOUD_API_URL ?? "http://localhost:3000",
  agentToken: env.AGENT_TOKEN,
  wiimHost: env.WIIM_HOST,
  discovery: env.WIIM_DISCOVERY !== "false",
  pollIntervalMs: integer(env.PLAYBACK_POLL_INTERVAL, 2_000),
  localStatusPort: integer(env.LOCAL_STATUS_PORT, 3_847),
  localArtworkBaseUrl: env.LOCAL_ARTWORK_BASE_URL?.replace(/\/$/, ""),
});
