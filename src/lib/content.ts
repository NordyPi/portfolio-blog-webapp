import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { blockMediaIds, blocksSchema, pickText, type Block } from "@/lib/blocks";
import type { Locale } from "@/lib/i18n";
import { mediaSelect, toMediaView, type MediaView } from "@/lib/media";

/**
 * Public, published content. Every exported reader first calls connection() so nothing is read
 * from the database at build time (the Docker image is built without one); results are then
 * cached in memory and invalidated with updateTag(POSTS_TAG) whenever the admin saves a post.
 */
export const POSTS_TAG = "posts";

export type PostKind = "BLOG" | "PROJECT";

export type PostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** "Kyoto, Japan"; empty when not set (always empty for projects). */
  location: string;
  publishedAt: string;
  cover: MediaView | null;
};

export type PublishedPost = PostCard & {
  type: PostKind;
  sourceLang: Locale;
  blocks: Block[];
  media: Record<string, MediaView>;
};

async function listPublishedCached(type: PostKind, locale: Locale, limit: number | undefined) {
  "use cache";
  cacheLife("max");
  cacheTag(POSTS_TAG);

  const posts = await db.post.findMany({
    where: { type, status: "PUBLISHED" },
    // Posts on the same day: most recently created first.
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { coverImage: { select: mediaSelect } },
  });
  return posts.map(
    (p): PostCard => ({
      id: p.id,
      slug: p.slug,
      title: pickText(p.titleEn, p.titleJa, locale),
      excerpt: pickText(p.excerptEn, p.excerptJa, locale),
      location: pickText(p.locationEn, p.locationJa, locale),
      publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
      cover: p.coverImage ? toMediaView(p.coverImage) : null,
    }),
  );
}

export async function listPublished(type: PostKind, locale: Locale, limit?: number) {
  await connection();
  return listPublishedCached(type, locale, limit);
}

async function getPublishedPostCached(type: PostKind, slug: string, locale: Locale) {
  "use cache";
  cacheLife("max");
  cacheTag(POSTS_TAG);

  const p = await db.post.findUnique({
    where: { type_slug: { type, slug }, status: "PUBLISHED" },
    include: { coverImage: { select: mediaSelect } },
  });
  if (!p) return null;

  const blocks = blocksSchema.parse(p.blocks);
  const mediaRows = await db.media.findMany({
    where: { id: { in: blockMediaIds(blocks) }, status: "READY" },
    select: mediaSelect,
  });

  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    sourceLang: p.sourceLang === "JA" ? "ja" : "en",
    title: pickText(p.titleEn, p.titleJa, locale),
    excerpt: pickText(p.excerptEn, p.excerptJa, locale),
    location: pickText(p.locationEn, p.locationJa, locale),
    publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
    cover: p.coverImage ? toMediaView(p.coverImage) : null,
    blocks,
    media: Object.fromEntries(mediaRows.map((m) => [m.id, toMediaView(m)])),
  } satisfies PublishedPost;
}

export async function getPublishedPost(type: PostKind, slug: string, locale: Locale) {
  await connection();
  return getPublishedPostCached(type, slug, locale);
}
