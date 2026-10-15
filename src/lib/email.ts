import "server-only";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

const RESEND_API = "https://api.resend.com";

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Without a Resend key (local development) emails are printed to the server console instead,
 * so magic links and confirmation links can still be clicked.
 */
function logToConsole(messages: EmailMessage[]) {
  for (const m of messages) {
    console.log(
      `\n──── email (not sent: RESEND_API_KEY unset) ────\nTo: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n────────────────────────────────────────────────\n`,
    );
  }
}

async function resend(path: string, body: unknown) {
  const res = await fetch(`${RESEND_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Resend ${path} failed: ${res.status} ${await res.text()}`);
  }
}

function toResend(m: EmailMessage) {
  return {
    from: process.env.EMAIL_FROM,
    to: [m.to],
    subject: m.subject,
    html: m.html,
    text: m.text,
    reply_to: m.replyTo,
    headers: m.headers,
  };
}

export async function sendEmail(message: EmailMessage) {
  if (!isConfigured()) return logToConsole([message]);
  await resend("/emails", toResend(message));
}

/** Sends many individual emails (one recipient each) using Resend's batch endpoint, 100 at a time. */
export async function sendEmailBatch(messages: EmailMessage[]) {
  if (!isConfigured()) return logToConsole(messages);
  for (let i = 0; i < messages.length; i += 100) {
    await resend("/emails/batch", messages.slice(i, i + 100).map(toResend));
  }
}

export function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Minimal, email-client-safe wrapper used by every transactional email. */
export function emailLayout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#1c1b19">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

export function emailButton(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#1c1b19;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${escapeHtml(label)}</a></p>`;
}
