"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { saveAvatar, UploadError } from "@/lib/uploads";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

export async function updateProfile(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { ok: false, error: "Please enter a name (max 60 characters)." };

  let image: string | undefined;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "Photo is larger than 10 MB." };
    try {
      image = await saveAvatar(Buffer.from(await file.arrayBuffer()), user.id);
    } catch (e) {
      return { ok: false, error: e instanceof UploadError ? e.message : "Could not process that photo." };
    }
  }

  await db.user.update({ where: { id: user.id }, data: { name, ...(image ? { image } : {}) } });
  // Name/avatar appear in the header and in comments.
  revalidatePath("/", "layout");
  return { ok: true };
}
