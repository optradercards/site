// Punctuation-insensitive, token-AND substring matching for free-text
// search filters. "st topman" matches "St. Topman", "025 198" matches
// "025/198", word order doesn't matter.

export function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokenizeQuery(query: string): string[] {
  return normalizeForSearch(query).split(" ").filter(Boolean);
}

export function matchesQuery(
  query: string,
  ...haystacks: (string | null | undefined)[]
): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;
  const hay = haystacks.map((h) => normalizeForSearch(h ?? "")).join(" ");
  // Split for whole-word alias matching so a 2-letter ISO code doesn't
  // accidentally substring-match an unrelated word ("en" in "engineer").
  const hayWords = new Set(hay.split(/\s+/).filter(Boolean));
  return tokens.every((t) => {
    if (hay.includes(t)) return true;
    const aliases = LANGUAGE_ALIASES[t];
    return Boolean(aliases?.some((a) => hayWords.has(a)));
  });
}

// Language-name → ISO-code aliases. Lets "english" match `language='en'`,
// "japanese" match "ja"/"jp", etc. Add new ones here as catalogs grow.
const LANGUAGE_ALIASES: Record<string, readonly string[]> = {
  english:    ["en", "eng"],
  japanese:   ["ja", "jp", "jpn"],
  korean:     ["ko", "kr", "kor"],
  chinese:    ["zh", "cn", "chn", "zhs", "zht"],
  french:     ["fr", "fra", "fre"],
  german:     ["de", "ger", "deu"],
  spanish:    ["es", "spa"],
  italian:    ["it", "ita"],
  portuguese: ["pt", "por"],
  russian:    ["ru", "rus"],
  thai:       ["th", "tha"],
  vietnamese: ["vi", "vie"],
  indonesian: ["id", "ind"],
  dutch:      ["nl", "nld", "dut"],
  polish:     ["pl", "pol"],
};

function isLanguageColumn(col: string): boolean {
  return col === "language" || col.endsWith(".language");
}

// Server-side counterpart to matchesQuery — chains one .or() per token so
// PostgREST evaluates (col1 ~ tok OR col2 ~ tok) AND (...next token) etc.
// "DON Gold" against [name, card_number] matches "Don!! Card (Gold)" via
// ILIKE's punctuation-tolerant substring match.
//
// When the columns list includes a "language" column (top-level or embedded
// like "sets.language"), human-readable language names ("english",
// "japanese") are expanded to their ISO codes for that column only — so
// "DON Gold English" lands a JP-only card off the list.
//
// Tokens are normalised (lowercased, non-alphanumeric stripped) so commas
// or quotes can never break out of the .or() filter syntax.
//
// Returns the builder unchanged when the query is empty.
export function applyMultiWordIlike<T extends { or: (filter: string) => T }>(
  query: T,
  text: string,
  columns: string[],
): T {
  const tokens = tokenizeQuery(text);
  if (tokens.length === 0 || columns.length === 0) return query;
  const languageColumns = columns.filter(isLanguageColumn);
  let q = query;
  for (const tok of tokens) {
    // ILIKE wildcards (% _) are escaped at the column data level — our
    // tokens come from normaliseForSearch which already excludes them,
    // but belt-and-braces in case a future caller passes raw text.
    const safe = tok.replace(/[%_\\]/g, "");
    if (!safe) continue;
    const exprs: string[] = columns.map((c) => `${c}.ilike.%${safe}%`);
    // Expand alias codes against the language column(s) only; we don't
    // want "english" to suddenly match a card_number ILIKE '%en%'.
    const aliases = LANGUAGE_ALIASES[safe];
    if (aliases && languageColumns.length > 0) {
      for (const alias of aliases) {
        for (const c of languageColumns) {
          exprs.push(`${c}.ilike.%${alias}%`);
        }
      }
    }
    q = q.or(exprs.join(","));
  }
  return q;
}
