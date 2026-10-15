"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isLocale } from "@/lib/i18n";
import { findInviteByToken } from "@/lib/invites";

const input = z.object({ token: z.string().min(10), name: z.string().trim().min(1).max(60), lang: z.string() });

/** Sends the account-creation magic link to the email the invite was issued for. */
export async function requestJoinLink(raw: z.input<typeof input>): Promise<{ ok: boolean }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { token, name, lang } = parsed.data;

  const invite = await findInviteByToken(token);
  if (!invite) return { ok: false };

  await auth.api.signInMagicLink({
    body: { email: invite.email, name, callbackURL: `/${isLocale(lang) ? lang : "en"}/profile` },
    headers: await headers(),
  });
  return { ok: true };
}
