"use client";

import { useState, useTransition } from "react";

/**
 * A button that performs a token-based action (confirm / unsubscribe) on click rather than on page load,
 * so link scanners that open every URL in an email can't trigger it.
 */
export function TokenAction({
  token,
  action,
  labels,
}: {
  token: string;
  action: (token: string) => Promise<{ ok: boolean }>;
  labels: { button: string; doneTitle: string; doneBody: string; failTitle: string; failBody: string };
}) {
  const [result, setResult] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  if (result !== null) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold">{result ? labels.doneTitle : labels.failTitle}</h1>
        <p className="mt-3 text-muted">{result ? labels.doneBody : labels.failBody}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => setResult((await action(token)).ok))}
      className="rounded-full bg-accent px-6 py-3 font-medium text-accent-fg disabled:opacity-60"
    >
      {labels.button}
    </button>
  );
}
