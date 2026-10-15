import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileForm } from "@/components/auth/profile-form";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false } };

export default async function ProfilePage({ params }: PageProps<"/[lang]/profile">) {
  const lang = await resolveLocale(params);
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:py-28">
      <h1 className="font-display text-3xl font-semibold">{getDictionary(lang).profile.title}</h1>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-surface-2" />}>
        <Profile lang={lang} />
      </Suspense>
    </div>
  );
}

async function Profile({ lang }: { lang: Locale }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}/sign-in`);
  return <ProfileForm user={{ name: user.name, image: user.image, email: user.email }} t={getDictionary(lang).profile} />;
}
