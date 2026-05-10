/**
 * Best-effort regex-based wikitext parser for Bulbapedia "Game locations" sections.
 *
 * This parser is intentionally permissive: it extracts what it can, and gaps are
 * surfaced via the coverage report so manual overrides can fill them. Wikitext is
 * a complex template-based format; we don't aim for completeness, just usefulness.
 *
 * Output: a flat list of "RawAvailabilityEntry" with the game label as Bulbapedia
 * writes it (e.g., "Sword/Shield", "Brilliant Diamond/Shining Pearl"). Mapping to
 * our GameId is the next step (encounters normalizer).
 *
 * ACTUAL TEMPLATE FORMAT (observed in fixtures, Nov 2024 Bulbapedia):
 *
 *   Single-game obtainable:
 *     {{Availability/Entry1|v=Sword|t=FFF|area=Giant's Cap}}
 *
 *   Two-game obtainable:
 *     {{Availability/Entry2|v=Brilliant Diamond|v2=Shining Pearl|area=Trophy Garden}}
 *
 *   Single-game unobtainable:
 *     {{Availability/Entry1/None|v=Shield}}
 *
 *   Two-game unobtainable:
 *     {{Availability/Entry2/None|v=Scarlet|v2=Violet|area=Unobtainable}}
 *
 * NOTE: The plan's suggested regex `/\{\{Availability\/[^|}]+\|([^}]+)\}\}/g` does NOT
 * work because templates contain nested `{{...}}` constructs. Instead, we parse
 * line-by-line since each availability entry occupies exactly one line in practice.
 *
 * NOT HANDLED (will need manual overrides or future parser work):
 *   - {{Availability/Entry1|1|v=...}} with numeric positional first arg (side games section)
 *     — these are still captured because we look for |v= in the line.
 *   - Generation headers ({{Availability/Gen|gen=VIII}}) — intentionally skipped.
 *   - Cross-game sections ({{Availability/Cross}}) — skipped (side games).
 *   - Templates with |ex= modifier (Japanese-only Blue version) — v= is still extracted.
 *   - Entries where game name contains complex wiki markup in v= value — edge case.
 */

export type RawAvailabilityEntry = {
  gameLabel: string;
  rawDescription: string;
  isUnobtainable: boolean;
};

const SECTION_HEADERS = [/==\s*Game locations\s*==/i, /==\s*Availability\s*==/i];

/**
 * Extract the "Game locations" or "Availability" section from a Pokémon wikitext.
 * Returns the section content (without the heading) or undefined if not found.
 */
export function extractGameLocationsSection(wikitext: string): string | undefined {
  for (const headerPattern of SECTION_HEADERS) {
    const match = headerPattern.exec(wikitext);
    if (!match) continue;
    const start = match.index + match[0].length;
    // End: next ==Section== heading at the same level (==xxx==), or end of doc.
    const remainder = wikitext.slice(start);
    const nextSectionMatch = /^==[^=].*==/m.exec(remainder);
    const end = nextSectionMatch ? nextSectionMatch.index : remainder.length;
    return remainder.slice(0, end);
  }
  return undefined;
}

/**
 * Parse availability entries from a Game locations section.
 *
 * Bulbapedia uses {{Availability/Entry1}} and {{Availability/Entry2}} templates
 * with named parameters |v= (game 1) and |v2= (game 2). Unobtainable variants
 * use the /None suffix.
 *
 * Strategy: parse line-by-line. Each availability entry is one line starting with
 * `{{Availability/Entry`. Extract |v= and optionally |v2=, plus |area=.
 */
export function parseAvailabilityEntries(section: string): RawAvailabilityEntry[] {
  if (!section) return [];

  const entries: RawAvailabilityEntry[] = [];

  // Split into lines — each template call is on one line in Bulbapedia's wikitext.
  const lines = section.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Only process Availability/Entry lines (not Gen headers, Footer, NA, Cross, etc.)
    if (!trimmed.startsWith('{{Availability/Entry')) continue;

    // Determine if this entry is marked as unobtainable (/None suffix)
    const isNoneLine = /\{\{Availability\/Entry\d+\/None\b/i.test(trimmed);

    // Extract named params using a lightweight key=value parser
    const params = extractNamedParams(trimmed);

    const v1 = params.get('v');
    const v2 = params.get('v2');
    const area = params.get('area') ?? '';

    // "area=Unobtainable" is explicit unobtainability marker
    const isUnobtainableByArea = /unobtainable|not available/i.test(area);
    const isUnobtainable = isNoneLine || isUnobtainableByArea;

    // Emit one entry per game version in the template
    if (v1) {
      entries.push({
        gameLabel: v1.trim(),
        rawDescription: area,
        isUnobtainable,
      });
    }

    if (v2) {
      entries.push({
        gameLabel: v2.trim(),
        rawDescription: area,
        isUnobtainable,
      });
    }

    if (!v1 && !v2) {
      // Template with no |v= — log and skip.
      console.warn(
        `[bulbapedia-parser] Could not extract game label from: ${trimmed.slice(0, 120)}`,
      );
    }
  }

  return entries;
}

/**
 * Extract named template parameters (key=value) from a wikitext template call.
 *
 * The template call looks like:
 *   {{Availability/Entry2|v=Sword|v2=Shield|t=FFF|area=Some area}}
 *
 * Named params are pipe-separated segments containing '='. Positional params
 * (no '=') are ignored. Nested {{ }} are respected so that values containing
 * wiki templates don't get split at their pipe separators.
 */
function extractNamedParams(templateLine: string): Map<string, string> {
  const params = new Map<string, string>();

  // Find the opening {{ and the matching closing }}
  const openIdx = templateLine.indexOf('{{');
  if (openIdx === -1) return params;

  // Walk character-by-character to find the matching }}, respecting nesting
  let depth = 0;
  let innerStart = -1;
  let innerEnd = -1;

  for (let i = openIdx; i < templateLine.length - 1; i++) {
    if (templateLine[i] === '{' && templateLine[i + 1] === '{') {
      if (depth === 0) innerStart = i + 2; // content starts after opening {{
      depth++;
      i++; // skip next char
    } else if (templateLine[i] === '}' && templateLine[i + 1] === '}') {
      depth--;
      if (depth === 0) {
        innerEnd = i;
        break;
      }
      i++; // skip next char
    }
  }

  if (innerStart === -1 || innerEnd === -1) return params;

  // The inner content: "Availability/Entry1|v=Sword|t=FFF|area=Giant's Cap"
  const inner = templateLine.slice(innerStart, innerEnd);

  // Split on '|' at depth 0
  const segments = splitAtTopLevelPipes(inner);

  // First segment is the template name — skip it
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i] ?? '';
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) continue; // positional arg, skip
    const key = seg.slice(0, eqIdx).trim();
    const value = seg.slice(eqIdx + 1).trim();
    params.set(key, value);
  }

  return params;
}

/**
 * Split a string on '|' characters that are at depth 0 (not inside nested {{ }}).
 */
function splitAtTopLevelPipes(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i] as string;
    const next = s[i + 1];

    if (ch === '{' && next === '{') {
      depth++;
      current += '{{';
      i++;
    } else if (ch === '}' && next === '}') {
      depth--;
      current += '}}';
      i++;
    } else if (ch === '[' && next === '[') {
      depth++;
      current += '[[';
      i++;
    } else if (ch === ']' && next === ']') {
      depth--;
      current += ']]';
      i++;
    } else if (ch === '|' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current) parts.push(current);
  return parts;
}
