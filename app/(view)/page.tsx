"use client";

import { useLayoutEffect, useRef } from "react";
import clsx from "clsx";
import Link from "next/link";
import { thumbnailSrc } from "@/lib/images/urls";
import { useGallery } from "./_components/GalleryProvider";

export default function Gallery(): JSX.Element {
  const { state } = useGallery();
  const scrolled = useRef(false);

  // Scroll back to `#filename` once the list (possibly fetched asynchronously)
  // has rendered the anchor.
  useLayoutEffect(() => {
    if (scrolled.current || state.status != "ready") {
      return;
    }
    scrolled.current = true;
    const anchorEl = document.getElementById(window.location.hash.slice(1));
    if (anchorEl != undefined) {
      anchorEl.scrollIntoView();
    }
  }, [state]);

  if (state.status == "error") {
    return <div>{state.error}</div>;
  }
  if (state.status == "loading") {
    return <div />;
  }

  return (
    <div className={clsx("flex", "flex-wrap", "justify-center")}>
      {state.images.map((image) => (
        <Link
          key={image.filename}
          href={`/view/${image.filename}`}
          id={image.filename}
          prefetch={false}
        >
          <img
            className={clsx("object-cover", "h-[320px]", "w-[320px]")}
            alt={image.filename}
            src={thumbnailSrc(image.filename)}
            width={image.width ?? 320}
            height={image.height ?? 320}
            loading="lazy"
          />
        </Link>
      ))}
    </div>
  );
}
