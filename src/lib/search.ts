// Punctuation-insensitive, token-AND substring matching for free-text
// search filters. "st topman" matches "St. Topman", "025 198" matches
// "025/198", word order doesn't matter.

export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchesQuery(
  query: string,
  ...haystacks: (string | null | undefined)[]
): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const tokens = q.split(" ").filter(Boolean);
  const hay = haystacks.map((h) => normalizeForSearch(h ?? "")).join(" ");
  return tokens.every((t) => hay.includes(t));
}
