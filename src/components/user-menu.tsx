"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";

export function UserMenu({
  lang,
  user,
  labels,
}: {
  lang: Locale;
  user: { name: string; image: string | null; isAdmin: boolean };
  labels: { signOut: string; profile: string; admin: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function signOut() {
    await authClient.signOut();
    router.refresh();
  }

  const item = "block w-full px-3 py-2 text-left text-sm hover:bg-surface-2";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm hover:bg-surface-2"
      >
        <Avatar name={user.name} image={user.image} size={28} />
        <span className="max-w-32 truncate">{user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
          <Link role="menuitem" href={`/${lang}/profile`} className={item} onClick={() => setOpen(false)}>
            {labels.profile}
          </Link>
          {user.isAdmin && (
            <Link role="menuitem" href="/admin" className={item}>
              {labels.admin}
            </Link>
          )}
          <button role="menuitem" type="button" onClick={signOut} className={`${item} text-danger`}>
            {labels.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
