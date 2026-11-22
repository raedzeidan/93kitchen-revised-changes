import React, { useEffect, useState } from "react";
import { meals, plans, mealById, planById, money, statuses } from "../public/catalog.js";
import {
  api,
  asset,
  dishPhoto,
  go,
  Header,
  Footer,
  Drawer,
  Homepage,
  MealCard,
  PlanCards,
  Title,
  Empty,
  Social,
} from "./ui.jsx";
import { Planner, Identity, Details, Review } from "./Checkout.jsx";
import { Login, Account, Orders, Receipt, Staff } from "./Account.jsx";

import { defaultFees } from "../public/delivery.js";
const blankContact = { name: "", phone: "", area: "", address: "", email: "" };
const initialDraft = () => ({
  kind: "meal",
  plan: "mixed",
  schedule: [],
  week: 0,
  contact: { ...blankContact },
  payment: "restaurant",
  terms: false,
  requestId: crypto.randomUUID(),
  editing: "",
});
function stored(storage: Storage, key: string, fallback: () => any) {
  try {
    return JSON.parse(storage.getItem(key) || "null") ?? fallback();
  } catch {
    return fallback();
  }
}
function useStored(key: string, storage: Storage, fallback: () => any) {
  const [value, setValue] = useState(() => stored(storage, key, fallback));
  useEffect(() => {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}
const defaultConfig = {
  fees: defaultFees,
  cliq: {},
  contact: { instagram: "https://www.instagram.com/93kitchen.jo/" },
};
const categories = ["الكل", "دجاج", "سمك", "لحوم", "نباتي", "سلطات"];
const policy: Record<string, [string, string[]]> = {
  subscription: [
    "سياسة الاشتراك",
    [
      "تبدأ الباقة بعد تأكيد استلام الدفع.",
      "يمكن تعديل الوجبات والتاريخ والملاحظات قبل بدء التحضير.",
      "تظهر رسوم التوصيل حسب المنطقة في ملخّص الطلب قبل التأكيد.",
    ],
  ],
  terms: [
    "شروط الطلب",
    [
      "راجع الوجبات والعنوان ورقم الهاتف قبل تأكيد الطلب.",
      "تُراجع دفعات CliQ ودفعات المطعم قبل تفعيل الاشتراك.",
      "للاستفسار عن الإلغاء أو الاسترجاع، تواصل مع المطعم واذكر رقم الطلب.",
    ],
  ],
  payment: [
    "طرق الدفع",
    [
      "تحويل CliQ بعد التأكد من بيانات الحساب من المطعم، أو الدفع داخل المطعم باستخدام الرقم المرجعي ورمز QR.",
      "تقدر تتابع حالة الدفع من صفحة طلباتي.",
    ],
  ],
};
let startup: Promise<any> | undefined;
function loadSession() {
  return startup ??= api("session").then(async config => {
    if (!new URLSearchParams(location.search).has("kitchen_social")) return config;
    try {
      const token = await (await import("./google.js")).finishGoogle(config.managedAuthURL);
      config.user = await api("google-session", { token });
      history.replaceState(null, "", "/#/signed-in");
    } catch {
      history.replaceState(null, "", "/#/login/unavailable");
    }
    return config;
  }).catch(error => { startup = undefined; throw error; });
}
export default function App() {
  const [path, setPath] = useState(location.hash.slice(1) || "/"),
    [drawer, setDrawer] = useState(false),
    [notice, notify] = useState(""),
    [error, err] = useState(""),
    [busy, work] = useState(false);
  const [config, setConfig] = useState<any>(defaultConfig),
    [user, setUser] = useState<any>(null),
    [ready, setReady] = useState(false),
    [offline, setOffline] = useState(false),
    [cart, setCart] = useStored("93k-cart-v1", localStorage, () => ({})),
    [draft, setDraft] = useStored("93k-checkout-v1", sessionStorage, initialDraft),
    [returnTo, setReturn] = useStored("93k-return", sessionStorage, () => "");
  const [orders, setOrders] = useState<any[] | null>(null),
    [version, bump] = useState(0);
  const [view, arg] = path.split("/").filter(Boolean);
  useEffect(() => {
    let live = true;
    loadSession()
      .then((v) => {
        if (live) {
          setPath(location.hash.slice(1) || "/");
          setConfig(v);
          setUser(v.user);
        }
      })
      .catch(() => live && setOffline(true))
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const change = () => {
      setPath(location.hash.slice(1) || "/");
      setDrawer(false);
      err("");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (view === "home" && arg)
      requestAnimationFrame(() => document.getElementById(arg)?.scrollIntoView());
    document.title =
      ({
        menu: "قائمة الطعام",
        planner: "جدول الاشتراك",
        review: "مراجعة الطلب",
        orders: "طلباتي",
        cart: "السلة",
        staff: "إدارة المطعم",
      }[view] || "وجبات بيتية طازجة") + " | 93 Kitchen";
  }, [path]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => notify(""), 2700);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (!ready || !["orders", "order"].includes(view)) return;
    let current = true;
    api("orders")
      .then((v) => current && setOrders(v))
      .catch((e) => current && err(e.message));
    return () => {
      current = false;
    };
  }, [path, version, ready]);
  const count = Object.values(cart).reduce((n: number, q: any) => n + Number(q), 0) as number;
  const sum = Object.entries(cart).reduce(
    (n, [id, q]) => n + (mealById(id)?.price || 0) * Number(q),
    0,
  );
  function adjust(id: string, delta: number) {
    setCart((old: any) => {
      const next = { ...old },
        qty = Math.max(0, Math.min(99, (Number(old[id]) || 0) + delta));
      if (qty) next[id] = qty;
      else delete next[id];
      return next;
    });
  }
  function add(id: string) {
    adjust(id, 1);
    notify("تمت إضافة " + mealById(id)?.name + " إلى السلة");
  }
  function contact() {
    return {
      ...blankContact,
      name: user?.name || "",
      email: user?.email || "",
      ...user?.profile,
      ...Object.fromEntries(Object.entries(draft.contact || {}).filter(([, v]) => v)),
    };
  }
  function choose(id: string) {
    const p = planById(id);
    if (!p) return;
    setDraft({
      ...initialDraft(),
      kind: "subscription",
      plan: id,
      contact: contact(),
      schedule: Array.from({ length: p.count }, () => ({ meal: "", date: "", note: "" })),
    });
    go("/planner");
  }
  function beginMeals() {
    setDraft({ ...initialDraft(), contact: contact() });
    go(user ? "/details" : "/identity");
  }
  function buy(id: string) {
    adjust(id, 1);
    go("/cart");
  }
  function afterLogin(u: any) {
    setUser(u);
    setDraft({
      ...draft,
      contact: { ...draft.contact, name: u.name, email: u.email, ...u.profile },
    });
    const dest = returnTo || (u.role === "customer" ? "/account" : "/staff");
    setReturn("");
    go(dest);
  }
  async function submit() {
    if (busy) return;
    work(true);
    err("");
    try {
      const o = await api("orders", {
        ...draft,
        items: Object.entries(cart).map(([id, qty]) => ({ id, qty })),
      });
      setOrders((prev) => [o, ...(prev || []).filter((x) => x.ref !== o.ref)]);
      if (draft.kind === "meal") setCart({});
      setDraft({ ...initialDraft(), contact: draft.contact });
      bump((v) => v + 1);
      go("/order/" + o.ref);
    } catch (e: any) {
      err(e.message);
    } finally {
      work(false);
    }
  }
  async function finishPlan() {
    if (!draft.editing) {
      go(user ? "/details" : "/identity");
      return;
    }
    try {
      await api("schedule", { ref: draft.editing, schedule: draft.schedule });
      const ref = draft.editing;
      setDraft({ ...initialDraft(), contact: draft.contact });
      bump((v) => v + 1);
      notify("تم حفظ جدول اشتراكك");
      go("/order/" + ref);
    } catch (e: any) {
      notify(e.message);
    }
  }
  function editOrder(o: any) {
    setDraft({
      ...initialDraft(),
      kind: "subscription",
      plan: o.plan,
      contact: o.contact,
      schedule: o.schedule,
      editing: o.ref,
    });
    go("/planner");
  }
  useEffect(() => {
    if (view === "signed-in" && ready) {
      if (user) afterLogin(user);
      else go("/login/unavailable");
    }
  }, [view, ready]);
  const fees = config.fees;
  let body;
  const validCheckout =
    draft.kind === "subscription"
      ? Boolean(draft.schedule.length && draft.schedule.every((r: any) => r.meal))
      : count > 0;
  if (!view || view === "home")
    body = (
      <Homepage
        onAdd={add}
        onBuy={buy}
        choose={choose}
        fees={fees}
        area={draft.contact.area}
        selectArea={(area: string) => setDraft({ ...draft, contact: { ...draft.contact, area } })}
      />
    );
  else if (view === "menu") {
    const selected = categories.includes(decodeURIComponent(arg || ""))
      ? decodeURIComponent(arg)
      : "الكل";
    const filtered = meals.filter((m) =>
      selected === "الكل"
        ? m.id !== "pasta"
        : m.category === selected || (selected === "نباتي" && m.category === "سلطات"),
    );
    body = (
      <div className="container page">
        <Title sub="اختار وجبتك، والباقي علينا.">قائمة الطعام لليوم</Title>
        <div className="tabs" aria-label="فئات الوجبات">
          {categories.map((c) => (
            <a
              key={c}
              className={selected === c ? "active" : ""}
              href={"#/menu/" + encodeURIComponent(c)}
              aria-current={selected === c ? "page" : undefined}
            >
              {c}
            </a>
          ))}
        </div>
        <div className="menu-grid">
          {filtered.map((m) => (
            <MealCard key={m.id} meal={m} onAdd={add} onBuy={buy} />
          ))}
        </div>
      </div>
    );
  } else if (view === "cart")
    body = (
      <div className="container page">
        <Title>سلة الوجبات</Title>
        {count ? (
          <div className="split">
            <div className="stack">
              {Object.entries(cart).map(([id, q]) => {
                const m = mealById(id);
                if (!m) return null;
                return (
                  <article key={id} className="panel cart-row">
                    <img src={dishPhoto(id)} alt="" />
                    <div className="grow">
                      <h3>{m.name}</h3>
                      <p>{money(m.price)}</p>
                    </div>
                    <div className="stepper">
                      <button aria-label={"زيادة " + m.name} onClick={() => adjust(id, 1)}>
                        +
                      </button>
                      <b>{Number(q)}</b>
                      <button aria-label={"إنقاص " + m.name} onClick={() => adjust(id, -1)}>
                        −
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <aside className="panel summary">
              <h2>ملخص السلة</h2>
              <div className="total">
                <span>قيمة الوجبات</span>
                <b>{money(sum)}</b>
              </div>
              <button className="btn primary full" onClick={beginMeals}>
                متابعة الطلب
              </button>
              <a className="under" href="#/menu">
                إضافة وجبات
              </a>
            </aside>
          </div>
        ) : (
          <Empty title="سلّتك فاضية" />
        )}
      </div>
    );
  else if (view === "planner")
    body =
      draft.kind === "subscription" ? (
        <Planner
          key={draft.plan + draft.editing}
          {...{ draft, setDraft, fees }}
          next={finishPlan}
          editing={!!draft.editing}
        />
      ) : (
        <div className="container page">
          <PlanCards choose={choose} />
        </div>
      );
  else if (["identity", "details", "review"].includes(view) && !validCheckout)
    body = (
      <div className="container page">
        <Empty title="اختار وجباتك أولاً" />
      </div>
    );
  else if (view === "identity")
    body = (
      <Identity
        {...{ draft, cart, fees }}
        onLogin={() => {
          setReturn("/details");
          go("/login");
        }}
      />
    );
  else if (view === "details")
    body = (
      <Details
        {...{ draft, cart, fees }}
        save={(c: any) => {
          setDraft({ ...draft, contact: c });
          go("/review");
        }}
      />
    );
  else if (view === "review")
    body = <Review {...{ draft, setDraft, cart, fees, busy, error }} send={submit} />;
  else if (view === "signed-in") body = <p className="container">جارٍ فتح الحساب…</p>;
  else if (
    view === "login" ||
    view === "signup" ||
    ((view === "account" || view === "staff") && !user)
  )
    body = (
      <Login
        key={view}
        signup={view === "signup"}
        after={afterLogin}
        providers={config.providers || []}
        managedAuthURL={config.managedAuthURL}
        unavailable={arg === "unavailable"}
        staff={view === "staff"}
      />
    );
  else if (view === "account")
    body = (
      <Account
        user={user}
        fees={fees}
        onChange={setUser}
        logout={async () => {
          try {
            await api("logout");
            if (config.managedAuthURL) (await import("./google.js")).closeGoogle(config.managedAuthURL).catch(() => {});
            setUser(null);
            setOrders(null);
            setDraft(initialDraft());
            setReturn("");
            go("/");
          } catch (e: any) {
            notify(e.message);
          }
        }}
      />
    );
  else if (view === "orders") body = <Orders orders={orders} error={error} />;
  else if (view === "order")
    body = error ? (
      <p className="container error">{error}</p>
    ) : orders === null ? (
      <p className="container">جارٍ تحميل الطلب…</p>
    ) : (
      <Receipt
        order={orders.find((o) => o.ref === arg)}
        cliq={config.cliq}
        contact={config.contact}
        edit={editOrder}
      />
    );
  else if (view === "staff")
    body =
      user?.role !== "customer" ? (
        <Staff user={user} />
      ) : (
        <div className="container page">
          <Empty title="هذه الصفحة مخصصة للموظفين" link="/account" label="حسابي" />
        </div>
      );
  else if (view === "contact" || view === "about" || view === "policy") {
    const legal = policy[arg] || policy.terms;
    body = (
      <div className="container page info-page">
        <Title>{view === "contact" ? "اتصل بنا" : view === "about" ? "عن مطبخنا" : legal[0]}</Title>
        <div className="panel">
          {view === "about" ? (
            <>
              <img src={asset("chef.webp")} className="about-photo" alt="الشيف في مطبخ 93" />
              <p>
                في 93 Kitchen بنحضّر وجبات طازجة ومتوازنة بطابع الأكل البيتي، لتكون وجبتك اليومية
                أسهل.
              </p>
              <a className="btn primary" href="#/menu">
                تصفّح المنيو
              </a>
            </>
          ) : view === "contact" ? (
            <>
              <h2>93 Kitchen</h2>
              <p>الأردن – عمّان – ناعور</p>
              <p>للاستفسار عن وجبتك أو اشتراكك تواصل مع المطبخ.</p>
              <Social contact={config.contact} />
              <a className="under" href={config.contact.instagram}>
                93kitchen.jo على إنستغرام
              </a>
            </>
          ) : (
            legal[1].map((t) => <p key={t}>{t}</p>)
          )}
        </div>
      </div>
    );
  } else body = <Empty title="الصفحة غير موجودة" link="/" label="العودة للرئيسية" />;
  return (
    <>
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        تخطّى إلى المحتوى
      </a>
      <Header open={() => setDrawer(true)} cart={count} user={user} />
      {offline && (
        <p role="alert" className="offline">
          خدمة الحسابات والطلبات غير متصلة حالياً. يمكنك تصفّح المنيو والباقات.
        </p>
      )}
      <main id="main-content" tabIndex={-1}>
        {body}
      </main>
      <Footer contact={config.contact} />
      {drawer && <Drawer close={() => setDrawer(false)} user={user} />}
      <div className={"toast " + (!notice ? "hidden" : "")} role="status">
        {notice}
      </div>
    </>
  );
}
