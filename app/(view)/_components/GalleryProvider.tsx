"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImageData } from "@/app/api/images/route";

export type GalleryState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; images: ImageData[] };

interface GalleryContextValue {
  state: GalleryState;
  reload: () => void;
  remove: (filename: string) => void;
}

const GalleryContext = createContext<GalleryContextValue | null>(null);

/**
 * Owns the image list shared by the list and detail pages.
 *
 * Mounted in the `(view)` layout, so the list is fetched once and survives
 * client-side navigation (Link, Prev/Next, browser Back) between those pages.
 * Leaving the group (e.g. to `/upload`) unmounts it, so the list is fetched
 * again on return and reflects new uploads.
 */
export default function GalleryProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [state, setState] = useState<GalleryState>({ status: "loading" });
  const inflight = useRef<Promise<void>>();

  const reload = useCallback(() => {
    if (inflight.current) {
      return;
    }
    inflight.current = fetchImages()
      .then((images) => setState({ status: "ready", images }))
      .catch((error: unknown) =>
        setState({
          status: "error",
          error: error instanceof Error ? error.message : `${error}`,
        })
      )
      .finally(() => {
        inflight.current = undefined;
      });
  }, []);

  const remove = useCallback((filename: string) => {
    setState((state) =>
      state.status == "ready"
        ? {
            status: "ready",
            images: state.images.filter((v) => v.filename != filename),
          }
        : state
    );
  }, []);

  useEffect(reload, [reload]);

  const value = useMemo(
    () => ({ state, reload, remove }),
    [state, reload, remove]
  );

  return (
    <GalleryContext.Provider value={value}>{children}</GalleryContext.Provider>
  );
}

export function useGallery(): GalleryContextValue {
  const value = useContext(GalleryContext);
  if (value == null) {
    throw new Error("useGallery must be used within GalleryProvider");
  }
  return value;
}

const fetchImages = async (): Promise<ImageData[]> => {
  const res = await fetch("/api/images", { cache: "no-store" });
  if (res.status != 200) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Failed to load images (${res.status})`);
  }
  return (await res.json()) as ImageData[];
};
