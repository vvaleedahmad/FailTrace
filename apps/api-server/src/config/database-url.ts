export function normalizePostgresUrl(url: string) {
  return new URL(url).toString();
}

export function deriveSupabaseDirectUrl(url?: string) {
  if (!url) {
    return undefined;
  }

  const parsed = new URL(normalizePostgresUrl(url));
  if (parsed.hostname.endsWith(".pooler.supabase.com") && parsed.port === "6543") {
    parsed.port = "5432";
    parsed.searchParams.delete("pgbouncer");
  }

  return parsed.toString();
}
