// Imports the hand-written posts from the old site as DRAFT blog posts.
//
//   tsx --conditions=react-server scripts/old-posts/import.ts --posts <folder with post01/ …> [--only post01,post02] [--write]
//
// Without --write it's a dry run: it reports what it would create and changes nothing.
// With --write it processes media through the normal upload pipeline (WebP / H.264, metadata stripped)
// and creates or updates draft posts. Safe to re-run:
//   - media already imported is reused (tracked in <UPLOAD_DIR>/.old-post-import.json), so videos aren't re-transcoded
//   - a post imported before is updated in place — unless it has been published since, then it's left alone
// Nothing is published and no subscriber emails are sent.
import "dotenv/config";
import { existsSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { blocksSchema, type Block } from "@/lib/blocks";
import { dayToDate } from "@/lib/admin-posts";
import { db } from "@/lib/db";
import { slugify } from "@/lib/editor-types";
import { sanitizeRichText } from "@/lib/rich-text";
import { UPLOAD_DIR } from "@/lib/upload-dir";
import { processVideo, saveImage, stageVideo } from "@/lib/uploads";
import { htmlToText, makeExcerpt, parseStartDate } from "./helpers";
import { parseOldPost, type MediaRef, type OldPost } from "./parse";

const DEFAULT_YEAR = 2024;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const postsRoot = arg("--posts");
const only = arg("--only")?.split(",").map((s) => s.trim());
const write = args.includes("--write");
if (!postsRoot) {
  console.error("Usage: import.ts --posts <folder> [--only post01,post02] [--write]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Progress state (which old files and posts have already been imported)
// ---------------------------------------------------------------------------

type State = { media: Record<string, string>; posts: Record<string, string> };
const STATE_FILE = path.join(UPLOAD_DIR, ".old-post-import.json");

async function loadState(): Promise<State> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as State;
  } catch {
    return { media: {}, posts: {} };
  }
}
const saveState = (s: State) => writeFile(STATE_FILE, JSON.stringify(s, null, 2));

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** Imports one old file (or reuses it from a previous run). Returns the new Media id. */
async function importMedia(post: OldPost, ref: MediaRef, state: State, stats: { reused: number; images: number; videos: number }) {
  const key = `${post.id}/${ref.file}`;
  const known = state.media[key];
  if (known) {
    const existing = await db.media.findUnique({ where: { id: known }, select: { status: true } });
    if (existing?.status === "READY") {
      stats.reused++;
      return known;
    }
  }
  const file = path.join(post.dir, ref.file);
  const buffer = await readFile(file);
  let id: string;
  if (ref.type === "image") {
    id = (await saveImage(buffer)).id;
    stats.images++;
  } else {
    const started = Date.now();
    process.stdout.write(`      transcoding ${ref.file} (${Math.round(buffer.length / 1e6)} MB)… `);
    const staged = await stageVideo(buffer);
    await processVideo(staged.id);
    const done = await db.media.findUniqueOrThrow({ where: { id: staged.id }, select: { status: true } });
    console.log(`${done.status === "READY" ? "done" : "FAILED"} in ${Math.round((Date.now() - started) / 1000)}s`);
    if (done.status !== "READY") throw new Error(`Video ${key} failed to process`);
    id = staged.id;
    stats.videos++;
  }
  state.media[key] = id;
  await saveState(state); // record progress after every file, so an interrupted run resumes here
  return id;
}

// ---------------------------------------------------------------------------
// Mapping old elements to new blocks
// ---------------------------------------------------------------------------

const L = (en: string) => ({ en, ja: "" });
const newId = () => crypto.randomUUID();

/** Builds the blocks. `media` resolves an old file to a Media id (or a placeholder in a dry run). */
async function toBlocks(post: OldPost, media: (ref: MediaRef) => Promise<string>) {
  const blocks: Block[] = [];
  if (post.cover) blocks.push({ id: newId(), type: "cover", mediaId: await media(post.cover), caption: L("") });

  for (const el of post.elements) {
    if (el.kind === "text") {
      blocks.push({ id: newId(), type: "text", text: L(sanitizeRichText(el.html)) });
    } else if (el.kind === "combo") {
      if (el.image.type === "image") {
        blocks.push({
          id: newId(),
          type: "split",
          imageSide: el.imageFirst ? "left" : "right",
          mediaId: await media(el.image),
          text: L(sanitizeRichText(el.html)),
        });
      } else {
        // Text + video: the split block only takes photos, so show them one after the other.
        blocks.push({ id: newId(), type: "text", text: L(sanitizeRichText(el.html)) });
        blocks.push({ id: newId(), type: "video", source: { kind: "upload", mediaId: await media(el.image) }, caption: L("") });
      }
    } else if (el.kind === "row") {
      if (el.items.length === 1) {
        const [item] = el.items;
        blocks.push(
          item.type === "image"
            ? { id: newId(), type: "photo", mediaId: await media(item), caption: L("") }
            : { id: newId(), type: "video", source: { kind: "upload", mediaId: await media(item) }, caption: L("") },
        );
      } else {
        // Rows hold 2 or 3; longer rows (none so far) would be split into rows of up to 3.
        for (let i = 0; i < el.items.length; i += 3) {
          const chunk = el.items.slice(i, i + 3);
          if (chunk.length === 1) {
            blocks.push({ id: newId(), type: "photo", mediaId: await media(chunk[0]), caption: L("") });
            continue;
          }
          const mediaIds: string[] = [];
          for (const item of chunk) mediaIds.push(await media(item));
          blocks.push({ id: newId(), type: "row", mediaIds, caption: L("") });
        }
      }
    }
  }
  return blocks;
}

/** Card image: the cover, else the first full-width photo, else the first photo anywhere. */
function cardImage(blocks: Block[]): string | null {
  const firstOf = (type: Block["type"]) => blocks.find((b) => b.type === type);
  const cover = firstOf("cover");
  if (cover?.type === "cover" && cover.mediaId) return cover.mediaId;
  const photo = firstOf("photo");
  if (photo?.type === "photo" && photo.mediaId) return photo.mediaId;
  for (const b of blocks) {
    if (b.type === "row") {
      // Only photos make sense as a card image; videos are skipped later by the DB check.
      const id = b.mediaIds.find(Boolean);
      if (id) return id;
    }
    if (b.type === "split" && b.mediaId) return b.mediaId;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dirs = readdirSync(postsRoot!)
    .filter((d) => /^post\d+$/.test(d) && existsSync(path.join(postsRoot!, d, `${d}.js`)))
    .filter((d) => !only || only.includes(d))
    .sort();
  console.log(`${write ? "IMPORT" : "DRY RUN (nothing is changed; add --write to import)"}: ${dirs.length} post(s) from ${postsRoot}\n`);

  const state = await loadState();
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  const usedSlugs = new Set((await db.post.findMany({ where: { type: "BLOG" }, select: { slug: true } })).map((p) => p.slug));
  const summary = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const dir of dirs) {
    const post = parseOldPost(path.join(postsRoot!, dir, `${dir}.js`));
    const title = post.title ?? dir;
    const day = post.date ? parseStartDate(post.date, DEFAULT_YEAR) : null;
    const firstText = post.elements.find((e) => e.kind === "text");
    const excerpt = firstText?.kind === "text" ? makeExcerpt(htmlToText(firstText.html)) : "";

    // Check every referenced file exists before touching anything.
    const refs = [post.cover, ...post.elements.flatMap((e) => (e.kind === "row" ? e.items : e.kind === "combo" ? [e.image] : []))].filter(
      (r): r is MediaRef => r !== null,
    );
    const missing = refs.filter((r) => !existsSync(path.join(post.dir, r.file)));

    const existingId = state.posts[dir];
    const existing = existingId ? await db.post.findUnique({ where: { id: existingId }, select: { id: true, slug: true, status: true } }) : null;

    console.log(`${dir}  "${title}"`);
    console.log(`      date: ${post.date ?? "—"} -> ${day ?? "none"} · location: ${post.location ?? "—"}`);
    if (missing.length) {
      console.log(`      ! missing files, skipped: ${missing.map((m) => m.file).join(", ")}`);
      summary.failed++;
      continue;
    }
    if (existing?.status === "PUBLISHED") {
      console.log(`      already published as /blog/${existing.slug}; left unchanged`);
      summary.skipped++;
      continue;
    }

    if (!write) {
      const blocks = await toBlocks(post, async () => "dry-run");
      const counts = blocks.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.type]: (acc[b.type] ?? 0) + 1 }), {});
      const videos = refs.filter((r) => r.type === "video").length;
      console.log(`      ${existing ? "would update" : "would create"} draft: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", ")}`);
      console.log(`      media: ${refs.length - videos} photos, ${videos} videos${post.cover ? "" : " · no cover (card uses first photo)"}`);
      console.log(`      excerpt: ${excerpt}\n`);
      continue;
    }

    try {
      const stats = { reused: 0, images: 0, videos: 0 };
      const blocks = blocksSchema.parse(await toBlocks(post, (ref) => importMedia(post, ref, state, stats)));
      let coverImageId = cardImage(blocks);
      if (coverImageId) {
        const m = await db.media.findUnique({ where: { id: coverImageId }, select: { kind: true } });
        if (m?.kind !== "IMAGE") coverImageId = null;
      }

      let slug = existing?.slug ?? (slugify(title) || dir);
      if (!existing) {
        const base = slug;
        for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
        usedSlugs.add(slug);
      }

      const data = {
        type: "BLOG" as const,
        status: "DRAFT" as const,
        slug,
        sourceLang: "EN" as const,
        titleEn: title,
        excerptEn: excerpt,
        locationEn: post.location ?? "",
        blocks,
        coverImageId,
        publishedAt: day ? dayToDate(day) : null,
        authorId: admin?.id,
      };
      const saved = existing ? await db.post.update({ where: { id: existing.id }, data }) : await db.post.create({ data });
      state.posts[dir] = saved.id;
      await saveState(state);
      console.log(
        `      ${existing ? "updated" : "created"} draft /blog/${saved.slug} · ${blocks.length} blocks · ` +
          `${stats.images} new photos, ${stats.videos} new videos, ${stats.reused} reused\n`,
      );
      if (existing) summary.updated++;
      else summary.created++;
    } catch (err) {
      console.error(`      ! FAILED: ${err instanceof Error ? err.message : err}\n`);
      summary.failed++;
    }
  }

  console.log(`Done. created ${summary.created}, updated ${summary.updated}, skipped ${summary.skipped}, failed ${summary.failed}`);
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect();
  process.exit(1);
});
