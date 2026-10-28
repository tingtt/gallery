import fs from "fs";
import { Readable } from "stream";

/**
 * Images sit behind oauth2rbac, so only the browser may cache them
 * (`private`). The short max-age bounds how long an image stays viewable
 * from the local cache after logout or deletion; after that the browser
 * revalidates with ETag / Last-Modified and usually gets a bodiless 304.
 */
export const CACHE_CONTROL_IMAGE = "private, max-age=300";

export interface Validators {
  etag: string;
  lastModified: Date;
}

export const validatorsOf = (stat: fs.Stats): Validators => ({
  etag: `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
  lastModified: stat.mtime,
});

const toHttpSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

export const isNotModified = (headers: Headers, v: Validators): boolean => {
  const ifNoneMatch = headers.get("if-none-match");
  if (ifNoneMatch != null) {
    return (
      ifNoneMatch.trim() == "*" ||
      ifNoneMatch
        .split(",")
        .some((tag) => tag.trim().replace(/^W\//, "") == v.etag)
    );
  }
  const ifModifiedSince = headers.get("if-modified-since");
  if (ifModifiedSince != null) {
    const since = Date.parse(ifModifiedSince);
    return !isNaN(since) && toHttpSeconds(v.lastModified) <= since / 1000;
  }
  return false;
};

export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses a single `Range: bytes=...` spec. Returns undefined when the header
 * should be ignored (malformed, multiple ranges), in which case the whole
 * file is served.
 */
export const parseRange = (
  header: string,
  size: number
): ByteRange | "unsatisfiable" | undefined => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match == null || (match[1] == "" && match[2] == "")) {
    return undefined;
  }
  if (match[1] == "") {
    const suffix = Number(match[2]);
    if (suffix == 0 || size == 0) {
      return "unsatisfiable";
    }
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] == "" ? size - 1 : Number(match[2]);
  if (start >= size) {
    return "unsatisfiable";
  }
  if (end < start) {
    return undefined;
  }
  return { start, end: Math.min(end, size - 1) };
};

/** A Range is honored only if `If-Range` (when present) still matches. */
const ifRangeMatches = (headers: Headers, v: Validators): boolean => {
  const ifRange = headers.get("if-range");
  if (ifRange == null) {
    return true;
  }
  if (ifRange.startsWith('"')) {
    return ifRange == v.etag;
  }
  return Date.parse(ifRange) / 1000 == toHttpSeconds(v.lastModified);
};

export const notFound = () =>
  new Response("Image not found", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });

export const serverError = () =>
  new Response("Failed to read image", {
    status: 500,
    headers: { "Cache-Control": "no-store" },
  });

/**
 * Streams a file with cache validators and single-range support, without
 * buffering it in memory. The stream is destroyed (closing the file) when
 * the client disconnects.
 */
export async function serveFile(
  request: Request,
  file: { path: string; contentType?: string }
): Promise<Response> {
  let handle: fs.promises.FileHandle;
  try {
    handle = await fs.promises.open(file.path, "r");
  } catch (error) {
    if (isMissingFileError(error)) {
      return notFound();
    }
    throw error;
  }

  try {
    const stat = await handle.stat();
    if (!stat.isFile()) {
      await handle.close();
      return notFound();
    }

    const validators = validatorsOf(stat);
    const headers = new Headers({
      "Cache-Control": CACHE_CONTROL_IMAGE,
      ETag: validators.etag,
      "Last-Modified": validators.lastModified.toUTCString(),
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    });
    if (file.contentType != undefined) {
      headers.set("Content-Type", file.contentType);
    }

    if (isNotModified(request.headers, validators)) {
      await handle.close();
      return new Response(null, { status: 304, headers });
    }

    const rangeHeader = request.headers.get("range");
    const range =
      rangeHeader != null && ifRangeMatches(request.headers, validators)
        ? parseRange(rangeHeader, stat.size)
        : undefined;
    if (range == "unsatisfiable") {
      await handle.close();
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${stat.size}`,
          "Cache-Control": "no-store",
        },
      });
    }

    const { start, end } = range ?? { start: 0, end: stat.size - 1 };
    const status = range != undefined ? 206 : 200;
    headers.set("Content-Length", `${end - start + 1}`);
    if (range != undefined) {
      headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    }

    if (request.method == "HEAD" || stat.size == 0) {
      await handle.close();
      return new Response(null, { status, headers });
    }

    const stream = handle.createReadStream({ start, end, autoClose: true });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status,
      headers,
    });
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

export const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  ["ENOENT", "ENOTDIR", "EISDIR"].includes(`${error.code}`);
