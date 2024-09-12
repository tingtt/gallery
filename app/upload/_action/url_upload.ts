"use server";

import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import env from "@/constants/env";

export default async function UploadWithURL(formData: FormData) {
  try {
    const url = formData.get("url")?.toString();
    if (url == undefined) {
      throw new Error(`Invalid form data: url is required`);
    }

    // Fetch file from the URL
    const res = await fetch(url);
    if (!res.ok || res.status < 200 || res.status > 299) {
      throw new Error(`Failed to download file: ${res.statusText}`);
    }

    // Split the URL to extract the file extension
    const urlSplitted = url.split(".");
    const extension = urlSplitted[urlSplitted.length - 1];

    // Generate a unique filename using UUID
    const fileName = `${uuidv4()}.${extension}`;
    const filePath = path.join(
      env.PERSISTENT_DATA_BASEDIR,
      "Pictures",
      fileName
    ); // Adjust the directory as needed

    // Create a write stream to save the file
    const fileStream = fs.createWriteStream(filePath);

    // Stream the response body into the file
    new Promise((resolve, reject) => {
      if (res.body == null) {
        return;
      }
      fileStream.on("error", reject);
      fileStream.on("finish", resolve);
      res
        .arrayBuffer()
        .then((buf) => {
          fileStream.write(Buffer.from(buf));
          console.log(`download data: successful (filename: ${fileName})`);
        })
        .catch((e) => {
          // fs.rmSync(filePath);
          throw e;
        });
    });

    return { success: true, filePath };
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
  }
}
