// Shared by server code, client components and proxy.ts, so keep it dependency-free.

export const locales = ["en", "ja"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const localeNames: Record<Locale, string> = { en: "English", ja: "日本語" };

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}

/** Replace the locale segment of a pathname, e.g. ("/en/blog/x", "ja") -> "/ja/blog/x". */
export function switchLocalePath(pathname: string, locale: Locale) {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) parts[1] = locale;
  else parts.splice(1, 0, locale);
  return parts.join("/") || `/${locale}`;
}

export function formatDate(date: Date | string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}
