import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** A URL-safe random token suitable for emailed links. */
export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

/** We store only hashes of emailed tokens, so a leaked database can't be used to accept invites etc. */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
