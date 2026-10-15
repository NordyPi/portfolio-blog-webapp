import Link from "next/link";
import { Suspense } from "react";
import { CommentThread, type CommentNode } from "@/components/comments/comment-thread";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

/** Family-only: comments are never rendered (or sent to the browser) for visitors who aren't signed in. */
export function CommentsSection({ postId, lang }: { postId: string; lang: Locale }) {
  const t = getDictionary(lang).comments;
  return (
    <section className="mx-auto mt-20 w-full max-w-2xl px-4 sm:px-6" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="font-display text-2xl font-semibold">
        {t.heading}
      </h2>
      <Suspense fallback={<div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface-2" />}>
        <Comments postId={postId} lang={lang} />
      </Suspense>
    </section>
  );
}

async function Comments({ postId, lang }: { postId: string; lang: Locale }) {
  const t = getDictionary(lang).comments;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-muted">{t.signInPrompt}</p>
        <Link href={`/${lang}/sign-in`} className="mt-2 inline-block font-medium text-accent hover:underline">
          {t.signInLink}
        </Link>
      </div>
    );
  }

  const rows = await db.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    select: { id: true, parentId: true, body: true, createdAt: true, author: { select: { name: true, image: true } } },
  });

  // Build the reply tree.
  const nodes = new Map<string, CommentNode>(
    rows.map((r) => [r.id, { id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), author: r.author, replies: [] }]),
  );
  const roots: CommentNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = r.parentId ? nodes.get(r.parentId) : undefined;
    (parent ? parent.replies : roots).push(node);
  }

  return (
    <CommentThread
      postId={postId}
      lang={lang}
      comments={roots}
      me={{ name: user.name, image: user.image }}
      labels={{ placeholder: t.placeholder, replyPlaceholder: t.replyPlaceholder, submit: t.submit, reply: t.reply, cancel: t.cancel, empty: t.empty }}
    />
  );
}
