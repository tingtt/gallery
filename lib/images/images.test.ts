import { baseDir } from "./test-env";
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { NextRequest } from "next/server";
import * as files from "./files";
import * as http from "./http";
import * as thumbnail from "./thumbnail";
import * as urls from "./urls";
import * as imageRoute from "@/app/api/images/[filename]/route";
import * as thumbnailRoute from "@/app/api/images/[filename]/thumbnail/route";

const picturesDir = path.join(baseDir, "Pictures");
fs.mkdirSync(picturesDir);

const BIG_FILE_SIZE = 5 * 1024 * 1024;

before(async () => {
  await sharp({
    create: { width: 1600, height: 1200, channels: 3, background: "#3366cc" },
  })
    .jpeg()
    .toFile(path.join(picturesDir, "photo.jpg"));
  fs.writeFileSync(path.join(picturesDir, "broken.jpg"), "not an image");
  fs.writeFileSync(
    path.join(picturesDir, "clip.mp4"),
    Buffer.alloc(BIG_FILE_SIZE, 1)
  );
});

after(() => {
  fs.rmSync(baseDir, { recursive: true, force: true });
});

const request = (headers: Record<string, string> = {}, method = "GET") =>
  new Request("http://localhost/api/images/x", { method, headers });

const openFds = () => fs.readdirSync("/dev/fd").length;

const writeJpeg = async (filename: string) => {
  const file = path.join(picturesDir, filename);
  await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#cc6633" },
  })
    .jpeg()
    .toFile(file);
  return file;
};

type Methods = Record<string, (...args: unknown[]) => unknown>;

/**
 * Runs `fn` while `fs.promises[method]` fails with EIO for paths containing
 * `pathPart`, simulating an NFS failure independently of permissions/root.
 */
const withFsFailure = async <T>(
  method: "rename" | "rm",
  pathPart: string,
  fn: () => Promise<T>
) => {
  const promises = fs.promises as unknown as Methods;
  const original = promises[method];
  promises[method] = (target: unknown, ...rest: unknown[]) =>
    `${target}`.includes(pathPart)
      ? Promise.reject(
          Object.assign(new Error(`EIO: i/o error, ${method} '${target}'`), {
            code: "EIO",
          })
        )
      : original(target, ...rest);
  try {
    return await fn();
  } finally {
    promises[method] = original;
  }
};

/** Counts calls to `object[key]` while `fn` runs. */
const countCalls = async (
  object: object,
  key: string,
  fn: () => Promise<unknown>
) => {
  const methods = object as Methods;
  const original = methods[key];
  let calls = 0;
  methods[key] = function (this: unknown, ...args: unknown[]) {
    calls++;
    return original.apply(this, args);
  };
  try {
    await fn();
  } finally {
    methods[key] = original;
  }
  return calls;
};

const withClockAdvanced = async <T>(ms: number, fn: () => Promise<T>) => {
  const now = Date.now;
  Date.now = () => now() + ms;
  try {
    return await fn();
  } finally {
    Date.now = now;
  }
};

describe("resolvePicturePath", () => {
  test("accepts plain filenames", () => {
    assert.equal(
      files.resolvePicturePath("photo.jpg"),
      path.join(picturesDir, "photo.jpg")
    );
  });

  test("rejects anything that could leave the pictures directory", () => {
    for (const name of ["", "..", "../env", "a/b.jpg", "a\\b.jpg", ".x", "a\0"]) {
      assert.equal(files.resolvePicturePath(name), undefined, name);
    }
  });
});

