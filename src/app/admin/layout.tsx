import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "../globals.css";
import { fontVariables } from "../fonts";
import { Avatar } from "@/components/avatar";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={fontVariables}>
      {/* See src/app/[lang]/layout.tsx: tolerate browser extensions editing <body> attributes. */}
      <body suppressHydrationWarning className="min-h-dvh bg-bg font-sans text-fg antialiased">
        <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </body>
    </html>
  );
}

/** Everything under /admin renders only for the admin (404 for everyone else). */
async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const nav = [
    { href: "/admin/posts", label: "Posts" },
    { href: "/admin/invites", label: "Family invites" },
    { href: "/admin/subscribers", label: "Subscribers" },
    { href: "/admin/messages", label: "Messages" },
  ];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 overflow-x-auto px-4">
          <span className="mr-3 font-display text-lg font-semibold">Admin</span>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
              {n.label}
            </Link>
          ))}
          <Link href="/" className="ml-auto shrink-0 text-sm text-muted hover:text-accent">
            View site ↗
          </Link>
          <Avatar name={user.name} image={user.image} size={28} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
