"use client";

import { ImageData } from "@/app/api/images/route";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useState } from "react";

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
  const [src, setSrc] = useState<ImageData>();
  const [prevFilename, setPrevFilename] = useState("");
  const [nextFilename, setNextFilename] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useLayoutEffect(() => {
    fetch("/api/images", { cache: "force-cache" }).then(async (res) => {
      if (res.status == 200) {
        const images = (await res.json()) as ImageData[];
        const index = images.findIndex((v) => v.filename == filename);
        setSrc(images[index]);
        if (/* not first */ index != 0) {
          setPrevFilename(images[index - 1].filename);
        }
        if (/* not last */ index != images.length - 1) {
          setNextFilename(images[index + 1].filename);
        }
      } else {
        setError(((await res.json()) as { error: string }).error);
      }
    });
  }, []);

  if (error != "") {
    return <div>{error}</div>;
  }

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
                    if (res.ok) {
                      if (prevFilename != "") {
                        router.push(`/#${prevFilename}`);
                      } else {
                        router.push("/");
                      }
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
      <Image
        alt={filename}
        src={`/api/images/${filename}`}
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
