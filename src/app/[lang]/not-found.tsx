import Link from "next/link";

// Rendered inside [lang]/layout, but not-found files don't receive params, so it is bilingual.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-32 text-center">
      <p className="font-display text-7xl font-semibold text-accent">404</p>
      <h1 className="mt-4 text-xl font-medium">Page not found · ページが見つかりません</h1>
      <Link href="/" className="mt-8 inline-block rounded-full bg-accent px-5 py-2 text-sm font-medium text-accent-fg">
        Home · ホーム
      </Link>
    </div>
  );
}
