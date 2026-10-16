import "server-only";
import { blockMediaIds, blocksSchema, localizedFields, type Block } from "@/lib/blocks";
import { db } from "@/lib/db";
import { SLUG_RE, type EditorState, type PostInput } from "@/lib/editor-types";
import { mediaSelect, toMediaView } from "@/lib/media";
import { sanitizeRichText } from "@/lib/rich-text";
import { staleTranslationKeys } from "@/lib/translate";

type PostRow = NonNullable<Awaited<ReturnType<typeof db.post.findUnique>>>;

export function translationState(row: Pick<PostRow, "translationState">): Record<string, string> {
  const s = row.translationState;
  return s && typeof s === "object" && !Array.isArray(s) ? (s as Record<string, string>) : {};
}

/** Everything the editor needs for one post. */
export async function loadEditorState(id: string): Promise<EditorState | null> {
  const row = await db.post.findUnique({ where: { id } });
  if (!row) return null;
  const blocks = blocksSchema.parse(row.blocks);

  const ids = [...blockMediaIds(blocks), ...(row.coverImageId ? [row.coverImageId] : [])];
  const media = await db.media.findMany({ where: { id: { in: ids } }, select: { ...mediaSelect, status: true } });

  const doc = { ...row, blocks, translationState: translationState(row) };
  return {
    post: {
      id: row.id,
      type: row.type,
      status: row.status,
      slug: row.slug,
      sourceLang: row.sourceLang,
      titleEn: row.titleEn,
      titleJa: row.titleJa,
      excerptEn: row.excerptEn,
      excerptJa: row.excerptJa,
      locationEn: row.locationEn,
      locationJa: row.locationJa,
      coverImageId: row.coverImageId,
      blocks,
      // Dates are stored as midnight UTC of the chosen day, so the UTC date is the calendar day.
      date: row.publishedAt?.toISOString().slice(0, 10) ?? null,
      newsletterSentAt: row.newsletterSentAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    },
    media: Object.fromEntries(media.map((m) => [m.id, { ...toMediaView(m), status: m.status }])),
    staleKeys: staleTranslationKeys(doc),
  };
}

/** Sanitize rich text and trim plain text in every block, in both languages. */
function cleanBlocks(blocks: Block[]): Block[] {
  const copy = structuredClone(blocks);
  for (const block of copy) {
    for (const { field, html } of localizedFields(block)) {
      field.en = html ? sanitizeRichText(field.en) : field.en.trim().slice(0, 300);
      field.ja = html ? sanitizeRichText(field.ja) : field.ja.trim().slice(0, 300);
    }
  }
  return copy;
}

export class PostValidationError extends Error {}

/** "2026-10-16" -> that day at midnight UTC. Display uses UTC too, so every visitor sees the same day. */
export function dayToDate(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  const year = date.getUTCFullYear();
  if (Number.isNaN(date.getTime()) || year < 1900 || year > 2100) throw new PostValidationError("That date isn't valid.");
  return date;
}

/** Validates and writes the editor's input. Returns the saved row. */
export async function writePost(id: string, input: PostInput) {
  const existing = await db.post.findUnique({ where: { id }, select: { type: true, status: true, publishedAt: true } });
  if (!existing) throw new PostValidationError("Post not found.");

  // A published post always keeps a date: clearing the field leaves the current one in place.
  const publishedAt = input.date ? dayToDate(input.date) : existing.status === "PUBLISHED" ? existing.publishedAt : null;

  if (!SLUG_RE.test(input.slug)) {
    throw new PostValidationError("The URL slug may only contain lowercase letters, numbers and single dashes (e.g. kyoto-in-autumn).");
  }
  const clash = await db.post.findFirst({ where: { type: existing.type, slug: input.slug, NOT: { id } }, select: { id: true } });
  if (clash) throw new PostValidationError(`Another ${existing.type === "BLOG" ? "post" : "project"} already uses the slug "${input.slug}".`);

  if (input.coverImageId) {
    const cover = await db.media.findFirst({ where: { id: input.coverImageId, kind: "IMAGE" }, select: { id: true } });
    if (!cover) throw new PostValidationError("Cover image not found.");
  }

  return db.post.update({
    where: { id },
    data: {
      slug: input.slug,
      sourceLang: input.sourceLang,
      titleEn: input.titleEn.trim(),
      titleJa: input.titleJa.trim(),
      excerptEn: input.excerptEn.trim(),
      excerptJa: input.excerptJa.trim(),
      locationEn: input.locationEn.trim(),
      locationJa: input.locationJa.trim(),
      coverImageId: input.coverImageId,
      publishedAt,
      blocks: cleanBlocks(input.blocks),
    },
  });
}
