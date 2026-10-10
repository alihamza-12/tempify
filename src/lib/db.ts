import mongoose, { type Connection } from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

type ConnectionCache = {
  conn: Connection | null;
  promise: Promise<Connection> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
  cuvvaVehicleDatabaseCache?: ConnectionCache;
};

const cache = globalWithMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
};

const cuvvaCache = globalWithMongoose.cuvvaVehicleDatabaseCache ?? {
  conn: null,
  promise: null,
};

globalWithMongoose.mongooseCache = cache;
globalWithMongoose.cuvvaVehicleDatabaseCache = cuvvaCache;

/**
 * Tempify's private application database. Users, quotes, orders, OTP tokens and
 * Tempify's provider-verified vehicle cache are stored here.
 */
export async function connectToDatabase() {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured for the Tempify database.");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

/**
 * Restricted connection to the existing Cuvva database. Tempify reads and
 * synchronizes only provider-backed rows in `vehicles`; Cuvva users and all
 * other Cuvva application data remain separate.
 */
export async function connectToCuvvaVehicleDatabase() {
  if (cuvvaCache.conn) return cuvvaCache.conn;

  const uri = process.env.CUVVA_MONGODB_URI;
  if (!uri) {
    throw new Error("CUVVA_MONGODB_URI is not configured for the shared vehicle database.");
  }

  if (!cuvvaCache.promise) {
    cuvvaCache.promise = mongoose.createConnection(uri, {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10_000,
    }).asPromise();
  }

  try {
    cuvvaCache.conn = await cuvvaCache.promise;
  } catch (error) {
    cuvvaCache.promise = null;
    throw error;
  }

  return cuvvaCache.conn;
}
