import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import type { Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

/** Reads the session, so it must be rendered inside <Suspense>. */
export async function AuthStatus({
  lang,
  labels,
}: {
  lang: Locale;
  labels: { signIn: string; signOut: string; profile: string; admin: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href={`/${lang}/sign-in`} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-fg">
        {labels.signIn}
      </Link>
    );
  }
  return <UserMenu lang={lang} user={{ name: user.name, image: user.image, isAdmin: user.role === "ADMIN" }} labels={labels} />;
}
