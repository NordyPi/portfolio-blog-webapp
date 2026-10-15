import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import "../globals.css";
import { fontVariables } from "../fonts";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AuthStatus } from "@/components/auth-status";
import { siteConfig } from "@/config/site";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale, locales } from "@/lib/i18n";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
    description: dict.meta.tagline,
    // `||` (not `??`): an empty SITE_URL build arg must also fall back.
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
    alternates: { languages: { en: "/en", ja: "/ja" } },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html lang={lang} className={fontVariables}>
      <body className="flex min-h-dvh flex-col bg-bg font-sans text-fg antialiased">
        <SiteHeader
          lang={lang}
          siteName={siteConfig.name}
          labels={dict.nav}
          authSlot={
            <Suspense fallback={<span className="inline-block h-8 w-20" />}>
              <AuthStatus lang={lang} labels={dict.nav} />
            </Suspense>
          }
        />
        <main className="flex-1">{children}</main>
        <SiteFooter siteName={siteConfig.name} rights={dict.footer.rights} />
      </body>
    </html>
  );
}
