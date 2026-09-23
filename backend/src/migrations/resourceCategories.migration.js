/**
 * One-time data migration: rename the "presentations" resource category to
 * "lectures".
 *
 * The category enum on Resource used to be
 * notes/assignments/papers/presentations/other; it's now
 * notes/assignments/papers/books/lectures/other — "books" is a genuinely new
 * category (no existing data), but "presentations" and "lectures" overlap
 * conceptually, so existing "presentations" resources are relabeled rather
 * than left stranded outside the schema's enum.
 *
 * Safety properties:
 *  - `dryRun` reads and reports but writes nothing.
 *  - Idempotent: re-running finds nothing left with category "presentations".
 *  - Works on the raw driver collection on purpose: the Resource Mongoose
 *    schema no longer allows "presentations" in its enum, so a `save()` via
 *    the model would reject the very documents this migration needs to read.
 */

export const migrateResourceCategories = async (db, { dryRun = false, log = () => {} } = {}) => {
  const resources = db.collection("resources");

  const stats = { dryRun, matched: 0, migrated: 0 };

  const matched = await resources.countDocuments({ category: "presentations" });
  stats.matched = matched;

  if (matched === 0) {
    log("Nothing to migrate — no resources with category \"presentations\".");
    return stats;
  }

  log(`${dryRun ? "[DRY RUN] " : ""}${matched} resource(s): category "presentations" -> "lectures"`);

  if (dryRun) {
    stats.migrated = matched;
    return stats;
  }

  const result = await resources.updateMany(
    { category: "presentations" },
    { $set: { category: "lectures" } }
  );
  stats.migrated = result.modifiedCount;

  return stats;
};

/**
 * True if any resource still uses the retired "presentations" category, i.e.
 * the migration hasn't run. Used for a loud startup warning — those resources
 * fail schema validation on save until they're relabeled.
 */
export const hasUnmigratedResourceCategories = async (db) => {
  const one = await db.collection("resources").findOne({ category: "presentations" }, { projection: { _id: 1 } });
  return Boolean(one);
};
