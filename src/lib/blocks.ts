import { z } from "zod";

// Shared by the admin editor (client) and the renderer/translator (server).
// Layout and media are shared between languages; every piece of text is { en, ja }.

export const localizedSchema = z.object({ en: z.string(), ja: z.string() });
export type Localized = z.infer<typeof localizedSchema>;

/** The requested language, falling back to the other one if it hasn't been written/translated yet. */
export function pickText(en: string, ja: string, locale: "en" | "ja") {
  return (locale === "ja" ? ja || en : en || ja).trim();
}

export const localize = (field: Localized, locale: "en" | "ja") => pickText(field.en, field.ja, locale);

const id = z.string().min(1);
/** A Media.id, or null while the slot is still empty in a draft. */
const mediaRef = z.string().min(1).nullable();

export const blockSchema = z.discriminatedUnion("type", [
  /** Large hero image, typically the first block of a post. */
  z.object({ id, type: z.literal("cover"), mediaId: mediaRef, caption: localizedSchema }),
  /** Full-width banner image with a short height. */
  z.object({ id, type: z.literal("wide"), mediaId: mediaRef, caption: localizedSchema }),
  /** Full-width photo shown whole, at its own shape (no cropping). */
  z.object({ id, type: z.literal("photo"), mediaId: mediaRef, caption: localizedSchema }),
  /** 50/50 image + rich text, image on either side. */
  z.object({
    id,
    type: z.literal("split"),
    imageSide: z.enum(["left", "right"]),
    mediaId: mediaRef,
    text: localizedSchema,
  }),
  /** Two or three portrait (phone-shaped) slots side by side; each slot holds a photo or a video. */
  z.object({
    id,
    type: z.literal("row"),
    mediaIds: z.array(mediaRef).min(2).max(3),
    caption: localizedSchema,
  }),
  /** Standalone rich text. */
  z.object({ id, type: z.literal("text"), text: localizedSchema }),
  /** Uploaded video or a YouTube embed. */
  z.object({
    id,
    type: z.literal("video"),
    source: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("upload"), mediaId: mediaRef }),
      z.object({ kind: z.literal("youtube"), videoId: z.string().regex(/^[\w-]{11}$/).or(z.literal("")) }),
    ]),
    caption: localizedSchema,
  }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

/** Older posts stored three-photo rows as `triple`; read them as a row of 3 (saved back in the new form). */
const upgradeLegacy = (b: unknown) =>
  b && typeof b === "object" && (b as { type?: unknown }).type === "triple" ? { ...b, type: "row" } : b;
export const blocksSchema = z.array(z.preprocess(upgradeLegacy, blockSchema));

/**
 * Width/height of each image slot as displayed by src/components/block-renderer.tsx (keep in sync).
 * The editor's cropper frames uploads to these shapes. "wide" is shown full-width at a fixed height,
 * so its real shape varies with screen size; 3:1 is a good middle ground. "photo" isn't cropped.
 * Row slots are 2:3: portrait phone photos (3:4) lose only a little at the sides, and phone videos
 * (9:16) are shown whole with slim bars.
 */
export const IMAGE_RATIOS = { cover: 16 / 9, wide: 3, split: 4 / 5, row: 2 / 3, card: 4 / 3 } as const;

/** Options shown in the editor's "Add block" dropdown. */
export const BLOCK_OPTIONS = [
  { value: "cover", label: "Cover picture (large hero)" },
  { value: "photo", label: "Full-width photo (uncropped)" },
  { value: "wide", label: "Wide picture (short banner)" },
  { value: "split-left", label: "Image left / text right" },
  { value: "split-right", label: "Text left / image right" },
  { value: "row-2", label: "Row of 2 (photos or videos)" },
  { value: "row-3", label: "Row of 3 (photos or videos)" },
  { value: "text", label: "Text only" },
  { value: "video", label: "Video (upload or YouTube)" },
] as const;
export type BlockOption = (typeof BLOCK_OPTIONS)[number]["value"];

const empty = (): Localized => ({ en: "", ja: "" });

export function newBlock(option: BlockOption): Block {
  const id = crypto.randomUUID();
  switch (option) {
    case "cover":
    case "wide":
    case "photo":
      return { id, type: option, mediaId: null, caption: empty() };
    case "split-left":
    case "split-right":
      return { id, type: "split", imageSide: option === "split-left" ? "left" : "right", mediaId: null, text: empty() };
    case "row-2":
      return { id, type: "row", mediaIds: [null, null], caption: empty() };
    case "row-3":
      return { id, type: "row", mediaIds: [null, null, null], caption: empty() };
    case "text":
      return { id, type: "text", text: empty() };
    case "video":
      return { id, type: "video", source: { kind: "youtube", videoId: "" }, caption: empty() };
  }
}

/** Every Media.id referenced by a list of blocks (for loading them in one query). */
export function blockMediaIds(blocks: Block[]): string[] {
  const ids = blocks.flatMap((b) => {
    switch (b.type) {
      case "cover":
      case "wide":
      case "photo":
      case "split":
        return [b.mediaId];
      case "row":
        return b.mediaIds;
      case "video":
        return b.source.kind === "upload" ? [b.source.mediaId] : [];
      case "text":
        return [];
    }
  });
  return [...new Set(ids.filter((x): x is string => Boolean(x)))];
}

/**
 * The translatable text fields of a block. `key` is stable across saves and is used to remember
 * which source text was last translated; `html` says whether the field contains rich text.
 * The returned `field` objects are the live objects inside the block, so they can be written to.
 */
export function localizedFields(block: Block): { key: string; field: Localized; html: boolean }[] {
  switch (block.type) {
    case "split":
    case "text":
      return [{ key: `${block.id}.text`, field: block.text, html: true }];
    case "cover":
    case "wide":
    case "photo":
    case "row":
    case "video":
      return [{ key: `${block.id}.caption`, field: block.caption, html: false }];
  }
}

/** Accepts any common YouTube URL (watch, youtu.be, shorts, embed) or a bare 11-character id. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  try {
    const url = new URL(s);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v) return v;
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}
