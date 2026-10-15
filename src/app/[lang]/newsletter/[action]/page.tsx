import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { confirmSubscriptionAction, unsubscribeAction } from "@/app/actions/contact";
import { TokenAction } from "@/components/token-action";
import { getDictionary } from "@/lib/dictionaries";
import { isLocale } from "@/lib/i18n";

export const metadata: Metadata = { robots: { index: false } };

// /[lang]/newsletter/confirm?token=…   and   /[lang]/newsletter/unsubscribe?token=…

type Props = PageProps<"/[lang]/newsletter/[action]">;

export default function NewsletterPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center sm:py-32">
      {/* params/searchParams are read inside the boundary so the page shell stays static. */}
      <Suspense fallback={<div className="mx-auto h-12 w-48 animate-pulse rounded-full bg-surface-2" />}>
        <NewsletterAction params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewsletterAction({ params, searchParams }: Props) {
  const { lang, action } = await params;
  const { token } = await searchParams;
  if (!isLocale(lang) || typeof token !== "string") notFound();
  const t = getDictionary(lang).contact;

  if (action === "confirm") {
    return (
      <TokenAction
        token={token}
        action={confirmSubscriptionAction}
        labels={{ button: t.confirmButton, doneTitle: t.confirmedTitle, doneBody: t.confirmedBody, failTitle: t.confirmFailedTitle, failBody: t.confirmFailedBody }}
      />
    );
  }
  if (action === "unsubscribe") {
    return (
      <TokenAction
        token={token}
        action={unsubscribeAction}
        labels={{ button: t.unsubscribeButton, doneTitle: t.unsubscribedTitle, doneBody: t.unsubscribedBody, failTitle: t.confirmFailedTitle, failBody: t.confirmFailedBody }}
      />
    );
  }
  notFound();
}
