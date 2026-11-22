import { rows, closeDatabase } from "./db.mjs";
import { hash } from "./storage.mjs";
const [email, name] = process.argv.slice(2);
const password = process.env.STAFF_PASSWORD;
if (!email?.includes("@") || !name || !password || password.length < 12)
  throw new Error("Use STAFF_PASSWORD (12+ characters) and npm run staff -- email name");
const role = process.env.STAFF_ROLE || "admin";
if (!["admin", "staff"].includes(role)) throw new Error("STAFF_ROLE must be admin or staff");
await rows(
  "INSERT INTO users(email,hash,name,role,finance) VALUES($1,$2,$3,$4,$5)",
  email.toLowerCase().trim(),
  hash(password),
  name,
  role,
  Number(role === "admin"),
);
console.log("Staff account created.");

await closeDatabase();
