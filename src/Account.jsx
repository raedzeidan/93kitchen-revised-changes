import React, { useState, useEffect } from "react";
import { Title, Empty, Modal, go, api, asset, Social } from "./ui.jsx";
import { money, statuses, planById, mealById } from "../public/catalog.js";
import { ContactFields } from "./Checkout.jsx";
export function Login({ signup, after, staff = false, providers = [], unavailable = false }) {
  const [error, setError] = useState(
      unavailable
        ? "تعذّر إكمال دخول الحساب الاجتماعي. استخدم بريدك الإلكتروني أو طريقة الدخول الأصلية."
        : "",
    ),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      const u = await api(signup ? "signup" : "login", f);
      after(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container page">
      <Title sub={staff ? "دخول موظفي المطعم" : "حساب الزبائن · 93 Kitchen"}>
        {signup ? "إنشاء حساب" : "تسجيل الدخول"}
      </Title>
      <div className="auth-grid">
        <section className="panel">
          <h2>{signup ? "حساب جديد" : "أهلاً بعودتك"}</h2>
          {!staff && (
            <>
              <div className="providers">
                {["Apple", "Google", "Facebook"].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={!providers.includes(n)}
                    onClick={() => location.assign("/api/auth/" + n)}
                    title={providers.includes(n) ? "متابعة مع " + n : "غير مفعّل حالياً"}
                  >
                    <img src={asset("provider-" + n.toLowerCase() + ".svg")} alt="" />
                    {n}
                  </button>
                ))}
              </div>
              {!providers.length && <small>التسجيل المتاح حالياً عبر البريد الإلكتروني.</small>}
            </>
          )}
          <form className="form" onSubmit={submit}>
            {signup && (
              <label>
                الاسم الكامل
                <input required name="name" autoComplete="name" />
              </label>
            )}
            <label>
              البريد الإلكتروني
              <input type="email" name="email" dir="ltr" autoComplete="email" required />
            </label>
            <label>
              كلمة المرور
              <input
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete={signup ? "new-password" : "current-password"}
                required
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="btn primary" disabled={busy}>
              {signup ? "إنشاء حساب بالبريد الإلكتروني" : "تسجيل الدخول"}
            </button>
          </form>
          {!staff && (
            <a className="under" href={signup ? "#/login" : "#/signup"}>
              {signup ? "عندك حساب؟ تسجيل الدخول" : "ما عندك حساب؟ إنشاء حساب"}
            </a>
          )}
        </section>
        <aside className="panel tinted">
          <h2>{staff ? "لوحة إدارة المطعم" : "حسابك يسهّل طلباتك"}</h2>
          <p>
            {staff
              ? "راجع المدفوعات والصلاحيات من حساب الموظف."
              : "احتفظ بعناوين التوصيل، وراجع طلباتك واشتراكاتك، وغيّر وجباتك من مكان واحد."}
          </p>
        </aside>
      </div>
    </div>
  );
}
export function Account({ user, fees, onChange, logout }) {
  const [err, setErr] = useState(""),
    [saved, setSaved] = useState("");
  return (
    <div className="container page">
      <Title sub={user.email}>أهلاً {user.name}</Title>
      <div className="split">
        <section className="panel">
          <h2>بياناتي المحفوظة</h2>
          <ContactFields
            fees={fees}
            initial={{ name: user.name, email: user.email, ...user.profile }}
            button="حفظ البيانات"
            submit={async (f) => {
              try {
                onChange(await api("profile", f));
                setSaved("تم حفظ بياناتك.");
                setErr("");
              } catch (e) {
                setErr(e.message);
              }
            }}
          />
          {(err || saved) && <p role="status">{err || saved}</p>}
        </section>
        <aside className="panel stack">
          <a className="btn primary" href="#/orders">
            طلباتي واشتراكاتي
          </a>
          {user.role !== "customer" && (
            <a className="btn line" href="#/staff">
              لوحة إدارة المطعم
            </a>
          )}
          <button className="btn line" onClick={logout}>
            تسجيل الخروج
          </button>
        </aside>
      </div>
    </div>
  );
}
export const orderTitle = (o) =>
  o.kind === "subscription"
    ? planById(o.plan)?.name
    : o.items.map((i) => mealById(i.id)?.name + " × " + i.qty).join("، ");
