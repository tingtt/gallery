const THUMBNAIL_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export const hasThumbnail = (filename: string): boolean =>
  THUMBNAIL_EXTENSIONS.some((extension) => filename.endsWith(extension));

/** URL of the original file, for full-size display. */
export const originalSrc = (filename: string): string =>
  `/api/images/${filename}`;

/**
 * URL of a downscaled image for list tiles. Formats without a thumbnail
 * (e.g. mp4) fall back to the original file.
 */
export const thumbnailSrc = (filename: string): string =>
  hasThumbnail(filename)
    ? `/api/images/${filename}/thumbnail`
    : originalSrc(filename);
