import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { one, rows } from "./db.mjs";
export const digest = (s) => createHash("sha256").update(s).digest("hex");
export function hash(password) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function matches(password, record) {
  const [salt, key] = record.split(":");
  return Boolean(key) && timingSafeEqual(Buffer.from(key, "hex"), scryptSync(password, salt, 64));
}
export async function issue(
  res,
  owner = randomBytes(20).toString("hex"),
  user = null,
  previous = null,
) {
  const key = randomBytes(32).toString("hex"),
    token = digest(key);
  // Consume the old session, claim its guest orders and rotate its cookie in one statement.
  if (previous) {
    const changed = await one(
      `WITH old AS (
      DELETE FROM sessions WHERE token=$1 RETURNING owner,user_id
    ), claimed AS (
      UPDATE orders SET user_id=$2 FROM old WHERE old.user_id IS NULL AND $2::integer IS NOT NULL
        AND orders.owner=old.owner AND orders.user_id IS NULL
    ) INSERT INTO sessions(token,owner,user_id,expires)
      SELECT $3,$4,$2,$5 FROM old RETURNING token`,
      previous.token,
      user,
      token,
      owner,
      Date.now() + 30 * 86400000,
    );
    if (!changed) throw Object.assign(Error("أعد تسجيل الدخول."), { status: 401 });
  } else
    await rows(
      "INSERT INTO sessions(token,owner,user_id,expires) VALUES($1,$2,$3,$4)",
      token,
      owner,
      user,
      Date.now() + 30 * 86400000,
    );
  res.setHeader(
    "Set-Cookie",
    "kitchen_session=" +
      key +
      "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" +
      (process.env.COOKIE_SECURE === "1" ? "; Secure" : ""),
  );
  return { token, owner, user_id: user };
}
export async function session(req, res) {
  const key = (req.headers.cookie || "").match(
    /(?:^|; *)kitchen_session=([a-f0-9]{64})(?:;|$)/,
  )?.[1];
  return (
    (key &&
      (await one(
        "SELECT token,owner,user_id FROM sessions WHERE token=$1 AND expires>$2",
        digest(key),
        Date.now(),
      ))) ||
    issue(res)
  );
}
export async function publicUser(id) {
  if (!id) return null;
  const u = await one("SELECT id,email,name,role,finance,profile FROM users WHERE id=$1", id);
  return u ? { ...u, profile: JSON.parse(u.profile) } : null;
}
