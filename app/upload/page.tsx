import UploadWithURL from "./_action/url_upload";

export default function Upload(): JSX.Element {
  return (
    <>
      {/* <form action="/upload/1" method="POST" enctype="multipart/form-data">
        <label>
          <input type="file" name="file" className="btn" />
          <div className="btn">Select file</div>
        </label>
        <input type="submit" value="Submit" className="btn btn-primary" />
      </form> */}
      <form action={UploadWithURL}>
        <input type="text" name="url" className="input input-bordered" />
        <input type="submit" value="Submit" className="btn btn-primary" />
      </form>
    </>
  );
}
