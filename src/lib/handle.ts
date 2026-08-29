export function parseHandle(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const fromUrl = t.match(
    /(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)/i,
  );
  const raw = (fromUrl?.[1] ?? t.replace(/^@/, "")).trim();
  if (!/^[A-Za-z0-9_]{1,80}$/.test(raw)) return null;
  return raw;
}
