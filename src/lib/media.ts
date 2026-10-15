// Shared (client + server) view of an uploaded file. Files are served from /media/<path>:
// by nginx in production, and by the /media route handler in development.

export type MediaView = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  src: string;
  /** Responsive `srcset` for images ("…/640.webp 640w, …"), null for videos. */
  srcSet: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  poster: string | null;
};

type MediaRow = {
  id: string;
  kind: "IMAGE" | "VIDEO";
  path: string;
  width: number | null;
  height: number | null;
  widths: number[];
  posterPath: string | null;
  alt: string;
};

export const mediaUrl = (path: string) => `/media/${path}`;

/** Images are stored as images/<id>/<width>.webp for each generated width. */
export const imagePath = (id: string, width: number) => `images/${id}/${width}.webp`;

export function toMediaView(m: MediaRow): MediaView {
  return {
    id: m.id,
    kind: m.kind,
    src: mediaUrl(m.path),
    srcSet:
      m.kind === "IMAGE" && m.widths.length > 0
        ? m.widths.map((w) => `${mediaUrl(imagePath(m.id, w))} ${w}w`).join(", ")
        : null,
    width: m.width,
    height: m.height,
    alt: m.alt,
    poster: m.posterPath ? mediaUrl(m.posterPath) : null,
  };
}

export const mediaSelect = {
  id: true,
  kind: true,
  path: true,
  width: true,
  height: true,
  widths: true,
  posterPath: true,
  alt: true,
} as const;
