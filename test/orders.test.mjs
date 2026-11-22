import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

test("guest orders, subscriptions, account ownership and payment reconciliation", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "93k-check-"));
  const env = { ...process.env, NODE_ENV: "test", TEST_PG_DIR: join(folder, "pg"), PORT: "0" };
  const migrate = spawn(process.execPath, ["migrate.mjs"], { env, stdio: "inherit" });
  assert.equal((await once(migrate, "exit"))[0], 0);
  const admin = spawn(process.execPath, ["staff.mjs", "manager@example.test", "مدير الاختبار"], {
    env: { ...env, STAFF_PASSWORD: "offline-test-password" },
    stdio: "ignore",
  });
  assert.equal((await once(admin, "exit"))[0], 0);
  const child = spawn(process.execPath, ["server.mjs"], {
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill();
      await stopped;
    }
    await rm(folder, { recursive: true, force: true });
  });
  const reader = createInterface({ input: child.stdout });
  const [line] = await once(reader, "line");
  const port = line.match(/(\d+)$/)[1];
  function client() {
    let cookie = "";
    return async (path, body) => {
      const res = await fetch("http://127.0.0.1:" + port + "/api/" + path, {
        method: body === undefined ? "GET" : "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.headers.has("set-cookie")) cookie = res.headers.get("set-cookie").split(";")[0];
      return {
        status: res.status,
        data: res.headers.get("content-type").includes("svg") ? await res.text() : await res.json(),
      };
    };
  }
  const buyer = client(),
    other = client(),
    staff = client();
  const contact = {
    name: "عميل اختباري",
    phone: "0700000000",
    address: "عنوان اختباري",
    area: "العبدلي",
  };
  const one = {
    requestId: randomUUID(),
    kind: "meal",
    contact,
    payment: "restaurant",
    terms: true,
    items: [{ id: "biryani", qty: 2, price: 1 }],
  };
  await buyer("session");
  const created = await buyer("orders", one);
  assert.equal(created.status, 201);
  assert.equal(created.data.total, 900);
  assert.equal(created.data.status, "pending");
  assert.equal((await buyer("orders", one)).data.ref, created.data.ref);
  assert.match((await buyer("qr/" + created.data.ref)).data, /<svg/);
  assert.equal((await other("qr/" + created.data.ref)).status, 404);
  assert.equal((await other("orders")).data.length, 0);
  assert.equal((await buyer("staff/orders")).status, 403);
  const subscription = {
    requestId: randomUUID(),
    kind: "subscription",
    plan: "trial",
    contact,
    payment: "cliq",
    terms: true,
    schedule: Array.from({ length: 3 }, () => ({ meal: "biryani" })),
  };
  const sub = await buyer("orders", subscription);
  assert.equal(sub.status, 201);
  assert.equal(sub.data.total, 1300);
  const updated = await buyer("schedule", {
    ref: sub.data.ref,
    schedule: subscription.schedule.map((r) => ({ ...r, note: "بدون صوص" })),
  });
  assert.equal(updated.data.schedule[0].note, "بدون صوص");
  const monthly = {
    ...subscription,
    requestId: randomUUID(),
    plan: "chicken",
    schedule: Array.from({ length: 20 }, () => ({ meal: "burger" })),
  };
  assert.equal((await buyer("orders", monthly)).data.total, 7900);
  assert.equal(
    (
      await buyer("orders", {
        ...monthly,
        requestId: randomUUID(),
        schedule: monthly.schedule.map(() => ({ meal: "fish" })),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await buyer("orders", {
        ...one,
        requestId: randomUUID(),
        contact: { ...contact, area: "غير مشمولة" },
      })
    ).status,
    400,
  );
  const credentials = { email: "buyer@example.test", password: "test-password", name: "مستخدم" };
  assert.equal((await buyer("signup", credentials)).status, 201);
  await buyer("logout", {});
  assert.equal((await buyer("orders")).data.length, 0);
  await buyer("login", credentials);
  assert.equal((await buyer("orders")).data.length, 3);
  await staff("login", { email: "manager@example.test", password: "offline-test-password" });
  assert.equal((await staff("staff/orders")).data.length, 3);
  assert.equal((await staff("staff/payment", { ref: sub.data.ref, status: "paid" })).status, 200);
  assert.equal((await buyer("orders")).data.find((o) => o.ref === sub.data.ref).status, "paid");
  const review = await buyer("orders", { ...one, requestId: randomUUID(), contact: { ...contact, area: "إربد" } });
  assert.equal(review.status, 201);
  assert.equal(review.data.status, "delivery_review");
  assert.equal(review.data.delivery, null);
  const quote = { ref: review.data.ref, status: "pending", delivery: 220 };
  assert.equal((await staff("staff/payment", { ...quote, status: "paid" })).status, 409);
  assert.equal((await staff("staff/payment", quote)).status, 200);
  assert.equal((await staff("staff/payment", quote)).status, 409);
  assert.equal((await buyer("orders")).data.find(o => o.ref === quote.ref).total, 1120);
  assert.equal((await buyer("google-session", { token: "invalid" })).status, 401);
});
