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

class MTimeCache {
  private static instance?: MTimeCache;
  private cache: Map<string, number>;
  private constructor() {
    this.cache = new Map<string, number>();
  }

  public static getInstance(): MTimeCache {
    if (!this.instance) {
      this.instance = new MTimeCache();
    }
    return this.instance;
  }

  public set(filename: string, num: number) {
    this.cache.set(filename, num);
  }

  public get(filename: string): number | undefined {
    return this.cache.get(filename);
  }
}

const sortTimeDesc = (files: string[]) => {
  return files
    .map((fileName) => {
      const mtimeCache = MTimeCache.getInstance();
      const mtime = mtimeCache.get(fileName);
      if (mtime) {
        console.log(`inspect image mtime: cache hit (${fileName})`);
        return {
          name: fileName,
          time: mtime,
        };
      }
      console.log(`inspect image mtime: cached (${fileName})`);
      const mtime_ = fs
        .statSync(`${PATH_PICTURES_DIR}/${fileName}`)
        .mtime.getTime();
      mtimeCache.set(fileName, mtime_);
      return {
        name: fileName,
        time: mtime_,
      };
    })
    .sort((a, b) => b.time - a.time)
    .map((file) => file.name);
};

const filterOnlySupported = (files: string[]) => {
  return files.filter((fileName) =>
    [".jpg", ".jpeg", ".png", ".webp", ".mp4"].includes(path.extname(fileName))
  );
};

interface Size {
  width?: number;
  height?: number;
}
class SizeCache {
  private static instance?: SizeCache;
  private cache: Map<string, Size>;
  private constructor() {
    this.cache = new Map<string, Size>();
  }

  public static getInstance(): SizeCache {
    if (!this.instance) {
      this.instance = new SizeCache();
    }
    return this.instance;
  }

  public set(filename: string, size: Size) {
    this.cache.set(filename, size);
  }

  public get(filename: string): Size | undefined {
    return this.cache.get(filename);
  }
}

const getSize = (files: string[]): ImageData[] => {
  return files.map((fileName): ImageData => {
    const sizeCache = SizeCache.getInstance();
    const size = sizeCache.get(fileName);
    if (size) {
      console.log(`inspect image size: cache hit (${fileName})`);
      return {
        filename: fileName,
        width: size.width,
        height: size.height,
      };
    }
    console.log(`inspect image size: cached (${fileName})`);
    try {
      const size = imageSize(`${PATH_PICTURES_DIR}/${fileName}`);
      sizeCache.set(fileName, { width: size.width, height: size.height });
      return {
        filename: fileName,
        width: size.width,
        height: size.height,
      };
    } catch (error) {
      sizeCache.set(fileName, {});
      return {
        filename: fileName,
      };
    }
  });
};
