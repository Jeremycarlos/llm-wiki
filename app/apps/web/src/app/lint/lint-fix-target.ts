const SLUG_RE = /^[a-z0-9-]+$/;

/** Resolve the page target without depending on the language of the issue description. */
export function resolveMissingPageSlug(
  missingSlug: string | null | undefined,
  description: string,
): string | null {
  if (missingSlug && SLUG_RE.test(missingSlug)) return missingSlug;

  // Backward compatibility for results produced before missingSlug became
  // structured. This also normalizes legacy links such as [[GRPO]].
  const wikilink = description.match(/\[\[([a-z0-9-]+)(?:\|[^\]]+)?\]\]/i)?.[1];
  if (wikilink) return wikilink.toLowerCase();

  const legacyPrefix = description.match(/^([a-z0-9-]+)\s/i)?.[1];
  return legacyPrefix ? legacyPrefix.toLowerCase() : null;
}
