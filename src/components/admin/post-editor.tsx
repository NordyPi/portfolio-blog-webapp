"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { deletePost, publishPost, savePost, translatePost, unpublishPost } from "@/app/admin/actions";
import { BlockEditor, TranslationBadge } from "@/components/admin/block-editor";
import { ImageSlot } from "@/components/admin/media-slots";
import { BLOCK_OPTIONS, IMAGE_RATIOS, newBlock, type Block, type BlockOption } from "@/lib/blocks";
import { slugify, type ActionResult, type EditorMedia, type EditorPost, type EditorState, type PostInput } from "@/lib/editor-types";

type Lang = "en" | "ja";

const inputOf = (p: EditorPost): PostInput => ({
  slug: p.slug,
  sourceLang: p.sourceLang,
  titleEn: p.titleEn,
  titleJa: p.titleJa,
  excerptEn: p.excerptEn,
  excerptJa: p.excerptJa,
  coverImageId: p.coverImageId,
  blocks: p.blocks,
});

const inputClass = "w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-accent";
const labelClass = "text-xs font-medium uppercase tracking-wide text-muted";

export function PostEditor({ initial }: { initial: EditorState }) {
  const [post, setPost] = useState(initial.post);
  const [media, setMedia] = useState(initial.media);
  const [staleKeys, setStaleKeys] = useState(initial.staleKeys);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(inputOf(initial.post)));
  const [lang, setLang] = useState<Lang>(initial.post.sourceLang === "JA" ? "ja" : "en");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [addChoice, setAddChoice] = useState<BlockOption>("text");
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(inputOf(post)) !== savedJson;
  const sourceLang: Lang = post.sourceLang === "JA" ? "ja" : "en";
  const isTranslation = lang !== sourceLang;
  const kind = post.type === "BLOG" ? "post" : "project";

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function run(action: () => Promise<ActionResult>) {
    setNotice(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return setNotice({ ok: false, text: res.error });
      setPost(res.data.post);
      setMedia(res.data.media);
      setStaleKeys(res.data.staleKeys);
      setSavedJson(JSON.stringify(inputOf(res.data.post)));
      setNotice({ ok: true, text: res.message ?? "Saved" });
    });
  }

  const registerMedia = useCallback((m: EditorMedia) => setMedia((prev) => ({ ...prev, [m.id]: m })), []);
  const set = <K extends keyof PostInput>(key: K, value: PostInput[K]) => setPost((p) => ({ ...p, [key]: value }));
  const updateBlock = (id: string, block: Block) => setPost((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? block : b)) }));
  const moveBlock = (index: number, delta: -1 | 1) =>
    setPost((p) => {
      const blocks = [...p.blocks];
      const [b] = blocks.splice(index, 1);
      blocks.splice(index + delta, 0, b);
      return { ...p, blocks };
    });
  const removeBlock = (id: string) => setPost((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));

  const titleKey = lang === "en" ? "titleEn" : "titleJa";
  const excerptKey = lang === "en" ? "excerptEn" : "excerptJa";
  const staleField = (key: string) => isTranslation && staleKeys.includes(key);

  // The first image block's picture becomes the card cover if none was chosen yet.
  function onBlockChange(id: string, block: Block) {
    updateBlock(id, block);
    if (!post.coverImageId && (block.type === "cover" || block.type === "wide") && block.mediaId) set("coverImageId", block.mediaId);
  }

  return (
    <div className="pb-32">
      {/* Top bar */}
      <div className="sticky top-14 z-30 -mx-4 mb-6 flex flex-wrap items-center gap-2 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Link href="/admin/posts" className="text-sm text-muted hover:text-fg">
          ← Posts
        </Link>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${post.status === "PUBLISHED" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"}`}>
          {post.status === "PUBLISHED" ? "Published" : "Draft"}
        </span>
        {dirty && <span className="text-xs text-muted">Unsaved changes</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-surface-2 p-0.5 text-sm" role="tablist" aria-label="Editing language">
            {(["en", "ja"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={lang === l}
                onClick={() => setLang(l)}
                className={`rounded-full px-3 py-1 ${lang === l ? "bg-surface shadow-sm" : "text-muted"}`}
              >
                {l === "en" ? "English" : "日本語"}
                {l === sourceLang && <span className="ml-1 text-xs text-muted">(source)</span>}
              </button>
            ))}
          </div>
          <button type="button" disabled={pending} onClick={() => run(() => savePost(post.id, inputOf(post)))} className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium disabled:opacity-50">
            {post.status === "PUBLISHED" ? "Save" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => translatePost(post.id, inputOf(post)))}
            title="Translate fields whose source text changed (keeps your edits elsewhere)"
            className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Translate → {sourceLang === "en" ? "日本語" : "English"}
            {staleKeys.length > 0 && <span className="ml-1.5 rounded-full bg-accent px-1.5 text-xs text-accent-fg">{staleKeys.length}</span>}
          </button>
          {dirty ? (
            <span className="px-2 text-sm text-muted" title="Save first to preview">
              Preview
            </span>
          ) : (
            <a href={`/admin/posts/${post.id}/preview?lang=${lang}`} target="_blank" className="px-2 text-sm text-muted hover:text-fg">
              Preview ↗
            </a>
          )}
          <button type="button" disabled={pending} onClick={() => setPublishOpen(true)} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50">
            {post.status === "PUBLISHED" ? "Update" : "Publish…"}
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className={`mb-6 rounded-xl px-4 py-2 text-sm ${notice.ok ? "bg-surface-2" : "bg-danger/10 text-danger"}`}>
          {notice.text}
        </p>
      )}
      {isTranslation && (
        <p className="mb-6 rounded-xl border border-dashed border-border px-4 py-2 text-sm text-muted">
          You&apos;re editing the {lang === "ja" ? "Japanese" : "English"} translation. Edits here are kept unless the {sourceLang === "en" ? "English" : "Japanese"} source text of that field changes and you translate again.
        </p>
      )}

      {/* Post details */}
      <section className="grid gap-6 rounded-2xl border border-border bg-surface p-4 sm:p-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>
              Title ({lang === "en" ? "English" : "日本語"})
              <TranslationBadge show={staleField("title")} />
            </span>
            <input
              value={post[titleKey]}
              maxLength={200}
              onChange={(e) => set(titleKey, e.target.value)}
              className={`mt-1 ${inputClass} font-display text-2xl`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Short description for cards &amp; emails
              <TranslationBadge show={staleField("excerpt")} />
            </span>
            <textarea value={post[excerptKey]} maxLength={500} rows={3} onChange={(e) => set(excerptKey, e.target.value)} className={`mt-1 ${inputClass} resize-y`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>URL slug</span>
              <div className="mt-1 flex gap-2">
                <input value={post.slug} maxLength={120} onChange={(e) => set("slug", e.target.value.toLowerCase())} className={`${inputClass} font-mono text-sm`} />
                <button
                  type="button"
                  className="shrink-0 text-xs text-muted hover:text-accent"
                  title="Generate from the English title"
                  onClick={() => slugify(post.titleEn) && set("slug", slugify(post.titleEn))}
                >
                  From title
                </button>
              </div>
              <span className="mt-1 block text-xs text-muted">
                /{post.type === "BLOG" ? "blog" : "portfolio"}/{post.slug || "…"}
              </span>
            </label>
            <label className="block">
              <span className={labelClass}>Written in</span>
              <select value={post.sourceLang} onChange={(e) => set("sourceLang", e.target.value as "EN" | "JA")} className={`mt-1 ${inputClass}`}>
                <option value="EN">English (translate into Japanese)</option>
                <option value="JA">日本語 (translate into English)</option>
              </select>
            </label>
          </div>
        </div>
        <div>
          <span className={labelClass}>Card image</span>
          <div className="mt-1">
            <ImageSlot mediaId={post.coverImageId} media={media} onChange={(id) => set("coverImageId", id)} onUploaded={registerMedia} ratio={IMAGE_RATIOS.card} />
          </div>
          <span className="mt-1 block text-xs text-muted">Shown on the {kind} grid and in subscriber emails.</span>
        </div>
      </section>

      {/* Blocks */}
      <div className="mt-8 space-y-4">
        {post.blocks.map((block, i) => (
          <BlockEditor
            key={block.id}
            block={block}
            lang={lang}
            isTranslation={isTranslation}
            staleKeys={staleKeys}
            media={media}
            onChange={(b) => onBlockChange(block.id, b)}
            onUploaded={registerMedia}
            onMove={(d) => moveBlock(i, d)}
            onRemove={() => removeBlock(block.id)}
            isFirst={i === 0}
            isLast={i === post.blocks.length - 1}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-4">
        <span className="text-sm font-medium">Add block</span>
        <select value={addChoice} onChange={(e) => setAddChoice(e.target.value as BlockOption)} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          {BLOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setPost((p) => ({ ...p, blocks: [...p.blocks, newBlock(addChoice)] }))}
          className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-bg"
        >
          + Add
        </button>
      </div>

      {/* Danger zone */}
      <div className="mt-16 flex flex-wrap gap-3 border-t border-border pt-6">
        {post.status === "PUBLISHED" && (
          <button type="button" disabled={pending} onClick={() => run(() => unpublishPost(post.id))} className="rounded-full border border-border px-4 py-1.5 text-sm">
            Unpublish
          </button>
        )}
        <form
          action={deletePost.bind(null, post.id)}
          onSubmit={(e) => {
            if (!window.confirm(`Delete this ${kind} permanently? Comments on it are deleted too.`)) e.preventDefault();
          }}
        >
          <button className="rounded-full px-4 py-1.5 text-sm text-danger hover:bg-danger/10">Delete {kind}</button>
        </form>
      </div>

      {publishOpen && (
        <PublishDialog
          post={post}
          staleCount={staleKeys.length}
          onCancel={() => setPublishOpen(false)}
          onConfirm={(notifySubscribers) => {
            setPublishOpen(false);
            run(() => publishPost(post.id, inputOf(post), { notifySubscribers }));
          }}
        />
      )}
    </div>
  );
}

function PublishDialog({
  post,
  staleCount,
  onCancel,
  onConfirm,
}: {
  post: EditorPost;
  staleCount: number;
  onCancel: () => void;
  onConfirm: (notifySubscribers: boolean) => void;
}) {
  const alreadySent = Boolean(post.newsletterSentAt);
  const [notify, setNotify] = useState(post.status !== "PUBLISHED" && !alreadySent);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="publish-title">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <h2 id="publish-title" className="font-display text-2xl font-semibold">
          {post.status === "PUBLISHED" ? "Update published post" : "Publish"}
        </h2>
        {staleCount > 0 && (
          <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-sm">
            {staleCount} field(s) changed since they were last translated. You can publish anyway — readers of the other language will see the older translation.
          </p>
        )}
        <label className={`mt-4 flex items-start gap-3 ${alreadySent ? "opacity-60" : ""}`}>
          <input type="checkbox" className="mt-1" checked={notify} disabled={alreadySent} onChange={(e) => setNotify(e.target.checked)} />
          <span>
            Email subscribers about this {post.type === "BLOG" ? "post" : "project"}
            {alreadySent && <span className="block text-xs text-muted">Already sent on {new Date(post.newsletterSentAt!).toLocaleDateString("en-GB")}.</span>}
          </span>
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(notify && !alreadySent)} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg">
            {post.status === "PUBLISHED" ? "Update" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
