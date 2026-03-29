import Link from "next/link";
import UploadWithURL from "./_action/url_upload";
import UploadWithFile from "./_action/file_upload";
import clsx from "clsx";

export default function Upload(): JSX.Element {
  return (
    <div
      className={clsx(
        ["min-h-screen", "p-4"],
        ["flex", "flex-col", "justify-start", "gap-8"],
      )}
    >
      <form action={UploadWithFile} className={clsx("flex", "gap-2")}>
        <input
          type="file"
          name="file"
          accept="image/*,video/mp4"
          required
          className={clsx("file-input", "file-input-bordered")}
        />
        <input type="submit" value="Upload" className="btn btn-primary" />
      </form>
      <form action={UploadWithURL} className={clsx("flex", "gap-2")}>
        <input
          type="text"
          name="url"
          required
          className={clsx("input", "input-bordered")}
        />
        <input type="submit" value="Submit" className="btn btn-primary" />
      </form>
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
