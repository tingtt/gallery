import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import env from "@/constants/env";

/**
 * Thumbnails are generated on first request and kept next to the pictures
 * (outside `Pictures/`, so the list ignores them). A cached thumbnail is
 * reused while it is not older than its source; deleting an image removes
 * its thumbnail. Each file is ~tens of KB, so ~2,000 images need well under
 * 100 MB.
 */
export const PATH_THUMBNAILS_DIR = path.join(
  env.PERSISTENT_DATA_BASEDIR,
  "cache",
  "thumbnails"
);

/** 2x the 320px list tile, for high-DPI screens. */
const THUMBNAIL_SIZE = 640;
/** Bounds memory/CPU when many uncached thumbnails are requested at once. */
const MAX_CONCURRENT_GENERATIONS = 2;
/** How long to serve the original before retrying after an I/O failure. */
export const RETRY_AFTER_IO_FAILURE_MS = 60_000;

sharp.cache(false);

const thumbnailPath = (filename: string) =>
  path.join(PATH_THUMBNAILS_DIR, `${filename}.webp`);

const pending = new Map<string, Promise<string | undefined>>();

/**
 * Recent generation failures, keyed by source path. An undecodable source
 * stays failed until it is modified; an I/O failure (e.g. NFS hiccup,
 * unwritable cache) is retried after RETRY_AFTER_IO_FAILURE_MS.
 */
type Failure =
  | { kind: "undecodable"; sourceMtimeMs: number }
  | { kind: "io"; retryAt: number };
const failures = new Map<string, Failure>();

/**
 * Whether a generation error says the source data itself cannot be decoded,
 * as opposed to a file system failure on either side. Node system errors and
 * libvips I/O messages ("system error: ...", "read error", "unable to open
 * for write") are never decode errors; ambiguous messages (e.g. "pngload:
 * libspng read error", which a failing read can also cause) are not either,
 * so they are only retried later rather than remembered.
 */
export const isUndecodableImageError = (error: unknown): boolean =>
  error instanceof Error &&
  !("code" in error) &&
  !/system error|read error|write error|unable to open|is missing/i.test(
    error.message
  ) &&
  /unsupported image format|corrupt header|^VipsJpeg: /i.test(error.message);

/** Rules out a source that changed (e.g. was still being written) mid-run. */
const isUnchanged = async (source: string, before: fs.Stats) => {
  const after = await fs.promises.stat(source).catch(() => undefined);
  return after?.mtimeMs == before.mtimeMs && after.size == before.size;
};

/**
 * Returns the path of an up-to-date thumbnail for `source`, generating it if
 * needed, or undefined if it cannot be produced now (undecodable source, or
 * a recent I/O failure); the caller should then serve the original. Throws if
 * the source does not exist.
 */
export async function getThumbnail(
  filename: string,
  source: string
): Promise<string | undefined> {
  const sourceStat = await fs.promises.stat(source);
  const target = thumbnailPath(filename);

  const cached = await fs.promises.stat(target).catch(() => undefined);
  if (cached != undefined && cached.mtimeMs >= sourceStat.mtimeMs) {
    return target;
  }
  const failure = failures.get(source);
  if (
    (failure?.kind == "undecodable" &&
      failure.sourceMtimeMs == sourceStat.mtimeMs) ||
    (failure?.kind == "io" && Date.now() < failure.retryAt)
  ) {
    return undefined;
  }

  let generation = pending.get(target);
  if (generation == undefined) {
    generation = generateThumbnail(source, target)
      .then(() => {
        failures.delete(source);
        return target;
      })
      .catch(async (error: unknown) => {
        console.error(`generate thumbnail: failed (${filename})`, error);
        const undecodable =
          isUndecodableImageError(error) &&
          (await isUnchanged(source, sourceStat));
        failures.set(
          source,
          undecodable
            ? { kind: "undecodable", sourceMtimeMs: sourceStat.mtimeMs }
            : { kind: "io", retryAt: Date.now() + RETRY_AFTER_IO_FAILURE_MS }
        );
        return undefined;
      })
      .finally(() => pending.delete(target));
    pending.set(target, generation);
  }
  return generation;
}

export async function removeThumbnail(filename: string): Promise<void> {
  await fs.promises.rm(thumbnailPath(filename), { force: true });
}

/**
 * Writes the thumbnail of `source` to `target`. sharp reads the source and
 * writes the output by path, so neither is held in memory as a whole.
 *
 * Exported for tests; use getThumbnail.
 */
export async function generateThumbnail(
  source: string,
  target: string
): Promise<void> {
  await acquire();
  // Write to a unique temp file and rename, so concurrent requests (or other
  // replicas on the shared volume) never read a partially written file.
  const tmp = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.promises.mkdir(PATH_THUMBNAILS_DIR, { recursive: true });
    await sharp(source)
      .rotate()
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover" })
      .webp({ quality: 75 })
      .toFile(tmp);
    await fs.promises.rename(tmp, target);
    console.log(`generate thumbnail: successful (${path.basename(source)})`);
  } finally {
    await fs.promises.rm(tmp, { force: true });
    release();
  }
}

let running = 0;
const waiting: (() => void)[] = [];

const acquire = async () => {
  if (running < MAX_CONCURRENT_GENERATIONS) {
    running++;
    return;
  }
  await new Promise<void>((resolve) => waiting.push(resolve));
};

const release = () => {
  const next = waiting.shift();
  if (next != undefined) {
    next(); // hand the slot over
  } else {
    running--;
  }
};
