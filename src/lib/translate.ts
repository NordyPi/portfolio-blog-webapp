import "server-only";
import { createHash } from "node:crypto";
import { localizedFields, type Block, type Localized } from "@/lib/blocks";
import { sanitizeRichText } from "@/lib/rich-text";

export class TranslateError extends Error {}

export type TranslatableDoc = {
  sourceLang: "EN" | "JA";
  titleEn: string;
  titleJa: string;
  excerptEn: string;
  excerptJa: string;
  locationEn: string;
  locationJa: string;
  blocks: Block[];
  /** fieldKey -> hash of the source text when it was last translated */
  translationState: Record<string, string>;
};

const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

type Entry = { key: string; field: Localized; html: boolean };

/** All translatable fields. Post-level fields are wrapped in temporary Localized objects (see writeBack). */
function entries(doc: TranslatableDoc) {
  const title: Localized = { en: doc.titleEn, ja: doc.titleJa };
  const excerpt: Localized = { en: doc.excerptEn, ja: doc.excerptJa };
  const location: Localized = { en: doc.locationEn, ja: doc.locationJa };
  const list: Entry[] = [
    { key: "title", field: title, html: false },
    { key: "excerpt", field: excerpt, html: false },
    { key: "location", field: location, html: false },
    ...doc.blocks.flatMap(localizedFields),
  ];
  const writeBack = () => {
    doc.titleEn = title.en;
    doc.titleJa = title.ja;
    doc.excerptEn = excerpt.en;
    doc.excerptJa = excerpt.ja;
    doc.locationEn = location.en;
    doc.locationJa = location.ja;
  };
  return { list, writeBack };
}

const langs = (doc: TranslatableDoc) =>
  doc.sourceLang === "EN" ? ({ src: "en", dst: "ja" } as const) : ({ src: "ja", dst: "en" } as const);

/**
 * Fields whose source text changed since it was last translated (or that were never translated).
 * Shown in the editor as "needs translation".
 */
export function staleTranslationKeys(doc: TranslatableDoc): string[] {
  const { src } = langs(doc);
  return entries(doc)
    .list.filter(({ key, field }) => field[src].trim() !== "" && doc.translationState[key] !== hash(field[src]))
    .map((e) => e.key);
}

async function deepl(texts: string[], sourceLang: "EN" | "JA", html: boolean): Promise<string[]> {
  if (texts.length === 0) return [];
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new TranslateError("DeepL is not configured (DEEPL_API_KEY is empty).");
  // Free-plan keys end in ":fx" and use a different host.
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const res = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: texts,
      source_lang: sourceLang,
      target_lang: sourceLang === "EN" ? "JA" : "EN-US",
      ...(html ? { tag_handling: "html" } : {}),
    }),
  });
  if (res.status === 456) throw new TranslateError("DeepL monthly character quota exceeded.");
  if (!res.ok) throw new TranslateError(`DeepL request failed (${res.status}).`);
  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}

/**
 * Translates source -> target for every stale field (or every field when `force`).
 * Fields whose source hasn't changed keep their current translation, including manual edits.
 * Mutates and returns `doc`, plus the keys that were translated.
 */
export async function translateDoc(doc: TranslatableDoc, opts: { force?: boolean } = {}) {
  const { src, dst } = langs(doc);
  const { list, writeBack } = entries(doc);
  const stale = new Set(staleTranslationKeys(doc));

  const todo = list.filter(({ key, field }) => {
    if (field[src].trim() === "") return false;
    return opts.force || stale.has(key) || field[dst].trim() === "";
  });

  for (const html of [false, true]) {
    const group = todo.filter((e) => e.html === html);
    const out = await deepl(
      group.map((e) => e.field[src]),
      doc.sourceLang,
      html,
    );
    group.forEach((e, i) => {
      e.field[dst] = html ? sanitizeRichText(out[i]) : out[i].trim();
      doc.translationState[e.key] = hash(e.field[src]);
    });
  }

  writeBack();
  return { doc, translated: todo.map((e) => e.key) };
}
