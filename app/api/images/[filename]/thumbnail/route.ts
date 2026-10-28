"use server";

import { NextRequest } from "next/server";
import { getContentType, resolvePicturePath } from "@/lib/images/files";
import {
  isMissingFileError,
  notFound,
  serveFile,
  serverError,
} from "@/lib/images/http";
import { getThumbnail } from "@/lib/images/thumbnail";
import { hasThumbnail } from "@/lib/images/urls";

export async function GET(
  request: NextRequest,
  { params: { filename } }: { params: { filename: string } }
) {
  const source = resolvePicturePath(filename);
  if (source == undefined || !hasThumbnail(filename)) {
    return notFound();
  }
  try {
    const thumbnail = await getThumbnail(filename, source);
    return await serveFile(
      request,
      thumbnail != undefined
        ? { path: thumbnail, contentType: "image/webp" }
        : { path: source, contentType: getContentType(filename) }
    );
  } catch (error) {
    if (isMissingFileError(error)) {
      return notFound();
    }
    console.error(`read thumbnail: failed (${filename})`, error);
    return serverError();
  }
}
