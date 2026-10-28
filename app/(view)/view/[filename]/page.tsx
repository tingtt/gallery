"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { originalSrc } from "@/lib/images/urls";
import { useGallery } from "../../_components/GalleryProvider";

const STYLE_NEXT_PREV_BTN = clsx(
  "z-10",
  "btn",
  "btn-ghost",
  "no-animation",
  "h-40"
);

export default function View({
  params: { filename },
}: {
  params: { filename: string };
}): JSX.Element {
  const { state, remove } = useGallery();
  const router = useRouter();

  if (state.status == "error") {
    return <div>{state.error}</div>;
  }
  if (state.status == "loading") {
    return <div />;
  }

  const images = state.images;
  const index = images.findIndex((v) => v.filename == filename);
  if (index == -1) {
    return (
      <div className={clsx("min-h-screen", "flex", "items-end", "p-4")}>
        <Link
          href="/"
          className={clsx("btn", "btn-circle", "btn-ghost", "z-10")}
        >
          ←
        </Link>
        <p className="m-auto">Image not found</p>
      </div>
    );
  }
  const src = images[index];
  const prevFilename = images[index - 1]?.filename ?? "";
  const nextFilename = images[index + 1]?.filename ?? "";

  return (
    <div>
      <div
        className={clsx(
          ["min-h-screen", "w-full"],
          ["flex", "items-end", "justify-start", "p-4"]
        )}
      >
        <div className={clsx("flex", "justify-between", "w-full", "pr-16")}>
          <Link
            href={`/#${filename}`}
            className={clsx("btn", "btn-circle", "btn-ghost", "z-10")}
          >
            ←
          </Link>
          <button
            className={clsx("btn", "btn-circle", "btn-ghost", "z-10")}
            onClick={() => {
              if (confirm("Are you sure you want to permanently delete it?")) {
                fetch(`/api/images/${filename}`, { method: "DELETE" }).then(
                  (res) => {
                    // 404: already deleted elsewhere, so drop it as well.
                    if (res.ok || res.status == 404) {
                      if (prevFilename != "") {
                        router.push(`/#${prevFilename}`);
                      } else {
                        router.push("/");
                      }
                      remove(filename);
                    } else {
                      alert("Failed to delete image");
                    }
                  }
                );
              }
            }}
          >
            x
          </button>
        </div>
      </div>
      <div
        className={clsx(
          ["absolute", "top-0"],
          ["min-h-screen", "w-full"],
          ["flex", "items-center", "justify-between"]
        )}
      >
        {prevFilename != "" ? (
          <Link href={`/view/${prevFilename}`} className={STYLE_NEXT_PREV_BTN}>
            {"<"}
          </Link>
        ) : (
          <div />
        )}
        {nextFilename != "" ? (
          <Link href={`/view/${nextFilename}`} className={STYLE_NEXT_PREV_BTN}>
            {">"}
          </Link>
        ) : (
          <div />
        )}
      </div>
      <img
        alt={filename}
        src={originalSrc(filename)}
        className={clsx(
          ["absolute", "top-0"],
          ["object-contain", "h-screen", "w-full"]
        )}
        width={src?.width}
        height={src?.height}
      />
    </div>
  );
}
