/**
 * One owner for CMS_PUBLIC_MENU_SOURCE_URL shape.
 * Menu reads and media proxy must agree: HTTPS, exact /api/menu path, no userinfo.
 */
export function assertPublicMenuSourceUrl(source: string): URL {
  const parsed = new URL(source);
  if (
    parsed.protocol !== "https:" ||
    parsed.pathname !== "/api/menu" ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      "CMS_PUBLIC_MENU_SOURCE_URL must be an HTTPS public menu endpoint.",
    );
  }
  return parsed;
}

export function publicMenuSourceOrigin(source: string): string {
  return assertPublicMenuSourceUrl(source).origin;
}
