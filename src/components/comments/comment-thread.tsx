"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment } from "@/app/actions/comments";
import { Avatar } from "@/components/avatar";
import { formatDate, type Locale } from "@/lib/i18n";

export type CommentNode = {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string; image: string | null };
  replies: CommentNode[];
};

type Labels = { placeholder: string; replyPlaceholder: string; submit: string; reply: string; cancel: string; empty: string };

export function CommentThread({
  postId,
  lang,
  comments,
  me,
  labels,
}: {
  postId: string;
  lang: Locale;
  comments: CommentNode[];
  me: { name: string; image: string | null };
  labels: Labels;
}) {
  return (
    <div className="mt-6">
      <CommentForm postId={postId} parentId={null} me={me} labels={labels} placeholder={labels.placeholder} />
      {comments.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">{labels.empty}</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {comments.map((c) => (
            <Comment key={c.id} comment={c} depth={0} postId={postId} lang={lang} me={me} labels={labels} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Comment({
  comment,
  depth,
  postId,
  lang,
  me,
  labels,
}: {
  comment: CommentNode;
  depth: number;
  postId: string;
  lang: Locale;
  me: { name: string; image: string | null };
  labels: Labels;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <li>
      <div className="flex gap-3">
        <Avatar name={comment.author.name} image={comment.author.image} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{comment.author.name}</span>
            <time dateTime={comment.createdAt} className="text-xs text-muted">
              {formatDate(comment.createdAt, lang)}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">{comment.body}</p>
          <button type="button" onClick={() => setReplying((r) => !r)} className="mt-1 text-sm text-muted hover:text-accent">
            {replying ? labels.cancel : labels.reply}
          </button>
          {replying && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                parentId={comment.id}
                me={me}
                labels={labels}
                placeholder={labels.replyPlaceholder}
                autoFocus
                onDone={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>
      {comment.replies.length > 0 && (
        // Indent replies, but stop indenting after a few levels so deep threads stay readable on phones.
        <ul className={`mt-4 space-y-4 ${depth < 3 ? "ml-5 border-l border-border pl-4 sm:ml-12" : ""}`}>
          {comment.replies.map((r) => (
            <Comment key={r.id} comment={r} depth={depth + 1} postId={postId} lang={lang} me={me} labels={labels} />
          ))}
        </ul>
      )}
    </li>
  );
}

function CommentForm({
  postId,
  parentId,
  me,
  labels,
  placeholder,
  autoFocus,
  onDone,
}: {
  postId: string;
  parentId: string | null;
  me: { name: string; image: string | null };
  labels: Labels;
  placeholder: string;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const res = await addComment({ postId, parentId, body });
      if (!res.ok) return setError(res.error);
      setBody("");
      setError(null);
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-3">
      <Avatar name={me.name} image={me.image} size={36} />
      <div className="flex-1">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          rows={parentId ? 2 : 3}
          maxLength={4000}
          autoFocus={autoFocus}
          className="w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {labels.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
