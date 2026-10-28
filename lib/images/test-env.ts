import fs from "fs";
import os from "os";
import path from "path";

// Imported first by tests: modules under test read PERSISTENT_DATA_BASEDIR
// when they load, so it must point at a temp dir before they are imported.
export const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-test-"));
process.env.PERSISTENT_DATA_BASEDIR = baseDir;
