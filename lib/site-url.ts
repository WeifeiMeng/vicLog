const fallbackSiteUrl = "https://example.com";
const invalidSiteUrlMessage =
  "NEXT_PUBLIC_SITE_URL must be an absolute http(s) origin without credentials, a path, query, or hash (for example, https://blog.example.com).";

export function normalizeSiteUrl(value: string | undefined): string {
  if (!value) return fallbackSiteUrl;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(invalidSiteUrlMessage);
  }

  const hasNonRootPath = parsed.pathname.replace(/\/+$/, "") !== "";
  const hasQueryOrHash = value.includes("?") || value.includes("#");
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    hasNonRootPath ||
    hasQueryOrHash
  ) {
    throw new Error(invalidSiteUrlMessage);
  }

  return parsed.origin;
}

export const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
