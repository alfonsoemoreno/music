import type { AgentPlaybackPayload } from "@music/domain";
export const sendPlaybackEvent = async (baseUrl: string, token: string | undefined, payload: AgentPlaybackPayload): Promise<void> => {
  if (!token) throw new Error("AGENT_TOKEN is not configured");
  const response = await fetch(new URL("/api/agent/playback", baseUrl), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Cloud returned HTTP ${response.status}`);
};
