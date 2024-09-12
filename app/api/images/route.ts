"use server";

import fs from "fs";
import env from "@/constants/env";
import path from "path";
import { NextResponse } from "next/server";
import imageSize from "image-size";

const PATH_PICTURES_DIR = path.join(env.PERSISTENT_DATA_BASEDIR, "Pictures");

export interface ImageData {
  filename: string;
  width?: number;
  height?: number;
}

export async function GET() {
  try {
    const files = filterOnlySupported(fs.readdirSync(PATH_PICTURES_DIR));
    const sortedFiles = sortTimeDesc(files);
    const filesWithSize = getSize(sortedFiles);
    return NextResponse.json(filesWithSize, { status: 200 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ erorr: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ erorr: `${error}` }, { status: 500 });
    }
  }
}

const sortTimeDesc = (files: string[]) => {
  return files
    .map((fileName) => ({
      name: fileName,
      time: fs.statSync(`${PATH_PICTURES_DIR}/${fileName}`).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)
    .map((file) => file.name);
};

const filterOnlySupported = (files: string[]) => {
  return files.filter((fileName) =>
    [".jpg", ".jpeg", ".png", ".webp", ".mp4"].includes(path.extname(fileName))
  );
};

const getSize = (files: string[]): ImageData[] => {
  return files.map((fileName): ImageData => {
    try {
      const size = imageSize(`${PATH_PICTURES_DIR}/${fileName}`);
      return {
        filename: fileName,
        width: size.width,
        height: size.height,
      };
    } catch (error) {
      return {
        filename: fileName,
      };
    }
  });
};
