const PROBE_TIMEOUT_MS = 5000;

/**
 * Some sites only serve content on `www.<domain>` (or vice versa) and don't redirect the other
 * form — e.g. no A record for the bare domain, or a vhost that answers with an empty/blank
 * response instead of a 301. Scrapio (and Apify's single-page fetch) hit exactly the URL they're
 * given and don't retry across hosts, so a URL like `https://example.com` can silently return
 * nothing even though `https://www.example.com` works fine.
 *
 * This does a cheap HEAD request from our own backend (following redirects) to find a host that
 * actually answers before handing the URL to the scraper, trying the given URL first and then the
 * www-toggled host. Falls back to the original URL unchanged if neither responds, so callers see
 * the same failure they would have seen before this check existed.
 */
export async function resolveReachableWebsiteUrl(
  url: string,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<string> {
  const primary = await probe(url, timeoutMs);
  if (primary) return primary;

  const alternate = toggleWwwHost(url);
  if (alternate) {
    const resolved = await probe(alternate, timeoutMs);
    if (resolved) return resolved;
  }

  return url;
}

async function probe(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.url || url;
  } catch {
    return null;
  }
}

function toggleWwwHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    parsed.hostname = parsed.hostname.startsWith('www.')
      ? parsed.hostname.slice(4)
      : `www.${parsed.hostname}`;
    return parsed.toString();
  } catch {
    return null;
  }
}
