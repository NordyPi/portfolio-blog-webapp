import type { Metadata } from "next";
import { Suspense } from "react";
import { findInviteByToken } from "@/lib/invites";
import { JoinForm } from "@/components/auth/join-form";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";
import type { Locale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

export default async function JoinPage({ params, searchParams }: PageProps<"/[lang]/join">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).auth;
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:py-28">
      <h1 className="font-display text-3xl font-semibold">{t.joinTitle}</h1>
      <Suspense fallback={<div className="mt-8 h-40 animate-pulse rounded-2xl bg-surface-2" />}>
        <JoinBody lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function JoinBody({ lang, searchParams }: { lang: Locale; searchParams: PageProps<"/[lang]/join">["searchParams"] }) {
  const t = getDictionary(lang).auth;
  const { token } = await searchParams;
  const invite = typeof token === "string" ? await findInviteByToken(token) : null;

  if (!invite || typeof token !== "string") {
    return <p className="mt-6 rounded-2xl border border-border bg-surface p-5 text-muted">{t.joinInvalid}</p>;
  }
  return (
    <>
      <p className="mt-3 text-muted">{t.joinBody}</p>
      <JoinForm token={token} lang={lang} labels={{ name: t.nameLabel, submit: t.joinButton, sent: t.checkEmail, invalid: t.joinInvalid }} />
    </>
  );
}
