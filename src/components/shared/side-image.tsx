"use client";

import * as React from "react";
import Image from "next/image";

/**
 * Decorative fill-image panel for the 5c widgets. While the file doesn't
 * exist yet (the AI imagery is generated separately from prompts/), the panel
 * shows `fallbackClassName` — a CSS-only ambience that matches the design
 * mock — instead of the image; without one it removes itself entirely.
 *
 * `children` render over the image — fade overlays, labels.
 */
export function SideImage({
  src,
  alt = "",
  sizes,
  className,
  imageClassName = "object-cover",
  fallbackClassName,
  children,
}: {
  src: string;
  alt?: string;
  sizes?: string;
  /** Wrapper classes — must establish size (aspect/height) and `relative`. */
  className?: string;
  imageClassName?: string;
  /** Background classes for the stand-in panel shown while `src` is missing. */
  fallbackClassName?: string;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = React.useState(false);
  if (failed && !fallbackClassName) return null;
  return (
    <div className={className} aria-hidden={alt === ""}>
      {failed ? (
        <div className={`absolute inset-0 ${fallbackClassName}`} />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={imageClassName}
          onError={() => setFailed(true)}
        />
      )}
      {children}
    </div>
  );
}
