import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BlockRenderer } from "@/components/block-renderer";
import { CommentsSection } from "@/components/comments/comments-section";
import { PostGrid, PostGridSkeleton } from "@/components/post-grid";
import { getPublishedPost, listPublished, type PostKind } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
import { formatDate, isLocale, type Locale } from "@/lib/i18n";

// Shared by the blog and portfolio routes, which differ only in post type and wording.

const section = (type: PostKind) => (type === "BLOG" ? "blog" : "portfolio");

export function PostIndexPage({ lang, type }: { lang: Locale; type: PostKind }) {
  const t = getDictionary(lang)[section(type)];
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-20">
      <header className="mb-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-3 text-lg text-muted">{t.subtitle}</p>
      </header>
      <Suspense fallback={<PostGridSkeleton count={6} />}>
        <PostIndexGrid lang={lang} type={type} />
      </Suspense>
    </div>
  );
}

async function PostIndexGrid({ lang, type }: { lang: Locale; type: PostKind }) {
  const posts = await listPublished(type, lang);
  return <PostGrid posts={posts} lang={lang} basePath={`/${lang}/${section(type)}`} emptyText={getDictionary(lang)[section(type)].empty} />;
}

type DetailParams = Promise<{ lang: string; slug: string }>;

export async function postMetadata(params: DetailParams, type: PostKind): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const post = await getPublishedPost(type, slug, lang);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishedAt,
      images: post.cover ? [{ url: post.cover.src }] : undefined,
    },
    alternates: { languages: { en: `/en/${section(type)}/${slug}`, ja: `/ja/${section(type)}/${slug}` } },
  };
}

/** Params are awaited inside <Suspense> so the page shell (header/footer) stays prerendered. */
export function PostDetailPage({ params, type }: { params: DetailParams; type: PostKind }) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <PostDetail params={params} type={type} />
    </Suspense>
  );
}

async function PostDetail({ params, type }: { params: DetailParams; type: PostKind }) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const post = await getPublishedPost(type, slug, lang);
  if (!post) notFound();

  const t = getDictionary(lang).post;
  const translatedNotice = post.sourceLang !== lang ? (post.sourceLang === "ja" ? t.translatedFromJa : t.translatedFromEn) : null;

  return (
    <article className="pb-8 pt-10 sm:pt-16">
      <header className="mx-auto mb-10 max-w-3xl px-4 text-center sm:mb-14 sm:px-6">
        <Link href={`/${lang}/${section(type)}`} className="text-sm text-muted hover:text-accent">
          ← {type === "BLOG" ? t.backToBlog : t.backToPortfolio}
        </Link>
        <h1 className="mt-6 font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{post.title}</h1>
        <p className="mt-5 text-sm uppercase tracking-wider text-muted">
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, lang)}</time>
          {post.location && <> – {post.location}</>}
        </p>
        {translatedNotice && <p className="mt-2 text-xs text-muted">{translatedNotice}</p>}
      </header>

      <BlockRenderer blocks={post.blocks} media={post.media} lang={lang} />

      {type === "BLOG" && <CommentsSection postId={post.id} lang={lang} />}
    </article>
  );
}

function ArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-4 pt-16 sm:px-6" aria-hidden="true">
      <div className="mx-auto h-4 w-24 rounded bg-surface-2" />
      <div className="mx-auto mt-6 h-12 w-3/4 rounded bg-surface-2" />
      <div className="mt-14 aspect-[16/9] rounded-3xl bg-surface-2" />
    </div>
  );
}