describe("parseRange", () => {
  test("parses single ranges", () => {
    assert.deepEqual(http.parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
    assert.deepEqual(http.parseRange("bytes=900-", 1000), { start: 900, end: 999 });
    assert.deepEqual(http.parseRange("bytes=-100", 1000), { start: 900, end: 999 });
    assert.deepEqual(http.parseRange("bytes=0-5000", 1000), { start: 0, end: 999 });
  });

  test("ignores malformed or multiple ranges", () => {
    for (const header of ["bytes=", "bytes=5-1", "items=0-1", "bytes=0-1,5-6"]) {
      assert.equal(http.parseRange(header, 1000), undefined, header);
    }
  });

  test("reports unsatisfiable ranges", () => {
    assert.equal(http.parseRange("bytes=1000-", 1000), "unsatisfiable");
    assert.equal(http.parseRange("bytes=-0", 1000), "unsatisfiable");
  });
});

describe("serveFile", () => {
  const photo = () => ({
    path: path.join(picturesDir, "photo.jpg"),
    contentType: "image/jpeg",
  });

  test("serves the file with private cache headers and validators", async () => {
    const res = await http.serveFile(request(), photo());
    const size = fs.statSync(photo().path).size;
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "private, max-age=300");
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    assert.equal(res.headers.get("content-length"), `${size}`);
    assert.ok(res.headers.get("etag"));
    assert.ok(res.headers.get("last-modified"));
    assert.equal((await res.arrayBuffer()).byteLength, size);
  });

  test("answers conditional requests with 304", async () => {
    const first = await http.serveFile(request(), photo());
    await first.body?.cancel();
    const etag = first.headers.get("etag")!;
    const lastModified = first.headers.get("last-modified")!;

    const byEtag = await http.serveFile(request({ "if-none-match": etag }), photo());
    assert.equal(byEtag.status, 304);
    assert.equal(byEtag.body, null);
    assert.equal(byEtag.headers.get("cache-control"), "private, max-age=300");

    const byDate = await http.serveFile(
      request({ "if-modified-since": lastModified }),
      photo()
    );
    assert.equal(byDate.status, 304);

    const stale = await http.serveFile(request({ "if-none-match": '"other"' }), photo());
    assert.equal(stale.status, 200);
    await stale.body?.cancel();
  });

  test("serves byte ranges", async () => {
    const clip = { path: path.join(picturesDir, "clip.mp4"), contentType: "video/mp4" };
    const res = await http.serveFile(request({ range: "bytes=100-199" }), clip);
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), `bytes 100-199/${BIG_FILE_SIZE}`);
    assert.equal(res.headers.get("content-length"), "100");
    assert.equal((await res.arrayBuffer()).byteLength, 100);

    const outOfRange = await http.serveFile(
      request({ range: `bytes=${BIG_FILE_SIZE}-` }),
      clip
    );
    assert.equal(outOfRange.status, 416);
    assert.equal(outOfRange.headers.get("content-range"), `bytes */${BIG_FILE_SIZE}`);

    const changed = await http.serveFile(
      request({ range: "bytes=0-9", "if-range": '"other"' }),
      clip
    );
    assert.equal(changed.status, 200);
    await changed.body?.cancel();
  });

  test("streams in chunks and closes the file when the client goes away", async () => {
    const clip = { path: path.join(picturesDir, "clip.mp4") };
    const fdsBefore = openFds();
    const res = await http.serveFile(request(), clip);
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    assert.ok(value != undefined && value.byteLength < BIG_FILE_SIZE);
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(openFds(), fdsBefore);
  });

  test("returns uncacheable 404 for missing files", async () => {
    const res = await http.serveFile(request(), {
      path: path.join(picturesDir, "missing.jpg"),
    });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  test("HEAD returns headers only", async () => {
    const fdsBefore = openFds();
    const res = await http.serveFile(request({}, "HEAD"), photo());
    assert.equal(res.status, 200);
    assert.equal(res.body, null);
    assert.equal(openFds(), fdsBefore);
  });
});

