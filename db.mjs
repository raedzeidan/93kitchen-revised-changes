import { neon } from "@neondatabase/serverless";
try {
  process.loadEnvFile(".env");
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}

let query;
export let closeDatabase = async () => {};
if (process.env.NODE_ENV === "test" && process.env.TEST_PG_DIR) {
  const { PGlite } = await import("@electric-sql/pglite");
  const testDb = new PGlite(process.env.TEST_PG_DIR);
  closeDatabase = () => testDb.close();
  query = async (sql, params) => (await testDb.query(sql, params)).rows;
} else {
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL to the Neon database connection string.");
  const client = neon(process.env.DATABASE_URL);
  query = (sql, params) => client.query(sql, params);
}
export const rows = (sql, ...params) => query(sql, params);
export const one = async (sql, ...params) => (await rows(sql, ...params))[0];
