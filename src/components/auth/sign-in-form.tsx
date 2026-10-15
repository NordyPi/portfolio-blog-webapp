"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/lib/i18n";

export function SignInForm({ lang, labels }: { lang: Locale; labels: { email: string; submit: string; sent: string; error: string } }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    // The server replies the same way whether or not the email has an account (no account enumeration).
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: `/${lang}`, errorCallbackURL: `/${lang}/sign-in` });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return <p className="mt-8 rounded-2xl border border-border bg-surface p-5">{labels.sent}</p>;
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">{labels.email}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />
      </label>
      {state === "error" && <p className="text-sm text-danger">{labels.error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-full bg-accent px-5 py-2.5 font-medium text-accent-fg disabled:opacity-60"
      >
        {labels.submit}
      </button>
    </form>
  );
}
