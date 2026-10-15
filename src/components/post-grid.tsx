import Link from "next/link";
import { MediaImage, MediaPlaceholder } from "@/components/media-image";
import type { PostCard } from "@/lib/content";
import { formatDate, type Locale } from "@/lib/i18n";

export function PostGrid({
  posts,
  lang,
  basePath,
  emptyText,
}: {
  posts: PostCard[];
  lang: Locale;
  /** e.g. "/en/blog" — card links go to `${basePath}/${slug}` */
  basePath: string;
  emptyText: string;
}) {
  if (posts.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-muted">{emptyText}</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post, i) => (
        <li key={post.id}>
          <Link href={`${basePath}/${post.slug}`} className="group block">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl">
              {post.cover ? (
                <MediaImage
                  media={post.cover}
                  sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
                  priority={i < 3}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <MediaPlaceholder className="size-full" />
              )}
            </div>
            <time dateTime={post.publishedAt} className="mt-4 block text-xs uppercase tracking-wider text-muted">
              {formatDate(post.publishedAt, lang)}
            </time>
            <h3 className="mt-1 font-display text-xl font-semibold leading-snug group-hover:text-accent">{post.title}</h3>
            {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PostGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="animate-pulse">
          <div className="aspect-[4/3] rounded-2xl bg-surface-2" />
          <div className="mt-4 h-3 w-24 rounded bg-surface-2" />
          <div className="mt-2 h-5 w-3/4 rounded bg-surface-2" />
          <div className="mt-2 h-4 w-full rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
