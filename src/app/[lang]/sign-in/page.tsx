import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";

export const metadata: Metadata = { robots: { index: false } };

export default async function SignInPage({ params }: PageProps<"/[lang]/sign-in">) {
  const lang = await resolveLocale(params);
  const t = getDictionary(lang).auth;
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:py-28">
      <h1 className="font-display text-3xl font-semibold">{t.signInTitle}</h1>
      <p className="mt-3 text-muted">{t.signInBody}</p>
      <SignInForm
        lang={lang}
        labels={{ email: getDictionary(lang).contact.emailLabel, submit: t.sendLink, sent: t.checkEmail, error: getDictionary(lang).contact.error }}
      />
    </div>
  );
}
