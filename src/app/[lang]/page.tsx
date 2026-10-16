import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { PostGrid, PostGridSkeleton } from "@/components/post-grid";
import { siteConfig } from "@/config/site";
import { listPublished, type PostKind } from "@/lib/content";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).home;

  return (
    <>
      {/* Intro: text on the left, headshot on the right (stacked above the text on phones). */}
      <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 md:grid-cols-[1fr_auto] md:gap-12">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-accent">{t.eyebrow}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight sm:text-7xl">{t.name}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">{t.intro}</p>
        </div>
        <Headshot />
      </section>

      {/* space-y-8 puts 2rem between each card, so cards never touch. */}
      <div className="mx-auto max-w-6xl space-y-8 px-4 sm:px-6">
        <AboutCard heading={t.aboutHeading} paragraphs={t.about} />
        <AboutCard heading={t.aboutSite} paragraphs={t.aboutSiteBody} />
      </div>

      <LatestSection lang={lang} type="BLOG" title={t.latestPosts} viewAll={t.viewAll} path="blog" />
      <LatestSection lang={lang} type="PROJECT" title={t.featuredProjects} viewAll={t.viewAll} path="portfolio" />
    </>
  );
}

/** A heading on the left and paragraphs on the right (stacked on phones). Used for "About me", "About this website"… */
function AboutCard({ heading, paragraphs }: { heading: string; paragraphs: string[] }) {
  return (
    <section className="grid gap-8 rounded-3xl border border-border bg-surface p-6 sm:p-10 md:grid-cols-[1fr_2fr]">
      <h2 className="font-display text-3xl font-semibold">{heading}</h2>
      <div className="space-y-4 text-base leading-relaxed sm:text-lg">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}

/** Portrait next to the intro. Set the photo in src/config/site.ts (see `headshot` there). */
function Headshot() {
  const photo = siteConfig.headshot;
  // order-first: above the text on phones; md:order-last: to the right of it on wider screens.
  const frame = "order-first mx-auto w-44 overflow-hidden rounded-3xl sm:w-56 md:order-last md:w-64 lg:w-72";
  if (!photo) {
    // No photo yet: show where it will go while developing; show nothing on the live site.
    if (process.env.NODE_ENV === "production") return null;
    return (
      <div className={`${frame} flex aspect-[4/5] items-center justify-center border-2 border-dashed border-border p-4 text-center text-sm text-muted`}>
        Headshot goes here — see siteConfig.headshot
      </div>
    );
  }
  return (
    <div className={frame}>
      <Image
        src={photo.src}
        alt={photo.alt}
        width={800}
        height={1000}
        priority
        // Served as-is: `npm run headshot` already makes a small, correctly sized WebP, and skipping the
        // optimizer means a replaced photo shows up straight away instead of a cached resize of the old one.
        unoptimized
        className="aspect-[4/5] size-full object-cover"
      />
    </div>
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
