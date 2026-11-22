import { readFile } from "node:fs/promises";
import { rows, closeDatabase } from "./db.mjs";
const sql = await readFile(new URL("./db/001-initial.sql", import.meta.url), "utf8");
for (const statement of sql
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean))
  await rows(statement);
console.log("93 Kitchen schema ready.");

await closeDatabase();
