"use server";

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import env from "@/constants/env";
import path from "path";

export async function GET(
  _: NextRequest,
  { params: { filename } }: { params: { filename: string } }
) {
  try {
    const filePath = path.join(
      env.PERSISTENT_DATA_BASEDIR,
      "Pictures",
      filename
    );

    const file = fs.readFileSync(filePath);

    const header: HeadersInit = {};
    const contentType = getContentType(path.extname(filename));
    if (contentType != undefined) {
      header["Content-Type"] = contentType;
    }
    return new NextResponse(file, {
      status: 200,
      headers: header,
    });
  } catch (error) {
    return new NextResponse("Image not found", { status: 404 });
  }
}

const getContentType = (extension: string): string | null => {
  switch (extension) {
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
      return null;
  }
};

export async function DELETE(
  _: NextRequest,
  { params: { filename } }: { params: { filename: string } }
) {
  try {
    const filePath = path.join(
      env.PERSISTENT_DATA_BASEDIR,
      "Pictures",
      filename
    );
    fs.rmSync(filePath);
    return new NextResponse(null, {
      status: 200,
    });
  } catch (error) {
    return new NextResponse("Image not found", { status: 404 });
  }
}
