import Link from "next/link";
import { createPost } from "@/app/admin/actions";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// Private admin page: navigations may block on the server (no instant-navigation static shell needed).
export const instant = false;

export default async function AdminPosts() {
  await requireAdmin();
  const posts = await db.post.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, type: true, status: true, slug: true, titleEn: true, titleJa: true, updatedAt: true, publishedAt: true },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold">Posts</h1>
        <div className="flex gap-2">
          <form action={createPost.bind(null, "BLOG")}>
            <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-fg">+ New blog post</button>
          </form>
          <form action={createPost.bind(null, "PROJECT")}>
            <button className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium">+ New project</button>
          </form>
        </div>
      </div>

      {posts.length === 0 ? (
        <p className="mt-10 text-muted">No posts yet.</p>
      ) : (
        <ul className="mt-8 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/posts/${p.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === "PUBLISHED" ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted"
                  }`}
                >
                  {p.status === "PUBLISHED" ? "Published" : "Draft"}
                </span>
                <span className="text-xs uppercase tracking-wide text-muted">{p.type === "BLOG" ? "Blog" : "Project"}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.titleEn || p.titleJa || <em className="text-muted">Untitled</em>}</span>
                <span className="text-xs text-muted">Edited {p.updatedAt.toLocaleDateString("en-GB")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
