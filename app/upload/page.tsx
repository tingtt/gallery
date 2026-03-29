import Link from "next/link";
import clsx from "clsx";
import FileUploadForm from "./_components/FileUploadForm";
import URLUploadForm from "./_components/URLUploadForm";

export default function Upload(): JSX.Element {
  return (
    <div
      className={clsx(
        ["min-h-screen", "p-4"],
        ["flex", "flex-col", "justify-start", "gap-8"],
      )}
    >
      <FileUploadForm />
      <URLUploadForm />
      <div className={"mt-auto"} />
      <Link
        href={"/"}
        className={clsx("btn", "btn-circle", "btn-ghost", "z-10")}
      >
        ←
      </Link>
    </div>
  );
}
