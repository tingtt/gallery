import path from "path";
import env from "@/constants/env";

export const PATH_PICTURES_DIR = path.join(
  env.PERSISTENT_DATA_BASEDIR,
  "Pictures"
);

/**
 * Resolves a filename from a request to a file directly under the pictures
 * directory. Returns undefined for anything that could address another path
 * (separators, `..`, hidden files, NUL).
 */
export const resolvePicturePath = (filename: string): string | undefined => {
  if (
    filename == "" ||
    filename.startsWith(".") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    return undefined;
  }
  return path.join(PATH_PICTURES_DIR, filename);
};

export const getContentType = (filename: string): string | undefined => {
  switch (path.extname(filename)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    default:
      return undefined;
  }
};
