"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GlobeIcon } from "@/components/icons";
import { LOCALE_COOKIE, localeNames, locales, switchLocalePath, type Locale } from "@/lib/i18n";

/** Remember the choice so locale-less URLs (e.g. "/") redirect to it next time. */
function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher({ lang, label }: { lang: Locale; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(locale: Locale) {
    setOpen(false);
    if (locale === lang) return;
    rememberLocale(locale);
    // Read the path at click time (not via usePathname) so this component never blocks prerendering.
    const { pathname, search, hash } = window.location;
    router.push(switchLocalePath(pathname, locale) + search + hash);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg"
      >
        <GlobeIcon className="size-4" />
        <span>{lang.toUpperCase()}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute right-0 mt-2 w-36 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {locales.map((l) => (
            <li key={l} role="option" aria-selected={l === lang}>
              <button
                type="button"
                onClick={() => choose(l)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-2 aria-selected:font-medium"
              >
                {localeNames[l]}
                {l === lang && <span className="text-accent">●</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
