import "server-only";
import { db } from "@/lib/db";
import { emailButton, emailLayout, escapeHtml, sendEmail, sendEmailBatch } from "@/lib/email";
import { imagePath } from "@/lib/media";
import { hashToken, newToken, normalizeEmail } from "@/lib/tokens";

const siteUrl = () => (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Double opt-in: creates/refreshes a PENDING subscriber and emails a confirmation link.
 * Already-confirmed addresses get no email, and the caller shows the same message either way.
 */
export async function subscribe(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const existing = await db.subscriber.findUnique({ where: { email } });
  if (existing?.status === "CONFIRMED") return;

  const token = newToken();
  await db.subscriber.upsert({
    where: { email },
    create: { email, confirmTokenHash: hashToken(token), unsubscribeToken: newToken() },
    update: { status: "PENDING", confirmTokenHash: hashToken(token), unsubscribedAt: null },
  });

  const url = `${siteUrl()}/en/newsletter/confirm?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Confirm your subscription",
    text: `Please confirm you'd like to receive an email when a new post is published:\n${url}\n\nIf you didn't sign up, ignore this email and you won't hear from us again.`,
    html: emailLayout(
      "Confirm your subscription",
      `<p>Please confirm you'd like to receive an email whenever a new post is published.</p>${emailButton(url, "Confirm subscription")}
<p style="color:#6b6862;font-size:13px">If you didn't sign up, ignore this email and you won't hear from us again.</p>`,
    ),
  });
}

export async function confirmSubscription(token: string) {
  const sub = await db.subscriber.findUnique({ where: { confirmTokenHash: hashToken(token) } });
  if (!sub) return false;
  await db.subscriber.update({
    where: { id: sub.id },
    data: { status: "CONFIRMED", confirmedAt: new Date(), confirmTokenHash: null },
  });
  return true;
}

export async function unsubscribe(token: string) {
  const { count } = await db.subscriber.updateMany({
    where: { unsubscribeToken: token },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
  return count > 0;
}

/**
 * Emails confirmed subscribers about a newly published post (English version).
 * Claims the post first (newsletterSentAt) so it can never be sent twice.
 */
export async function sendNewPostNewsletter(postId: string) {
  const { count } = await db.post.updateMany({
    where: { id: postId, status: "PUBLISHED", newsletterSentAt: null },
    data: { newsletterSentAt: new Date() },
  });
  if (count === 0) return 0;

  const post = await db.post.findUniqueOrThrow({ where: { id: postId }, include: { coverImage: true } });
  const subscribers = await db.subscriber.findMany({ where: { status: "CONFIRMED" }, select: { email: true, unsubscribeToken: true } });
  if (subscribers.length === 0) return 0;

  const section = post.type === "BLOG" ? "blog" : "portfolio";
  const postUrl = `${siteUrl()}/en/${section}/${post.slug}`;
  const title = post.titleEn || post.titleJa;
  const excerpt = post.excerptEn || post.excerptJa;
  const cover = post.coverImage?.widths.includes(1280)
    ? `${siteUrl()}/media/${imagePath(post.coverImage.id, 1280)}`
    : post.coverImage
      ? `${siteUrl()}/media/${post.coverImage.path}`
      : null;

  await sendEmailBatch(
    subscribers.map((s) => {
      const unsubPage = `${siteUrl()}/en/newsletter/unsubscribe?token=${s.unsubscribeToken}`;
      const oneClick = `${siteUrl()}/api/newsletter/unsubscribe?token=${s.unsubscribeToken}`;
      return {
        to: s.email,
        subject: `New post: ${title}`,
        text: `${title}\n\n${excerpt}\n\nRead it here: ${postUrl}\n\n—\nUnsubscribe: ${unsubPage}`,
        html: emailLayout(
          title,
          `${cover ? `<img src="${escapeHtml(cover)}" alt="" width="496" style="width:100%;height:auto;border-radius:8px;margin-bottom:16px">` : ""}
<p>${escapeHtml(excerpt)}</p>${emailButton(postUrl, "Read the post")}
<p style="color:#6b6862;font-size:12px;margin-top:32px">You're receiving this because you subscribed to new posts. <a href="${escapeHtml(unsubPage)}" style="color:#6b6862">Unsubscribe</a></p>`,
        ),
        // RFC 8058 one-click unsubscribe (Gmail/Apple Mail show an "Unsubscribe" button).
        headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    }),
  );
  return subscribers.length;
}
