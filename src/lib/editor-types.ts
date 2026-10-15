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
  coverImageId: z.string().nullable(),
  blocks: blocksSchema,
});
export type PostInput = z.infer<typeof postInputSchema>;

export type EditorPost = PostInput & {
  id: string;
  type: "BLOG" | "PROJECT";
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
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
