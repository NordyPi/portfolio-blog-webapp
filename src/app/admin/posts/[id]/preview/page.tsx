import Link from "next/link";
import { notFound } from "next/navigation";
import { BlockRenderer } from "@/components/block-renderer";
import { loadEditorState } from "@/lib/admin-posts";
import { pickText } from "@/lib/blocks";
import { requireAdmin } from "@/lib/session";

// Private admin page: navigations may block on the server (no instant-navigation static shell needed).
export const instant = false;

/** Renders a saved draft exactly like the public page would. */
export default async function PreviewPage({ params, searchParams }: PageProps<"/admin/posts/[id]/preview">) {
  await requireAdmin();
  const { id } = await params;
  const lang = (await searchParams).lang === "ja" ? "ja" : "en";
  const state = await loadEditorState(id);
  if (!state) notFound();
  const { post, media } = state;

  return (
    <div className="-mx-4 -my-8">
      <div className="flex items-center justify-between gap-4 bg-accent px-4 py-2 text-sm text-accent-fg">
        <span>Preview ({lang === "en" ? "English" : "日本語"}) — {post.status === "PUBLISHED" ? "published" : "not published"}</span>
        <span className="flex gap-4">
          <Link href={`?lang=${lang === "en" ? "ja" : "en"}`} className="underline">
            {lang === "en" ? "日本語" : "English"}
          </Link>
          <Link href={`/admin/posts/${id}`} className="underline">
            Back to editor
          </Link>
        </span>
      </div>
      <article className="pb-16 pt-12">
        <header className="mx-auto mb-12 max-w-3xl px-4 text-center">
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-6xl">{pickText(post.titleEn, post.titleJa, lang)}</h1>
        </header>
        <BlockRenderer blocks={post.blocks} media={media} lang={lang} />
      </article>
    </div>
  );
}
