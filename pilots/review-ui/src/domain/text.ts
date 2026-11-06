export type Span = {
  start: number;
  end: number;
  phrase: string;
};

export function boundaryBefore(source: string, index: number): boolean {
  if (index <= 0) return true;
  return !isWordChar(source[index - 1] ?? "");
}

export function boundaryAfter(source: string, index: number): boolean {
  if (index >= source.length) return true;
  return !isWordChar(source[index] ?? "");
}

function isWordChar(char: string): boolean {
  return /[\p{L}\p{N}]/u.test(char);
}

export function findBounded(text: string, phrase: string): Span[] {
  const hay = text.toLowerCase();
  const needle = phrase.trim().toLowerCase();
  if (!needle) return [];
  const spans: Span[] = [];
  let from = 0;
  while (from < hay.length) {
    const index = hay.indexOf(needle, from);
    if (index < 0) break;
    const end = index + needle.length;
    if (boundaryBefore(hay, index) && boundaryAfter(hay, end)) {
      spans.push({ start: index, end, phrase: needle });
    }
    from = index + Math.max(1, needle.length);
  }
  return spans;
}

export function excerptAt(text: string, start: number, end: number): string {
  let from = Math.max(0, start - 28);
  let to = Math.min(text.length, end + 28);
  if (from > 0 && isWordChar(text[from - 1] ?? "") && isWordChar(text[from] ?? "")) {
    const nextBreak = text.slice(from, start).search(/[^\p{L}\p{N}]/u);
    if (nextBreak >= 0) from += nextBreak + 1;
  }
  if (to < text.length && isWordChar(text[to - 1] ?? "") && isWordChar(text[to] ?? "")) {
    const prevBreak = text.slice(end, to).search(/[^\p{L}\p{N}]/u);
    if (prevBreak >= 0) to = end + prevBreak;
  }
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

export function hashtagTokens(caption: string | null, hashtags: string[]): string[] {
  const fromList = hashtags.map(normalizeHashtag).filter(Boolean);
  const fromCaption = [...(caption ?? "").matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) =>
    match[1].toLowerCase(),
  );
  return [...fromList, ...fromCaption];
}

export function normalizeHashtag(tag: string): string {
  return tag.trim().toLowerCase().replace(/^#/, "");
}

export function overlaps(outer: Span, inner: Span): boolean {
  return inner.start < outer.end && outer.start < inner.end;
}

export function compactPhrase(phrase: string): string | null {
  if (!phrase.includes(" ")) return null;
  const compact = phrase.replace(/\s+/g, "");
  return compact.length > 0 ? compact : null;
}
