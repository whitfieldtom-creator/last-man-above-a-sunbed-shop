const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

function apiFootballKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  return key;
}

export async function apiFootballGet<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(API_FOOTBALL_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { "x-apisports-key": apiFootballKey() },
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}
