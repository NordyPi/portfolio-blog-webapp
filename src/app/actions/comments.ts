"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const input = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  body: z.string().trim().min(1).max(4000),
});

export async function addComment(raw: z.input<typeof input>): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid comment" };
  const { postId, parentId, body } = parsed.data;

  const post = await db.post.findFirst({ where: { id: postId, status: "PUBLISHED" }, select: { id: true } });
  if (!post) return { ok: false, error: "Post not found" };
  if (parentId) {
    const parent = await db.comment.findFirst({ where: { id: parentId, postId }, select: { id: true } });
    if (!parent) return { ok: false, error: "Reply target not found" };
  }

  await db.comment.create({ data: { postId, parentId, body, authorId: user.id } });
  return { ok: true };
}
