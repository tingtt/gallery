"use server";

import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import env from "@/constants/env";

export default async function UploadWithFile(formData: FormData) {
  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Invalid form data: file is required");
    }

    const originalExt = path.extname(file.name).toLowerCase().replace(".", "");
    const extension = ["jpg", "jpeg", "png", "gif", "webp", "mp4"].includes(
      originalExt
    )
      ? originalExt
      : "jpg";

    const fileName = `${uuidv4()}.${extension}`;
    console.log(`New image: ${fileName}`);
    const filePath = path.join(env.PERSISTENT_DATA_BASEDIR, "Pictures", fileName);

    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, new Uint8Array(arrayBuffer));
    console.log(`upload data: successful (filename: ${fileName})`);

    return { success: true, filePath };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
  }
}
