"use server";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getContentType, resolvePicturePath } from "@/lib/images/files";
import {
  isMissingFileError,
  notFound,
  serveFile,
  serverError,
} from "@/lib/images/http";
import { removeThumbnail } from "@/lib/images/thumbnail";

export async function GET(
  request: NextRequest,
  { params: { filename } }: { params: { filename: string } }
) {
  const filePath = resolvePicturePath(filename);
  if (filePath == undefined) {
    return notFound();
  }
  try {
    return await serveFile(request, {
      path: filePath,
      contentType: getContentType(filename),
    });
  } catch (error) {
    console.error(`read image: failed (${filename})`, error);
    return serverError();
  }
}

export async function DELETE(
  _: NextRequest,
  { params: { filename } }: { params: { filename: string } }
) {
  const filePath = resolvePicturePath(filename);
  if (filePath == undefined) {
    return notFound();
  }
  try {
    await fs.promises.rm(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return notFound();
    }
    console.error(`delete image: failed (${filename})`, error);
    return new NextResponse("Failed to delete image", { status: 500 });
  }
  // The image is gone at this point; a leftover thumbnail is unreachable
  // and only wastes space, so it does not fail the request.
  await removeThumbnail(filename).catch((error: unknown) => {
    console.error(`delete thumbnail: failed (${filename})`, error);
  });
  return new NextResponse(null, {
    status: 200,
  });
}
