import { z } from "zod";
import { blocksSchema } from "@/lib/blocks";
import type { MediaView } from "@/lib/media";

// Shared between the admin editor (client) and admin Server Actions.

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Turns an English title into a slug ("Kyoto in Autumn!" -> "kyoto-in-autumn"); empty for non-latin titles. */
export function slugify(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** The editable part of a post, sent by the editor on every save. */
export const postInputSchema = z.object({
  slug: z.string().trim().toLowerCase().max(120),
  sourceLang: z.enum(["EN", "JA"]),
  titleEn: z.string().max(200),
  titleJa: z.string().max(200),
  excerptEn: z.string().max(500),
  excerptJa: z.string().max(500),
  locationEn: z.string().max(120),
  locationJa: z.string().max(120),
  coverImageId: z.string().nullable(),
  /** The post's date as a calendar day ("2026-10-16"), shown on cards and the post; null until set or published. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  blocks: blocksSchema,
});
export type PostInput = z.infer<typeof postInputSchema>;

/** Today's date in the browser's own time zone, as "YYYY-MM-DD". */
export function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type EditorPost = PostInput & {
  id: string;
  type: "BLOG" | "PROJECT";
  status: "DRAFT" | "PUBLISHED";
  newsletterSentAt: string | null;
  updatedAt: string;
};

export type EditorMedia = MediaView & { status: "PROCESSING" | "READY" | "FAILED" };

export type EditorState = {
  post: EditorPost;
  media: Record<string, EditorMedia>;
  /** Translatable fields whose source text changed since they were last translated. */
  staleKeys: string[];
};

export type ActionResult<T = EditorState> = { ok: true; data: T; message?: string } | { ok: false; error: string };
