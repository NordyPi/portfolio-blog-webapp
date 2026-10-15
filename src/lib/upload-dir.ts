import path from "node:path";

/** Absolute path of the uploads directory (a Docker volume in production). */
// turbopackIgnore: a runtime data directory, not source code, so don't trace it into the build output.
export const UPLOAD_DIR = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./uploads");
