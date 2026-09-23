/**
 * Backfill `fileSize` (bytes) on resources uploaded before the field existed.
 * New uploads store Cloudinary's reported size; older ones get it from the
 * file's Content-Length (a HEAD request — nothing is downloaded).
 *
 * Safety properties:
 *  - `dryRun` fetches and reports sizes but writes nothing.
 *  - Idempotent: only touches uploaded files that have no `fileSize` yet;
 *    links are skipped. A size that can't be read is reported and left unset
 *    (the UI simply shows no size for it), so re-running retries just those.
 *  - Only ever `$set`s the one new field.
 */

const CONCURRENCY = 5;

export const headContentLength = async (url) => {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0) throw new Error("no Content-Length");
  return length;
};

const MISSING_SIZE = {
  fileType: { $ne: "link" },
  fileUrl: { $regex: "^https?://" },
  $or: [{ fileSize: { $exists: false } }, { fileSize: null }],
};

export const migrateResourceSizes = async (
  db,
  { dryRun = false, log = () => {}, getSize = headContentLength } = {}
) => {
  const resources = db.collection("resources");
  const pending = await resources.find(MISSING_SIZE, { projection: { fileUrl: 1, title: 1 } }).toArray();
  const stats = { dryRun, matched: pending.length, sized: 0, failed: [] };

  if (pending.length === 0) {
    log("Nothing to backfill — every uploaded resource has a fileSize.");
    return stats;
  }
  log(`${dryRun ? "[DRY RUN] " : ""}Reading sizes for ${pending.length} resource(s)`);

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    await Promise.all(
      pending.slice(i, i + CONCURRENCY).map(async (doc) => {
        try {
          const fileSize = await getSize(doc.fileUrl);
          if (!dryRun) await resources.updateOne({ _id: doc._id }, { $set: { fileSize } });
          stats.sized++;
        } catch (err) {
          stats.failed.push({ _id: String(doc._id), reason: err.message });
        }
      })
    );
  }
  return stats;
};
