import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import { emailButton, emailLayout, sendEmail } from "@/lib/email";
import { findValidInvite } from "@/lib/invites";
import { normalizeEmail } from "@/lib/tokens";

export function isAdminEmail(email: string) {
  const admin = process.env.ADMIN_EMAIL;
  return Boolean(admin) && normalizeEmail(email) === normalizeEmail(admin!);
}

/**
 * Only existing accounts, the admin email, and emails holding a valid invite may receive a magic link.
 * Everyone else gets the same "check your email" response, but nothing is sent.
 */
async function mayReceiveMagicLink(email: string) {
  if (isAdminEmail(email)) return true;
  const user = await db.user.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true } });
  if (user) return true;
  return Boolean(await findValidInvite(email));
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  telemetry: { enabled: false },
  session: {
    expiresIn: 60 * 60 * 24 * 60, // 60 days: family members shouldn't have to log in often
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      role: { type: "string", input: false, defaultValue: "FAMILY" },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Second line of defence: even if a magic link were somehow obtained,
        // no account is created without a valid invite (or being the admin).
        before: async (user) => {
          const name = user.name?.trim() || user.email.split("@")[0];
          if (isAdminEmail(user.email)) return { data: { ...user, name, role: "ADMIN" } };
          if (!(await findValidInvite(user.email))) return false;
          return { data: { ...user, name, role: "FAMILY" } };
        },
        after: async (user) => {
          await db.invite.updateMany({
            where: { email: normalizeEmail(user.email), usedAt: null },
            data: { usedAt: new Date() },
          });
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        if (!(await mayReceiveMagicLink(email))) return;
        await sendEmail({
          to: email,
          subject: "Your sign-in link / ログインリンク",
          text: `Sign in by opening this link (valid for 15 minutes):\n${url}\n\nこのリンクからログインしてください（15分間有効）。\n\nIf you didn't request this, you can ignore this email.`,
          html: emailLayout(
            "Sign in / ログイン",
            `<p>Click the button below to sign in. The link is valid for 15 minutes.</p>
<p>下のボタンからログインしてください（15分間有効）。</p>${emailButton(url, "Sign in / ログイン")}
<p style="color:#6b6862;font-size:13px">If you didn't request this, you can ignore this email.</p>`,
          ),
        });
      },
    }),
    nextCookies(), // must be last: lets Server Actions set auth cookies
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
