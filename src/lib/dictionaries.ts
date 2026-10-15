import "server-only";
import { notFound } from "next/navigation";
import en from "@/dictionaries/en.json";
import ja from "@/dictionaries/ja.json";
import { isLocale, type Locale } from "@/lib/i18n";

/** Narrow a route's `lang` param to a supported Locale (404 otherwise). */
export async function resolveLocale(params: Promise<{ lang: string }>): Promise<Locale> {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return lang;
}

// en.json is the source of truth for the shape; ja.json must provide every key
// (TypeScript fails the build if a key is missing).
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, ja };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
