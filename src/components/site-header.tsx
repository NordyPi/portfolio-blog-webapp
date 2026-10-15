"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/lib/i18n";

type NavLabels = { home: string; blog: string; portfolio: string; contact: string; language: string; menu: string };
type NavLink = { href: string; label: string; exact?: boolean };

export function SiteHeader({
  lang,
  siteName,
  labels,
  authSlot,
}: {
  lang: Locale;
  siteName: string;
  labels: NavLabels;
  authSlot: ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links: NavLink[] = [
    { href: `/${lang}`, label: labels.home, exact: true },
    { href: `/${lang}/blog`, label: labels.blog },
    { href: `/${lang}/portfolio`, label: labels.portfolio },
    { href: `/${lang}/contact`, label: labels.contact },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300 ${
        scrolled || open
          ? "border-b border-border bg-surface/85 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-bg"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href={`/${lang}`} className="font-display text-xl font-semibold tracking-tight">
          {siteName}
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLinks
            links={links}
            className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg aria-[current=page]:bg-surface-2 aria-[current=page]:text-fg"
          />
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageSwitcher lang={lang} label={labels.language} />
          <div className="hidden md:block">{authSlot}</div>
          <button
            type="button"
            className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={labels.menu}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" className="border-t border-border px-4 pb-4 pt-2 md:hidden" aria-label="Main">
          <NavLinks
            links={links}
            onNavigate={() => setOpen(false)}
            className="block rounded-lg px-3 py-3 text-base aria-[current=page]:bg-surface-2"
          />
          <div className="mt-2 border-t border-border px-3 pt-3">{authSlot}</div>
        </nav>
      )}
    </header>
  );
}

type NavLinksProps = { links: NavLink[]; className: string; onNavigate?: () => void };

/**
 * The current path is request data, so the "active link" highlight streams in behind <Suspense>;
 * the fallback renders the same links without a highlight, keeping the header in the static shell.
 */
function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavLinkList {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: NavLinksProps) {
  return <NavLinkList {...props} pathname={usePathname()} />;
}

function NavLinkList({ links, className, onNavigate, pathname }: NavLinksProps & { pathname: string | null }) {
  const isActive = (l: NavLink) =>
    pathname !== null && (l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`));
  return links.map((l) => (
    <Link key={l.href} href={l.href} onClick={onNavigate} aria-current={isActive(l) ? "page" : undefined} className={className}>
      {l.label}
    </Link>
  ));
}
