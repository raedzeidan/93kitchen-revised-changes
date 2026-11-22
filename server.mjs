import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, extname, sep } from "node:path";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { providers, begin, complete } from "./social.mjs";
import { one, rows } from "./db.mjs";
import { hash, matches, session, issue, publicUser } from "./storage.mjs";
import { mealById, planById, eligible, statuses } from "./public/catalog.js";

const root = fileURLToPath(new URL("./dist/", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".txt": "text/plain",
};
const fees = JSON.parse(process.env.DELIVERY_ZONES || '{"العبدلي":0}');
if (!Object.keys(fees).length || Object.values(fees).some((v) => !Number.isSafeInteger(v) || v < 0))
  throw Error("Invalid DELIVERY_ZONES");
const cliq = {
  alias: process.env.CLIQ_ALIAS || "",
  holder: process.env.CLIQ_HOLDER || "",
  bank: process.env.CLIQ_BANK || "",
};
const contact = {
  phone: (process.env.KITCHEN_PHONE || "").replace(/[^+\d]/g, ""),
  whatsapp: (process.env.KITCHEN_WHATSAPP || "").replace(/\D/g, ""),
  instagram: "https://www.instagram.com/93kitchen.jo/",
  facebook: process.env.KITCHEN_FACEBOOK || "",
};
const attempts = new Map();
function fail(message, code = 400) {
  throw Object.assign(new Error(message), { status: code });
}
function rate(req, subject = "") {
  const ip =
      req.socket.remoteAddress || "account:" + String(subject).trim().toLowerCase().slice(0, 254),
    now = Date.now();
  let r = attempts.get(ip);
  if (!r || r.until < now) {
    r = { count: 0, until: now + 15 * 60e3 };
    attempts.set(ip, r);
  }
  if (++r.count > 50) fail("محاولات كثيرة. جرّب بعد قليل.", 429);
}
function send(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    fail("نوع الطلب غير صالح.", 415);
  const parts = [];
  let size = 0;
  for await (const part of req) {
    const bytes = Buffer.from(part);
    parts.push(bytes);
    size += bytes.length;
    if (size > 50000) fail("الطلب كبير جداً.", 413);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8") || "{}");
  } catch {
    fail("تعذر قراءة الطلب.");
  }
}
function string(v, max = 120) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function details(c = {}) {
  const d = {
    name: string(c.name),
    phone: string(c.phone, 25),
    area: string(c.area),
    address: string(c.address, 400),
    email: string(c.email, 254),
  };
  if (
    !d.name ||
    !/^\+?[\d\s()-]{7,22}$/.test(d.phone) ||
    !Object.hasOwn(fees, d.area) ||
    !d.address
  )
    fail("أكمل الاسم والهاتف وعنواناً ضمن منطقة التوصيل.");
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) fail("راجع البريد الإلكتروني.");
  return d;
}
function schedule(p, rows) {
  if (!Array.isArray(rows) || rows.length !== p.count) fail("أكمل جميع وجبات الباقة.");
  return rows.map((r) => {
    if (!eligible(p, mealById(r?.meal))) fail("اختر وجبة مناسبة لكل يوم.");
    const date = string(r.date, 10);
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        date < new Date().toISOString().slice(0, 10))
    )
      fail("اختر تاريخ تأجيل صالحاً.");
    return { meal: r.meal, note: string(r.note, 250), date };
  });
}
function orderPayload(b) {
  const c = details(b.contact);
  if (!["restaurant", "cliq"].includes(b.payment) || b.terms !== true)
    fail("اختار طريقة الدفع ووافق على شروط الطلب.");
  const p = { contact: c, payment: b.payment, delivery: fees[c.area], terms: true };
  let subtotal;
  if (b.kind === "subscription") {
    const plan = planById(b.plan);
    if (!plan) fail("الباقة غير متاحة.");
    p.plan = plan.id;
    p.schedule = schedule(plan, b.schedule);
    subtotal = plan.price;
  } else if (b.kind === "meal") {
    if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30)
      fail("السلة فارغة أو غير صالحة.");
    const seen = new Set();
    p.items = b.items.map((i) => {
      const m = mealById(i?.id);
      if (!m || seen.has(i.id) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 99)
        fail("راجع كميات الوجبات.");
      seen.add(i.id);
      return { id: m.id, qty: i.qty, price: m.price };
    });
    subtotal = p.items.reduce((a, i) => a + i.qty * i.price, 0);
  } else fail("نوع الطلب غير صالح.");
  return { payload: p, total: subtotal + p.delivery };
}
function row(r) {
  return {
    ref: r.ref,
    kind: r.kind,
    status: r.status,
    total: r.total,
    created: r.created,
    ...JSON.parse(r.payload),
  };
}
async function mine(ref, s) {
  const r = await one(
    "SELECT * FROM orders WHERE ref=$1 AND (owner=$2 OR user_id=$3)",
    ref,
    s.owner,
    s.user_id,
  );
  if (!r) fail("تعذّر العثور على الطلب.", 404);
  return r;
}
function rotate(s, res, id) {
  return issue(res, s.user_id ? undefined : s.owner, id, s);
}
export async function api(req, res, path) {
  const s = await session(req, res),
    u = await publicUser(s.user_id);
  const get = req.method === "GET";
  if (get && path.startsWith("/api/auth/")) {
    let target = "/#/login/unavailable";
    try {
      if (path === "/api/auth/callback") {
        const id = await complete(new URL(req.url, "http://localhost").search, s);
        await rotate(s, res, id);
        target = "/#/signed-in";
      } else {
        rate(req);
        target = await begin(path.split("/").pop(), s);
      }
    } catch {}
    res.writeHead(302, { Location: target, "Cache-Control": "no-store" });
    return res.end();
  }
  if (path === "/api/session" && get) return send(res, { user: u, fees, cliq, contact, providers });
  if (path === "/api/orders" && get)
    return send(
      res,
      (
        await rows(
          "SELECT * FROM orders WHERE owner=$1 OR user_id=$2 ORDER BY created DESC",
          s.owner,
          s.user_id,
        )
      ).map(row),
    );
  if (path.startsWith("/api/qr/") && get) {
    const order = await mine(path.slice(8), s);
    const svg = await QRCode.toString(order.ref, { type: "svg", margin: 2, width: 180 });
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" });
    return res.end(svg);
  }
  if (path.startsWith("/api/staff/")) {
    if (!u || u.role === "customer") fail("هذه الصفحة مخصصة للموظفين.", 403);
    if (path === "/api/staff/orders" && get) {
      if (!u.finance) fail("تحتاج صلاحية المالية.", 403);
      return send(res, (await rows("SELECT * FROM orders ORDER BY created DESC")).map(row));
    }
    if (path === "/api/staff/users" && get) {
      if (u.role !== "admin") fail("تحتاج صلاحية المدير.", 403);
      return send(
        res,
        await rows(
          "SELECT id,name,email,role,finance FROM users WHERE role IN ('staff','admin') ORDER BY name",
        ),
      );
    }
  }
  if (req.method !== "POST") fail("غير موجود.", 404);
  if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
    fail("مصدر الطلب غير صالح.", 403);
  const b = await body(req);
  if (path === "/api/signup" || path === "/api/login") {
    rate(req, b.email);
    const email = string(b.email, 254).toLowerCase(),
      password = typeof b.password === "string" ? b.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128)
      fail("أدخل بريداً صالحاً وكلمة مرور من 8 إلى 128 حرفاً.");
    if (path.endsWith("signup")) {
      if (!string(b.name)) fail("أدخل اسمك.");
      const added = await one(
        "INSERT INTO users(email,hash,name) VALUES($1,$2,$3) ON CONFLICT(email) DO NOTHING RETURNING id",
        email,
        hash(password),
        string(b.name),
      );
      if (!added) fail("تعذّر إنشاء الحساب بهذا البريد.", 409);
      const id = added.id;
      await rotate(s, res, id);
      return send(res, await publicUser(id), 201);
    }
    const user = await one("SELECT * FROM users WHERE email=$1", email);
    if (!user || !matches(password, user.hash))
      fail("البريد الإلكتروني أو كلمة المرور غير صحيحة.", 401);
    await rotate(s, res, user.id);
    return send(res, await publicUser(user.id));
  }
  if (path === "/api/logout") {
    await issue(res, undefined, null, s);
    return send(res, { ok: true });
  }
  if (path === "/api/profile") {
    if (!u) fail("سجّل الدخول أولاً.", 401);
    const d = details(b);
    await rows("UPDATE users SET name=$1,profile=$2 WHERE id=$3", d.name, JSON.stringify(d), u.id);
    return send(res, await publicUser(u.id));
  }
  if (path === "/api/orders") {
    const idem = string(b.requestId, 80);
    if (!/^[\w-]{16,80}$/.test(idem)) fail("حدّث الصفحة وحاول مرة أخرى.");
    const previous = await one("SELECT * FROM orders WHERE owner=$1 AND idem=$2", s.owner, idem);
    if (previous) return send(res, row(previous));
    const { payload, total } = orderPayload(b);
    const ref = "93K-" + randomBytes(6).toString("hex").toUpperCase();
    const created = await one(
      "INSERT INTO orders VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(owner,idem) DO NOTHING RETURNING *",
      ref,
      s.owner,
      s.user_id,
      idem,
      b.kind,
      "pending",
      total,
      JSON.stringify(payload),
      new Date().toISOString(),
    );
    return send(
      res,
      row(created || (await one("SELECT * FROM orders WHERE owner=$1 AND idem=$2", s.owner, idem))),
      created ? 201 : 200,
    );
  }
  if (path === "/api/schedule") {
    const r = await mine(string(b.ref), s);
    if (r.kind !== "subscription" || !["pending", "paid"].includes(r.status))
      fail("لا يمكن تعديل هذا الجدول بعد بدء التحضير.");
    const p = JSON.parse(r.payload);
    p.schedule = schedule(planById(p.plan), b.schedule);
    const updated = await one(
      "UPDATE orders SET payload=$1 WHERE ref=$2 AND status IN ('pending','paid') AND payload=$3 RETURNING ref",
      JSON.stringify(p),
      r.ref,
      r.payload,
    );
    if (!updated) fail("الجدول تغيّر. حدّث الطلب.", 409);
    return send(res, row(await mine(r.ref, s)));
  }
  if (path === "/api/staff/payment") {
    if (!u?.finance) fail("تحتاج صلاحية المالية.", 403);
    const r = await one("SELECT status FROM orders WHERE ref=$1", string(b.ref));
    const next = { pending: "paid", paid: "preparing", preparing: "completed" };
    if (!r || !Object.hasOwn(statuses, b.status) || next[r.status] !== b.status)
      fail("الحالة تغيّرت. راجع الطلب.", 409);
    const updated = await one(
      "UPDATE orders SET status=$1 WHERE ref=$2 AND status=$3 RETURNING ref",
      b.status,
      b.ref,
      r.status,
    );
    if (!updated) fail("الحالة تغيّرت.", 409);
    return send(res, { ok: true });
  }
  if (path === "/api/staff/permissions") {
    if (u?.role !== "admin") fail("تحتاج صلاحية المدير.", 403);
    if (typeof b.finance !== "boolean") fail("صلاحية غير صحيحة.");
    const result = await one(
      "UPDATE users SET finance=$1 WHERE id=$2 AND role='staff' RETURNING id",
      Number(b.finance),
      Number(b.id),
    );
    if (!result) fail("هذا الحساب غير قابل للتعديل.");
    return send(res, { ok: true });
  }
  fail("غير موجود.", 404);
}
export async function handle(req, res) {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    if (path.startsWith("/api/")) return await api(req, res, path);
    if (!["GET", "HEAD"].includes(req.method)) fail("طريقة غير مدعومة.", 405);
    const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(resolve(root) + sep)) fail("غير موجود.", 404);
    if (!(await stat(file)).isFile()) fail("غير موجود.", 404);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch (e) {
    if (!res.headersSent)
      send(
        res,
        {
          error: e.status ? e.message : e.code === "ENOENT" ? "غير موجود." : "تعذّر إتمام العملية.",
        },
        e.status || (e.code === "ENOENT" ? 404 : 500),
      );
    else res.end();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  http
    .createServer(handle)
    .listen(Number(process.env.PORT || 3000), process.env.HOST || "0.0.0.0", function () {
      console.log("93 Kitchen listening on " + this.address().port);
    });
