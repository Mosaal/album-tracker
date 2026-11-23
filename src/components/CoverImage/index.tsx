import { createStaticStyles } from "antd-style";

// Built once rather than for each cover, as a grid can show thousands.
const styles = createStaticStyles(({ css, cssVar }) => ({
  // Hidden until it has loaded, then faded in over whatever is behind it.
  image: css`
    opacity: 0;
    transition: opacity ${cssVar.motionDurationSlow} ${cssVar.motionEaseOut};

    &[data-loaded] {
      opacity: 1;
    }

    &[data-loaded="at-once"] {
      transition: none;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
}));

// Whether a cover has loaded is kept on the image itself rather than in React,
// so a long list doesn't render again as each of its covers arrives.

// A cover that loads this soon after it appears came from a cache, so it's
// shown at once: a fade would only slow it down. Safari takes a moment even
// for covers it has just shown, which Chrome has ready straight away.
const QUICK_LOAD_MS = 100;

const appearedAt = new WeakMap<HTMLImageElement, number>();

/** Notes when a cover appears, and shows one that's ready straight away. */
function watchCover(image: HTMLImageElement | null) {
  if (!image) {
    return;
  }
  if (image.complete && image.naturalWidth > 0) {
    image.dataset.loaded = "at-once";
  } else {
    appearedAt.set(image, performance.now());
  }
}

/** Fades in a cover that kept you waiting, and shows any other at once. */
function showCover(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.loaded === undefined) {
    const waited = performance.now() - (appearedAt.get(image) ?? 0);
    image.dataset.loaded = waited < QUICK_LOAD_MS ? "at-once" : "";
  }
}

interface CoverImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "onLoad"
> {
  src: string;
  alt: string;
}

/**
 * A cover that fades in once it has loaded, rather than appearing all at once,
 * unless it's ready straight away. Until then, whatever is behind it shows, so
 * give it a container that looks like a placeholder. It loads once it's near
 * the screen. Give it its URL as its key where that can change, so a new cover
 * fades in too.
 */
export function CoverImage({ className, ...props }: CoverImageProps) {
  return (
    <img
      loading="lazy"
      {...props}
      className={className ? `${styles.image} ${className}` : styles.image}
      ref={watchCover}
      onLoad={showCover}
    />
  );
}
