"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { dayToDate, loadEditorState, PostValidationError, translationState, writePost } from "@/lib/admin-posts";
import { blocksSchema } from "@/lib/blocks";
import { POSTS_TAG } from "@/lib/content";
import { db } from "@/lib/db";
import { postInputSchema, type ActionResult, type PostInput } from "@/lib/editor-types";
import { emailButton, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { sendNewPostNewsletter } from "@/lib/newsletter";
import { requireAdmin } from "@/lib/session";
import { hashToken, newToken, normalizeEmail } from "@/lib/tokens";
import { translateDoc, TranslateError } from "@/lib/translate";

// Every action re-checks the admin session itself: Server Actions are public HTTP endpoints.

async function fail(e: unknown): Promise<{ ok: false; error: string }> {
  if (e instanceof PostValidationError || e instanceof TranslateError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: "Some fields are invalid. Please check the post and try again." };
  console.error(e);
  return { ok: false, error: "Something went wrong. Check the server logs." };
}

async function stateOrThrow(id: string) {
  const state = await loadEditorState(id);
  if (!state) throw new PostValidationError("Post not found.");
  return state;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function createPost(type: "BLOG" | "PROJECT") {
  const user = await requireAdmin();
  const post = await db.post.create({
    data: { type, slug: `untitled-${newToken(4).toLowerCase().replace(/[^a-z0-9]/g, "")}`, authorId: user.id },
  });
  redirect(`/admin/posts/${post.id}`);
}

export async function savePost(id: string, input: PostInput): Promise<ActionResult> {
  await requireAdmin();
  try {
    const saved = await writePost(id, postInputSchema.parse(input));
    if (saved.status === "PUBLISHED") updateTag(POSTS_TAG);
    return { ok: true, data: await stateOrThrow(id), message: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

/** Saves, then translates fields whose source changed (or all fields when `force`). */
export async function translatePost(id: string, input: PostInput, force = false): Promise<ActionResult> {
  await requireAdmin();
  try {
    const saved = await writePost(id, postInputSchema.parse(input));
    const { doc, translated } = await translateDoc(
      { ...saved, blocks: blocksSchema.parse(saved.blocks), translationState: translationState(saved) },
      { force },
    );
    await db.post.update({
      where: { id },
      data: {
        titleEn: doc.titleEn,
        titleJa: doc.titleJa,
        excerptEn: doc.excerptEn,
        excerptJa: doc.excerptJa,
        blocks: doc.blocks,
        translationState: doc.translationState,
      },
    });
    if (saved.status === "PUBLISHED") updateTag(POSTS_TAG);
    const target = saved.sourceLang === "EN" ? "Japanese" : "English";
    return {
      ok: true,
      data: await stateOrThrow(id),
      message: translated.length ? `Translated ${translated.length} field(s) into ${target}. Review them before publishing.` : "Everything is already translated.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function publishPost(id: string, input: PostInput, opts: { notifySubscribers: boolean }): Promise<ActionResult> {
  await requireAdmin();
  try {
    const saved = await writePost(id, postInputSchema.parse(input));
    const sourceTitle = saved.sourceLang === "EN" ? saved.titleEn : saved.titleJa;
    if (!sourceTitle) throw new PostValidationError("Add a title before publishing.");
    if (saved.slug.startsWith("untitled-")) throw new PostValidationError("Give the post a real URL slug before publishing.");

    // The editor fills in the author's local "today" when the date is empty; this is only a fallback.
    const publishedAt = saved.publishedAt ?? dayToDate(new Date().toISOString().slice(0, 10));
    await db.post.update({ where: { id }, data: { status: "PUBLISHED", publishedAt } });
    updateTag(POSTS_TAG);

    let message = "Published";
    if (opts.notifySubscribers && !saved.newsletterSentAt) {
      // Send after responding; sendNewPostNewsletter guards against double sends.
      after(() => sendNewPostNewsletter(id).catch((e) => console.error("Newsletter failed:", e)));
      message = "Published — emailing subscribers";
    }
    return { ok: true, data: await stateOrThrow(id), message };
  } catch (e) {
    return fail(e);
  }
}

export async function unpublishPost(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await db.post.update({ where: { id }, data: { status: "DRAFT" } });
    updateTag(POSTS_TAG);
    return { ok: true, data: await stateOrThrow(id), message: "Moved back to drafts" };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePost(id: string) {
  await requireAdmin();
  await db.post.delete({ where: { id } });
  updateTag(POSTS_TAG);
  redirect("/admin/posts");
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

const INVITE_DAYS = 7;

/** Creates a single-use invite, emails it, and returns the link so it can also be shared another way. */
export async function createInvite(rawEmail: string): Promise<ActionResult<{ link: string }>> {
  const admin = await requireAdmin();
  const parsed = z.email().safeParse(rawEmail.trim());
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = normalizeEmail(parsed.data);

  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "That person already has an account — they can sign in with a magic link." };
  }

  // Any older unused invites for this email stop working.
  await db.invite.deleteMany({ where: { email, usedAt: null } });
  const token = newToken();
  await db.invite.create({
    data: { email, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5), createdById: admin.id },
  });

  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const link = `${site}/en/join?token=${token}`;
  const linkJa = `${site}/ja/join?token=${token}`;
  try {
    await sendEmail({
      to: email,
      subject: `${admin.name} invited you to their family page / 家族ページへの招待`,
      text: `${admin.name} invited you to read and comment on their travel blog.\nCreate your account (valid ${INVITE_DAYS} days): ${link}\n\n日本語: ${linkJa}`,
      html: emailLayout(
        "You're invited / ご招待",
        `<p>${escapeHtml(admin.name)} invited you to read and comment on their travel blog. The invite is valid for ${INVITE_DAYS} days.</p>
${emailButton(link, "Create my account")}
<p>ブログを読んだりコメントしたりできる家族アカウントへの招待です（${INVITE_DAYS}日間有効）。</p>${emailButton(linkJa, "アカウントを作成")}`,
      ),
    });
  } catch (e) {
    console.error("Invite email failed:", e);
    return { ok: true, data: { link }, message: "Invite created, but the email failed to send — share the link yourself." };
  }
  return { ok: true, data: { link }, message: `Invite sent to ${email}` };
}

export async function revokeInvite(id: string) {
  await requireAdmin();
  await db.invite.deleteMany({ where: { id, usedAt: null } });
  revalidatePath("/admin/invites");
}
