import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * Real-MongoDB test harness (in-memory `mongod`). Unlike the *.integration
 * tests that mock the service layer, tests using this exercise real Mongoose
 * schemas, indexes, aggregation pipelines and cursor pagination.
 */
let mongod;

export const startTestDb = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "linklet-test" });
};

export const stopTestDb = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};

/** Wipe every collection between tests (keeps indexes). */
export const clearTestDb = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

/** Make sure a model's indexes exist before a test relies on them ($text, unique, ...). */
export const ensureIndexes = (...models) => Promise.all(models.map((m) => m.init()));

export const oid = () => new mongoose.Types.ObjectId();
