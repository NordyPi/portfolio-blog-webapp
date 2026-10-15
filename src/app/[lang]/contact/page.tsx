import type { Metadata } from "next";
import { ContactForm, SubscribeForm } from "@/components/contact-forms";
import { getDictionary, resolveLocale } from "@/lib/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const t = getDictionary(await resolveLocale(params)).contact;
  return { title: t.title, description: t.subtitle };
}

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const t = getDictionary(await resolveLocale(params)).contact;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-12 sm:px-6 sm:pt-20">
      <header className="mb-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">{t.title}</h1>
        <p className="mt-3 text-lg text-muted">{t.subtitle}</p>
      </header>
      <div className="grid gap-8 md:grid-cols-2">
        <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">{t.messageHeading}</h2>
          <ContactForm
            labels={{ name: t.nameLabel, email: t.emailLabel, message: t.messageLabel, submit: t.sendButton, success: t.sendSuccess, error: t.error }}
          />
        </section>
        <section className="self-start rounded-3xl bg-surface-2 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">{t.subscribeHeading}</h2>
          <p className="mt-2 text-muted">{t.subscribeBody}</p>
          <SubscribeForm labels={{ email: t.emailLabel, submit: t.subscribeButton, success: t.subscribeSuccess, error: t.error }} />
        </section>
      </div>
    </div>
  );
}
