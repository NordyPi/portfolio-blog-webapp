import type { MediaView } from "@/lib/media";

/**
 * Plain <img> with a srcset of the WebP widths generated at upload time.
 * (next/image isn't needed: images are already resized and converted when uploaded.)
 */
export function MediaImage({
  media,
  sizes,
  className,
  priority = false,
}: {
  media: MediaView;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see component comment
    <img
      src={media.src}
      srcSet={media.srcSet ?? undefined}
      sizes={sizes}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      alt={media.alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

export function MediaPlaceholder({ className }: { className?: string }) {
  return <div className={`bg-surface-2 ${className ?? ""}`} aria-hidden="true" />;
}
