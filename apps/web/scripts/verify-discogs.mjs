const token = process.env.DISCOGS_TOKEN;
if (!token) {
  console.error("DISCOGS_TOKEN is not configured in .env.local");
  process.exitCode = 1;
} else {
  const response = await fetch("https://api.discogs.com/oauth/identity", { headers: { authorization: `Discogs token=${token}`, "user-agent": "DigitalAlbumCompanion/0.1.0" } });
  if (!response.ok) {
    console.error(`Discogs authentication failed (HTTP ${response.status}). Generate a new Personal Access Token in Discogs Settings → Developers.`);
    process.exitCode = 1;
  } else {
    const identity = await response.json();
    console.log(`Discogs connected as ${identity.username}`);
  }
}
