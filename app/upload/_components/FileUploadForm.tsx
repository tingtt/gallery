"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import UploadWithFile from "../_action/file_upload";

export default function FileUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const result = await UploadWithFile(new FormData(e.currentTarget));
    if (result?.success) {
      formRef.current?.reset();
    } else if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={clsx("flex", "gap-2")}
      >
        <input
          type="file"
          name="file"
          accept="image/*,video/mp4"
          required
          className={clsx("file-input", "file-input-bordered")}
        />
        <input type="submit" value="Upload" className="btn btn-primary" />
      </form>
      {error && <p className="text-error text-sm">{error}</p>}
    </div>
  );
}