export function Orders({ orders, error }) {
  return (
    <div className="container page">
      <Title sub="راجع طلباتك وتابع حالتها.">طلباتي واشتراكاتي</Title>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : orders === null ? (
        <p>جارٍ تحميل الطلبات…</p>
      ) : !orders.length ? (
        <Empty title="ما عندك طلبات حتى الآن" />
      ) : (
        <div className="stack">
          {orders.map((o) => (
            <article key={o.ref} className="panel row wrap">
              <div>
                <h3>{orderTitle(o)}</h3>
                <p>
                  <bdi>{o.ref}</bdi> · {money(o.total)} · {o.contact.area}
                </p>
              </div>
              <span className="pill">{statuses[o.status]}</span>
              <a className="btn line" href={"#/order/" + o.ref}>
                عرض التفاصيل
              </a>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
export function Receipt({ order: o, cliq, contact, edit }) {
  if (!o) return <Empty title="تعذّر العثور على الطلب" link="/orders" label="طلباتي" />;
  const paid = o.status !== "pending";
  return (
    <div className="container page">
      <Title sub={"رقم المرجع · " + o.ref}>
        {paid
          ? o.kind === "subscription"
            ? "تم تفعيل اشتراكك"
            : "تم تأكيد الدفع"
          : "تم استلام " + (o.kind === "subscription" ? "طلب الاشتراك" : "طلبك")}
      </Title>
      <div className="split">
        <section className="panel">
          <span className="pill">{statuses[o.status]}</span>
          {paid ? (
            <>
              <img className="confirm-icon" src={asset("confirmed.svg")} alt="" />
              <h2>{o.kind === "subscription" ? "اشتراكك مفعّل" : "طلبك قيد المتابعة"}</h2>
            </>
          ) : o.payment === "restaurant" ? (
            <>
              <h2>ادفع داخل المطعم</h2>
              <p>اعرض الرقم المرجعي أو رمز QR عند الكاشير لتأكيد الدفع.</p>
              <div className="qr">
                <img
                  width="180"
                  height="180"
                  src={"/api/qr/" + o.ref}
                  alt={"رمز مرجع الطلب " + o.ref}
                />
                <bdi>{o.ref}</bdi>
              </div>
            </>
          ) : (
            <>
              <h2>تفاصيل تحويل CliQ</h2>
              {cliq.alias ? (
                <dl>
                  <dt>معرّف CliQ</dt>
                  <dd>
                    <bdi>{cliq.alias}</bdi>
                  </dd>
                  {cliq.holder && (
                    <>
                      <dt>اسم صاحب الحساب</dt>
                      <dd>{cliq.holder}</dd>
                    </>
                  )}
                  {cliq.bank && (
                    <>
                      <dt>البنك</dt>
                      <dd>{cliq.bank}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p>تواصل مع المطعم لتأكيد بيانات التحويل قبل إرسال المبلغ.</p>
              )}
              <p>اكتب رقم الطلب في ملاحظات التحويل. تتحدث الحالة بعد مراجعة المطعم للدفعة.</p>
              <Social contact={contact} />
            </>
          )}
          {o.kind === "subscription" && (
            <>
              <p>يبدأ الاشتراك من تاريخ تأكيد الدفع.</p>
              {["pending", "paid"].includes(o.status) && (
                <button className="btn line" onClick={() => edit(o)}>
                  مراجعة وتعديل جدول الوجبات
                </button>
              )}
            </>
          )}
        </section>
        <aside className="panel summary">
          <h2>ملخص الطلب</h2>
          <h3>{orderTitle(o)}</h3>
          <dl>
            <dt>منطقة التوصيل</dt>
            <dd>{o.contact.area}</dd>
            <dt>عنوان التوصيل</dt>
            <dd>{o.contact.address}</dd>
            <dt>طريقة الدفع</dt>
            <dd>{o.payment === "cliq" ? "CliQ" : "داخل المطعم"}</dd>
            <dt>الإجمالي</dt>
            <dd>{money(o.total)}</dd>
          </dl>
          <a className="btn primary full" href="#/orders">
            متابعة طلباتي
          </a>
          <a className="under" href="#/">
            العودة للرئيسية
          </a>
        </aside>
      </div>
    </div>
  );
}
export function Staff({ user }) {
  const [tab, setTab] = useState(user.finance ? "orders" : "users"),
    [data, setData] = useState([]),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [current, edit] = useState(null),
    [error, err] = useState(""),
    [refresh, again] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let valid = true;
    setData([]);
    err("");
    api("staff/" + tab)
      .then((r) => valid && setData(r))
      .catch((e) => valid && err(e.message));
    return () => {
      valid = false;
    };
  }, [tab, refresh]);
  async function save(body) {
    setBusy(true);
    try {
      await api("staff/" + (tab === "orders" ? "payment" : "permissions"), body);
      edit(null);
      again((n) => n + 1);
      err("");
    } catch (e) {
      err(e.message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = data.filter(
    (d) =>
      (tab === "orders" ? d.ref + " " + d.contact.name : d.name + " " + d.email)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!filter || tab !== "orders" || d.status === filter),
  );
  return (
    <div className="container page">
      <Title sub={user.name}>لوحة إدارة المطعم</Title>
      <div className="staff-grid">
        <aside className="panel stack">
          <h3>إدارة المطعم</h3>
          {Boolean(user.finance) && (
            <button
              className={"btn " + (tab === "orders" ? "primary" : "line")}
              onClick={() => {
                setTab("orders");
                setQuery("");
              }}
            >
              المالية والطلبات
            </button>
          )}
          {user.role === "admin" && (
            <button
              className={"btn " + (tab === "users" ? "primary" : "line")}
              onClick={() => {
                setTab("users");
                setQuery("");
              }}
            >
              الموظفون والصلاحيات
            </button>
          )}
          <a href="#/account">حساب الموظف</a>
        </aside>
        <section className="panel">
          <h2>{tab === "orders" ? "المالية · مطابقة الدفعات" : "الموظفون والصلاحيات"}</h2>
          <div className="toolbar">
            <input
              aria-label="بحث"
              placeholder="ابحث بالاسم أو المرجع"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {tab === "orders" && (
              <select
                aria-label="حالة الطلب"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">كل الحالات</option>
                {Object.entries(statuses).map(([v, s]) => (
                  <option key={v} value={v}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="stack">
            {filtered.map((d) => (
              <article className="order-row" key={d.id || d.ref}>
                <div>
                  <b>{d.contact?.name || d.name}</b>
                  <small>{d.ref || d.email}</small>
                </div>
                <span>
                  {tab === "orders" ? money(d.total) : d.role === "admin" ? "مدير النظام" : "موظف"}
                </span>
                {tab === "orders" && <span className="pill">{statuses[d.status]}</span>}
                <button className="btn line" disabled={d.role === "admin"} onClick={() => edit(d)}>
                  عرض / تعديل
                </button>
              </article>
            ))}
            {!filtered.length && <p>لا توجد نتائج.</p>}
          </div>
        </section>
      </div>
      {current && (
        <Modal
          title={tab === "orders" ? "مراجعة الدفعة والطلب" : "صلاحيات الموظف"}
          close={() => edit(null)}
        >
          {tab === "orders" ? (
            <>
              <h3>{current.contact.name}</h3>
              <p>
                {orderTitle(current)} · {money(current.total)}
              </p>
              <p>
                المرجع: <bdi>{current.ref}</bdi> · {current.payment === "cliq" ? "CliQ" : "المطعم"}
              </p>
              <p>
                {current.contact.phone} · {current.contact.address}
              </p>
              {current.status !== "completed" && (
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() =>
                    save({
                      ref: current.ref,
                      status: { pending: "paid", paid: "preparing", preparing: "completed" }[
                        current.status
                      ],
                    })
                  }
                >
                  {
                    {
                      pending: "تأكيد استلام الدفعة",
                      paid: "بدء التحضير",
                      preparing: "إكمال الطلب",
                    }[current.status]
                  }
                </button>
              )}
            </>
          ) : (
            <>
              <h3>{current.name}</h3>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(current.finance)}
                  onChange={(e) => edit({ ...current, finance: e.target.checked })}
                />{" "}
                عرض المالية ومطابقة الدفعات
              </label>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => save({ id: current.id, finance: Boolean(current.finance) })}
              >
                حفظ الصلاحيات
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </Modal>
      )}
    </div>
  );
}
