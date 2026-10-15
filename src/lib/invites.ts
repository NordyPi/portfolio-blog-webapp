import "server-only";
import { db } from "@/lib/db";
import { hashToken, normalizeEmail } from "@/lib/tokens";

/** A still-valid (unused, unexpired) invite issued to this email, or null. */
export function findValidInvite(email: string) {
  return db.invite.findFirst({
    where: { email: normalizeEmail(email), usedAt: null, expiresAt: { gt: new Date() } },
  });
}

/** A still-valid (unused, unexpired) invite for this raw token, or null. */
export function findInviteByToken(token: string) {
  return db.invite.findFirst({
    where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    select: { email: true },
  });
}
