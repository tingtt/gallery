"use client";

import { useLayoutEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { ImageData } from "../api/images/route";
import Image from "next/image";

export default function Gallery(): JSX.Element {
  const [images, setImages] = useState<ImageData[]>([]);
  const [error, setError] = useState("");

  useLayoutEffect(() => {
    fetch("/api/images").then(async (res) => {
      if (res.status == 200) {
        setImages((await res.json()) as ImageData[]);
      } else {
        setError(((await res.json()) as { error: string }).error);
      }
    });
  }, []);

  useLayoutEffect(() => {
    const anchorEl = document.getElementById(window.location.hash.slice(1));
    if (anchorEl != undefined) {
      anchorEl.scrollIntoView();
    }
  }, []);

  if (error != "") {
    return <div>{error}</div>;
  }

  return (
    <div className={clsx("flex", "flex-wrap", "justify-center")}>
      {images.map((image) => (
        <Link href={`/view/${image.filename}`} id={image.filename}>
          <Image
            className={clsx("object-cover", "h-[320px]", "w-[320px]")}
            alt={image.filename}
            src={`/api/images/${image.filename}`}
            width={image.width ?? 320}
            height={image.height ?? 320}
            loading="lazy"
          />
        </Link>
      ))}
    </div>
  );
}