describe("thumbnails", () => {
  const source = path.join(picturesDir, "photo.jpg");

  test("are generated once and reused", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => thumbnail.getThumbnail("photo.jpg", source))
    );
    const target = results[0]!;
    assert.ok(results.every((v) => v == target));
    const meta = await sharp(target).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 640);
    assert.equal(meta.height, 640);
    assert.ok(fs.statSync(target).size < fs.statSync(source).size);

    const mtime = fs.statSync(target).mtimeMs;
    await thumbnail.getThumbnail("photo.jpg", source);
    assert.equal(fs.statSync(target).mtimeMs, mtime);
  });

  test("are regenerated when the source is newer", async () => {
    const target = (await thumbnail.getThumbnail("photo.jpg", source))!;
    const past = new Date(Date.now() - 60_000);
    fs.utimesSync(target, past, past);
    const mtime = fs.statSync(target).mtimeMs;
    await thumbnail.getThumbnail("photo.jpg", source);
    assert.notEqual(fs.statSync(target).mtimeMs, mtime);
  });

  test("fall back to the original for undecodable sources", async () => {
    const broken = path.join(picturesDir, "broken.jpg");
    assert.equal(await thumbnail.getThumbnail("broken.jpg", broken), undefined);
  });

  test("reject missing sources", async () => {
    await assert.rejects(
      thumbnail.getThumbnail("missing.jpg", path.join(picturesDir, "missing.jpg"))
    );
  });

  test("are only used for resizable formats", () => {
    assert.equal(urls.thumbnailSrc("a.png"), "/api/images/a.png/thumbnail");
    assert.equal(urls.thumbnailSrc("a.mp4"), "/api/images/a.mp4");
  });
  test("are generated from the file path, not whole-file buffers", async () => {
    const source = path.join(picturesDir, "large.jpg");
    await sharp({
      create: { width: 6000, height: 4000, channels: 3, background: "#669933" },
    })
      .jpeg()
      .toFile(source);
    let target: string | undefined;
    const reads = await countCalls(fs.promises, "readFile", async () => {
      const toBuffers = await countCalls(sharp.prototype, "toBuffer", async () => {
        target = await thumbnail.getThumbnail("large.jpg", source);
      });
      assert.equal(toBuffers, 0);
    });
    assert.equal(reads, 0);
    assert.equal((await sharp(target!).metadata()).width, 640);
  });

  test("classify only definite decode errors as undecodable", async () => {
    const errorOf = (run: () => Promise<unknown>) =>
      run().then(
        () => assert.fail("expected an error"),
        (error: unknown) => error
      );
    const convert = (input: string | Buffer, output = path.join(baseDir, "x.webp")) =>
      errorOf(() => sharp(input).webp().toFile(output));
    const jpeg = fs.readFileSync(await writeJpeg("classify.jpg"));
    const png = await sharp(jpeg).png().toBuffer();

    for (const [label, error, expected] of [
      ["unsupported format", await convert(Buffer.from("not an image")), true],
      ["truncated JPEG", await convert(jpeg.subarray(0, jpeg.length / 2)), true],
      ["truncated PNG (ambiguous)", await convert(png.subarray(0, png.length / 2)), false],
      ["missing source", await convert(path.join(picturesDir, "none.jpg")), false],
      ["unwritable output", await convert(jpeg, path.join(baseDir, "none", "x.webp")), false],
      ["node I/O error", Object.assign(new Error("EIO: i/o error"), { code: "EIO" }), false],
    ] as const) {
      assert.equal(thumbnail.isUndecodableImageError(error), expected, label);
    }
  });

  test("are retried after an I/O failure, but not immediately", async () => {
    const source = await writeJpeg("retry.jpg");
    const thumbnailsDir = thumbnail.PATH_THUMBNAILS_DIR;

    const failed = await withFsFailure("rename", "retry.jpg.webp", () =>
      thumbnail.getThumbnail("retry.jpg", source)
    );
    assert.equal(failed, undefined);

    // Recovered, but still within the back-off window: no new attempt.
    assert.equal(await thumbnail.getThumbnail("retry.jpg", source), undefined);
    assert.ok(!fs.existsSync(path.join(thumbnailsDir, "retry.jpg.webp")));

    const target = await withClockAdvanced(
      thumbnail.RETRY_AFTER_IO_FAILURE_MS + 1,
      () => thumbnail.getThumbnail("retry.jpg", source)
    );
    assert.equal(target, path.join(thumbnailsDir, "retry.jpg.webp"));
    assert.equal((await sharp(target!).metadata()).format, "webp");
  });

  test("remember undecodable sources until they are modified", async () => {
    const source = path.join(picturesDir, "fixed.jpg");
    fs.writeFileSync(source, "not an image yet");
    const mtime = new Date(Math.floor(Date.now() / 1000) * 1000 - 10_000);
    fs.utimesSync(source, mtime, mtime);
    assert.equal(await thumbnail.getThumbnail("fixed.jpg", source), undefined);

    // Same mtime: still treated as undecodable, even after the I/O back-off.
    await writeJpeg("fixed.jpg");
    fs.utimesSync(source, mtime, mtime);
    const remembered = await withClockAdvanced(
      thumbnail.RETRY_AFTER_IO_FAILURE_MS + 1,
      () => thumbnail.getThumbnail("fixed.jpg", source)
    );
    assert.equal(remembered, undefined);

    const later = new Date(mtime.getTime() + 1000);
    fs.utimesSync(source, later, later);
    assert.ok(await thumbnail.getThumbnail("fixed.jpg", source));
  });

  test("concurrent writers of the same thumbnail do not collide", async () => {
    // Bypasses the in-process de-duplication, like replicas sharing the
    // volume would.
    const source = await writeJpeg("shared.jpg");
    const target = path.join(thumbnail.PATH_THUMBNAILS_DIR, "shared.jpg.webp");
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        thumbnail.generateThumbnail(source, target)
      )
    );
    assert.deepEqual(
      results.map((v) => v.status),
      Array(8).fill("fulfilled")
    );
    assert.equal((await sharp(target).metadata()).width, 640);
    assert.deepEqual(
      fs.readdirSync(thumbnail.PATH_THUMBNAILS_DIR).filter((v) => v.endsWith(".tmp")),
      []
    );
  });
});

