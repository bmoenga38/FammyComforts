/**
 * Public slug aliasing for the single tenant.
 *
 * The org is STORED with slug `demo` (the auth flow's `demoOrg` looks it up by
 * that literal — left untouched so login can't break). But guests should never
 * see "demo" in the URL, so the public booking routes use `fammycomforts` and
 * `orgBySlug` treats it as an alias for the stored org. Old `/book/demo` links
 * keep working (exact match); new links use `/book/fammycomforts`.
 */

/** What guests see in the URL: /book/<PUBLIC_ORG_SLUG>. */
export const PUBLIC_ORG_SLUG = "fammycomforts";

/** The slug the org is actually stored under (single-tenant). */
export const PRIMARY_ORG_SLUG = "demo";

/** True when `slug` is the public alias that should resolve to the stored org. */
export function isPublicAlias(slug: string): boolean {
  return slug === PUBLIC_ORG_SLUG;
}
