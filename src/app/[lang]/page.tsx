import Link from "next/link";
import { Suspense } from "react";
import { PostGrid, PostGridSkeleton } from "@/components/post-grid";
import { listPublished, type PostKind } from "@/lib/content";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).home;

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">{t.eyebrow}</p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight sm:text-7xl">{t.name}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">{t.intro}</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 rounded-3xl border border-border bg-surface p-6 sm:p-10 md:grid-cols-[1fr_2fr]">
          <h2 className="font-display text-3xl font-semibold">{t.aboutHeading}</h2>
          <div className="space-y-4 text-base leading-relaxed sm:text-lg">
            {t.about.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <LatestSection lang={lang} type="BLOG" title={t.latestPosts} viewAll={t.viewAll} path="blog" />
      <LatestSection lang={lang} type="PROJECT" title={t.featuredProjects} viewAll={t.viewAll} path="portfolio" />
    </>
  );
}

function LatestSection({ lang, type, title, viewAll, path }: { lang: Locale; type: PostKind; title: string; viewAll: string; path: string }) {
  return (
    <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-semibold">{title}</h2>
        <Link href={`/${lang}/${path}`} className="text-sm font-medium text-accent hover:underline">
          {viewAll} →
        </Link>
      </div>
      <Suspense fallback={<PostGridSkeleton />}>
        <LatestPosts lang={lang} type={type} path={path} />
      </Suspense>
    </section>
  );
}

async function LatestPosts({ lang, type, path }: { lang: Locale; type: PostKind; path: string }) {
  const dict = getDictionary(lang);
  const posts = await listPublished(type, lang, 3);
  const empty = type === "BLOG" ? dict.blog.empty : dict.portfolio.empty;
  return <PostGrid posts={posts} lang={lang} basePath={`/${lang}/${path}`} emptyText={empty} />;
}