describe("routes", () => {
  const ctx = (filename: string) => ({ params: { filename } });
  const nextRequest = (url: string, method = "GET") =>
    new NextRequest(url, { method });

  test("thumbnail route serves webp and falls back to the original", async () => {
    const res = await thumbnailRoute.GET(
      nextRequest("http://localhost/api/images/photo.jpg/thumbnail"),
      ctx("photo.jpg")
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/webp");
    await res.body?.cancel();

    const fallback = await thumbnailRoute.GET(
      nextRequest("http://localhost/api/images/broken.jpg/thumbnail"),
      ctx("broken.jpg")
    );
    assert.equal(fallback.status, 200);
    assert.equal(fallback.headers.get("content-type"), "image/jpeg");
    await fallback.body?.cancel();

    const video = await thumbnailRoute.GET(
      nextRequest("http://localhost/api/images/clip.mp4/thumbnail"),
      ctx("clip.mp4")
    );
    assert.equal(video.status, 404);
  });

  test("image routes reject path traversal", async () => {
    fs.writeFileSync(path.join(baseDir, "secret.txt"), "secret");
    const get = await imageRoute.GET(
      nextRequest("http://localhost/api/images/x"),
      ctx("../secret.txt")
    );
    assert.equal(get.status, 404);
    const del = await imageRoute.DELETE(
      nextRequest("http://localhost/api/images/x", "DELETE"),
      ctx("../secret.txt")
    );
    assert.equal(del.status, 404);
    assert.ok(fs.existsSync(path.join(baseDir, "secret.txt")));
  });

  test("DELETE removes the image and its thumbnail", async () => {
    const thumb = (await thumbnail.getThumbnail("photo.jpg", path.join(picturesDir, "photo.jpg")))!;
    const res = await imageRoute.DELETE(
      nextRequest("http://localhost/api/images/photo.jpg", "DELETE"),
      ctx("photo.jpg")
    );
    assert.equal(res.status, 200);
    assert.ok(!fs.existsSync(path.join(picturesDir, "photo.jpg")));
    assert.ok(!fs.existsSync(thumb));
  });

  test("DELETE returns 404 for a missing image", async () => {
    const res = await imageRoute.DELETE(
      nextRequest("http://localhost/api/images/missing.jpg", "DELETE"),
      ctx("missing.jpg")
    );
    assert.equal(res.status, 404);
  });

  test("DELETE succeeds even if the thumbnail cannot be removed", async () => {
    const source = await writeJpeg("keep-thumb.jpg");
    const thumb = (await thumbnail.getThumbnail("keep-thumb.jpg", source))!;
    const res = await withFsFailure("rm", "keep-thumb.jpg.webp", () =>
      imageRoute.DELETE(
        nextRequest("http://localhost/api/images/keep-thumb.jpg", "DELETE"),
        ctx("keep-thumb.jpg")
      )
    );
    assert.equal(res.status, 200);
    assert.ok(!fs.existsSync(source));
    assert.ok(fs.existsSync(thumb));
  });

  test("DELETE reports other I/O errors as 500 and keeps the image", async () => {
    const source = await writeJpeg("locked.jpg");
    const res = await withFsFailure("rm", "Pictures/locked.jpg", () =>
      imageRoute.DELETE(
        nextRequest("http://localhost/api/images/locked.jpg", "DELETE"),
        ctx("locked.jpg")
      )
    );
    assert.equal(res.status, 500);
    assert.ok(fs.existsSync(source));
  });
});
