/**
 * Decodes the small, common subset of HTML entities that may arrive in music
 * metadata. React already escapes rendered text, so this converts presentation
 * artifacts such as `&apos;` back into ordinary text without rendering HTML.
 */
const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: "\u00a0",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

const decodeEntity = (entity: string): string => {
  const named = namedEntities[entity.toLowerCase()];
  if (named) return named;
  const numeric = entity.match(/^#(x[\da-f]+|\d+)$/i);
  if (!numeric) return `&${entity};`;
  const value = Number.parseInt(numeric[1].replace(/^x/i, ""), numeric[1].startsWith("x") || numeric[1].startsWith("X") ? 16 : 10);
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : `&${entity};`;
};

export const decodeHtmlEntities = (value: string): string => {
  let decoded = value;
  // Sources occasionally encode an already encoded value (for example,
  // `&amp;apos;`). Two passes cover that case without turning this into an HTML parser.
  for (let index = 0; index < 2; index += 1) {
    const next = decoded.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]*);/gi, (_match, entity: string) => decodeEntity(entity));
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};

/** Decodes text in plain API data recursively, including already cached metadata. */
export const decodeDisplayValue = <T>(value: T): T => {
  if (typeof value === "string") return decodeHtmlEntities(value) as T;
  if (Array.isArray(value)) return value.map(decodeDisplayValue) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeDisplayValue(item)])) as T;
  }
  return value;
};
