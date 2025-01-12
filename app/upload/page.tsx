import Link from "next/link";
import UploadWithURL from "./_action/url_upload";
import clsx from "clsx";

export default function Upload(): JSX.Element {
  return (
    <div
      className={clsx(
        ["min-h-screen", "p-4"],
        ["flex", "flex-col", "justify-between"]
      )}
    >
      {/* <form action="/upload/1" method="POST" enctype="multipart/form-data">
        <label>
          <input type="file" name="file" className="btn" />
          <div className="btn">Select file</div>
        </label>
        <input type="submit" value="Submit" className="btn btn-primary" />
      </form> */}
      <form action={UploadWithURL} className={clsx("flex", "gap-2")}>
        <input
          type="text"
          name="url"
          required
          className={clsx("input", "input-bordered")}
        />
        <input type="submit" value="Submit" className="btn btn-primary" />
      </form>
      <Link
        href={"/"}
        className={clsx("btn", "btn-circle", "btn-ghost", "z-10")}
      >
        ←
      </Link>
    </div>
  );
}
