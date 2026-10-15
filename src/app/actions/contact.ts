"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { confirmSubscription, subscribe, unsubscribe } from "@/lib/newsletter";
import { allow, clientIp } from "@/lib/rate-limit";

type Result = { ok: boolean };

// `website` is a honeypot: hidden from people, but bots tend to fill it in.

export async function subscribeAction(raw: { email: string; website?: string }): Promise<Result> {
  if (raw.website) return { ok: true };
  const email = z.email().max(254).safeParse(raw.email.trim());
  if (!email.success) return { ok: false };
  if (!allow(`subscribe:${await clientIp()}`, 5, 60 * 60 * 1000)) return { ok: false };
  await subscribe(email.data);
  return { ok: true };
}

const messageInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  message: z.string().trim().min(1).max(5000),
});

export async function contactAction(raw: { name: string; email: string; message: string; website?: string }): Promise<Result> {
  if (raw.website) return { ok: true };
  const parsed = messageInput.safeParse({ ...raw, email: raw.email.trim() });
  if (!parsed.success) return { ok: false };
  if (!allow(`contact:${await clientIp()}`, 5, 60 * 60 * 1000)) return { ok: false };

  const { name, email, message } = parsed.data;
  await db.contactMessage.create({ data: { name, email, message } });

  const to = process.env.CONTACT_TO_EMAIL || process.env.ADMIN_EMAIL;
  if (to) {
    await sendEmail({
      to,
      replyTo: email,
      subject: `Website message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: emailLayout(
        `Message from ${name}`,
        `<p style="color:#6b6862">${escapeHtml(email)}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
      ),
    }).catch((e) => console.error("Contact email failed (message is saved in the admin portal):", e));
  }
  return { ok: true };
}

export async function confirmSubscriptionAction(token: string): Promise<Result> {
  return { ok: await confirmSubscription(token) };
}

export async function unsubscribeAction(token: string): Promise<Result> {
  return { ok: await unsubscribe(token) };
}
