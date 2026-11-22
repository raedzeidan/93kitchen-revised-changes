import React, { useEffect, useId, useRef } from "react";
import { money, plans, faqs, mealById } from "../public/catalog.js";

export const asset = (name) => import.meta.env.BASE_URL + "assets/" + name;
export const icon = (name, size = 22) => (
  <img width={size} height={size} className="icon" src={asset(name + ".svg")} alt="" />
);
export const dishPhoto = (id, featured = false) =>
  asset((featured || id === "pasta" ? "featured-" : "meal-") + id + ".webp");
export const go = (path) => {
  if (location.hash.slice(1) === path) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = path;
};
export async function api(path, body) {
  const r = await fetch("/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({ error: "خدمة الطلبات غير متصلة." }));
  if (!r.ok || data.error) throw Error(data.error || "تعذر الاتصال بالمطعم.");
  return data;
}
export function Modal({ title, close, children, drawer = false }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    const active = document.activeElement;
    d.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      d.close();
      document.body.style.overflow = previous;
      active?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={drawer ? "drawer" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const b = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < b.left ||
            e.clientX > b.right ||
            e.clientY < b.top ||
            e.clientY > b.bottom
          )
            close();
        }
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <button className="square close" onClick={close} aria-label="إغلاق">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Header({ open, cart, user }) {
  return (
    <header className="header">
      <div className="head-inner">
        <button className="square" onClick={open} aria-label="فتح القائمة">
          {icon("menu", 21)}
        </button>
        <a className="brand" href="#/" aria-label="93 Kitchen الرئيسية">
          <img src={asset("logo.svg")} alt="93 Kitchen" />
        </a>
        <div className="head-tools">
          <a href="#/cart" className="head-icon" aria-label={"السلة، " + cart + " وجبة"}>
            {icon("cart", 26)}
            {cart > 0 && <b className="badge">{cart}</b>}
          </a>
          <a href="#/account" className="head-icon" aria-label={user ? "حسابي" : "تسجيل الدخول"}>
            {icon("account", 26)}
          </a>
        </div>
      </div>
    </header>
  );
}
const nav = [
  ["الرئيسية", "/"],
  ["قائمة الطعام", "/menu"],
  ["الاشتراكات", "/home/plans"],
  ["عن مطبخنا", "/home/about"],
  ["اتصل بنا", "/contact"],
];
export function Drawer({ close, user }) {
  return (
    <Modal title="القائمة" close={close} drawer>
      <img className="drawer-logo" src={asset("logo.svg")} alt="93 Kitchen" />
      <nav>
        {nav.map(([label, path]) => (
          <a key={label} href={"#" + path} onClick={close}>
            {label}
          </a>
        ))}
        <a href="#/orders" onClick={close}>
          طلباتي
        </a>
        {user?.role && user.role !== "customer" && (
          <a href="#/staff" onClick={close}>
            لوحة إدارة المطعم
          </a>
        )}
      </nav>
      <div className="drawer-address">الأردن · عمّان · ناعور</div>
    </Modal>
  );
}
export function Social({ contact = {} }) {
  return (
    <div className="social">
      {[
        ["instagram", contact.instagram, "إنستغرام"],
        ["facebook", contact.facebook, "فيسبوك"],
        ["whatsapp", contact.whatsapp && "https://wa.me/" + contact.whatsapp, "واتساب"],
        ["call", contact.phone && "tel:" + contact.phone, "اتصل بنا"],
      ]
        .filter((x) => x[1])
        .map(([name, url, label]) => (
          <a key={name} href={url} aria-label={label}>
            {icon(name, 23)}
          </a>
        ))}
    </div>
  );
}
export function Footer({ contact }) {
  return (
    <footer>
      <div className="container foot-grid">
        <a href="#/" aria-label="الرئيسية">
          <img className="foot-logo" src={asset("logo-white.svg")} alt="93 Kitchen" />
        </a>
        <div>
          <h3>موقعنا</h3>
          <a href="https://www.google.com/maps/search/?api=1&query=Naour+Amman+Jordan">
            {icon("pin-footer", 18)} الأردن – عمّان – ناعور
          </a>
        </div>
        <div>
          <h3>روابط سريعة</h3>
          {[
            ["الوجبات", "/menu"],
            ["الاشتراكات", "/home/plans"],
            ["مناطق التوصيل", "/home/delivery"],
            ["طرق الدفع", "/policy/payment"],
          ].map(([s, p]) => (
            <a href={"#" + p} key={s}>
              {s}
            </a>
          ))}
        </div>
        <div>
          <h3>معلومات</h3>
          <a href="#/policy/subscription">سياسة الاشتراك</a>
          <a href="#/home/about">عن مطبخنا</a>
          <a href="#/policy/terms">الشروط</a>
          <a href="#/contact">اتصل بنا</a>
        </div>
        <div>
          <h3>تابعنا</h3>
          <Social contact={contact} />
        </div>
      </div>
    </footer>
  );
}
export function MealCard({ meal: m, featured = false, onAdd, onBuy }) {
  return (
    <article className="meal-card">
      <img className="dish-image" loading="lazy" src={dishPhoto(m.id, featured)} alt={m.name} />
      <div className="meal-body">
        <h3>{m.name}</h3>
        {featured && (
          <strong className="price">
            <bdi>{(m.price / 100).toFixed(2)} JD</bdi>
          </strong>
        )}
        <p>
          {featured ? "المكونات: " : ""}
          {m.ingredients}
        </p>
        <p>{featured ? "تكفي: شخص واحد" : "حصة فردية"}</p>
        {!featured && (
          <strong className="price">
            <bdi>{(m.price / 100).toFixed(2)} JD</bdi>
          </strong>
        )}
        <div className="meal-actions">
          <button className="btn line" onClick={() => onBuy(m.id)}>
            اطلب الوجبة
          </button>
          <button
            className="cart-add"
            aria-label={"أضف " + m.name + " إلى السلة"}
            onClick={() => onAdd(m.id)}
          >
            {icon("add-cart", 21)}
          </button>
        </div>
      </div>
    </article>
  );
}
export function PlanCards({ choose }) {
  return (
    <section id="plans" className="container section">
      <h2>الاشتراكات الشهرية</h2>
      <div className="plan-grid visual-order">
        {plans.map((p, i) => (
          <article key={p.id} className={"plan-card " + (!i ? "featured-plan" : "")} dir="rtl">
            <h3>{p.name}</h3>
            <strong>
              {p.price / 100} دينار <span>/</span> {p.count} {p.count === 20 ? "وجبة" : "وجبات"}
            </strong>
            <p>{p.description}</p>
            <div className="benefits">
              {p.id === "trial" ? (
                <>
                  اختار 3 وجبات وجرّب مطبخنا
                  <br />
                  التوصيل حسب المنطقة المتاحة
                </>
              ) : (
                <>
                  تغيير الوجبة · تأجيلها · تعديل الموعد
                  <br />
                  اختيار أسبوعي للوجبات · توصيل مجاني*
                </>
              )}
            </div>
            <button className={"btn " + (!i ? "accent" : "line")} onClick={() => choose(p.id)}>
              {p.id === "trial" ? "جرّب الآن" : "اختار الباقة"}
            </button>
          </article>
        ))}
      </div>
      <small>* التوصيل المجاني لمناطق مختارة · التعديل وفق سياسة المطعم</small>
    </section>
  );
}
export function AreaPicker({ fees, initial = "", onConfirm }) {
  const [area, set] = React.useState(initial || "");
  const [checked, mark] = React.useState(false);
  return (
    <form
      className="area-form"
      onSubmit={(e) => {
        e.preventDefault();
        mark(true);
        if (Object.hasOwn(fees, area)) onConfirm(area);
      }}
    >
      <label>
        منطقة التوصيل
        <select
          required
          value={area}
          onChange={(e) => {
            set(e.target.value);
            mark(false);
          }}
        >
          <option value="">حدد منطقتك</option>
          {Object.keys(fees).map((a) => (
            <option key={a}>{a}</option>
          ))}
          <option value="other">منطقة أخرى</option>
        </select>
      </label>
      <button className="btn primary">تحقّق من التوصيل</button>
      {checked && area === "other" && (
        <p role="alert" className="error">
          التوصيل غير متاح لهذه المنطقة حالياً. اختار منطقة أخرى أو{" "}
          <a href="#/contact">تواصل معنا</a>.
        </p>
      )}
    </form>
  );
}
const reviews = [
  ["سارة", "الأكل طيب وبحسّه قريب من طبخ البيت. فكرة ترتيب الوجبات بتسهّل يومي."],
  ["أحمد", "عجبني تنوّع الوجبات ووضوح الأسعار. الطلب للدوام صار أسهل."],
  ["لينا", "وجبة مرتبة ومشبعة، والتخطيط للأسبوع بيوفّر علي وقت الاختيار."],
];
export function Homepage({ onAdd, onBuy, choose, fees, area, selectArea }) {
  const [verified, setVerified] = React.useState(false);
  return (
    <>
      <section className="hero">
        <img fetchPriority="high" src={asset("hero.webp")} alt="طبق دجاج مشوي مع أرز وخضار" />
        <h1>طازج. متوازن. صحي.</h1>
        <p>وجبات بيتية طازجة ومتوازنة، جاهزة لدوامك ويومك.</p>
        <div className="hero-actions">
          <a className="btn primary" href="#/menu">
            اطلب وجبة اليوم
          </a>
          <a className="btn secondary" href="#/home/plans">
            استكشف الاشتراكات
          </a>
        </div>
      </section>
      <section className="container section">
        <div className="section-title">
          <h2>منيو اليوم</h2>
          <a href="#/menu">المنيو الكامل ←</a>
        </div>
        <div className="home-meals visual-order">
          {["sayadiya", "biryani", "pasta", "stew"].map((id) => (
            <div key={id} dir="rtl">
              <MealCard meal={mealById(id)} featured onAdd={onAdd} onBuy={onBuy} />
            </div>
          ))}
        </div>
      </section>
      <PlanCards choose={choose} />
      <section id="delivery" className="section delivery">
        <h2>التوصيل لمنطقتك</h2>
        <p className="orange">اختار موقعك وتأكد إذا منطقتك مشمولة بالتوصيل.</p>
        <AreaPicker
          fees={fees}
          initial={area}
          onConfirm={(v) => {
            selectArea(v);
            setVerified(true);
          }}
        />
        {verified && (
          <p role="status">
            منطقتك مشمولة ✓ · {area} · {fees[area] ? money(fees[area]) : "توصيل مجاني"}
          </p>
        )}
      </section>
      <section id="about" className="about">
        <div>
          <h2>عن مطبخنا</h2>
          <p>
            في 93 Kitchen بنحضّر وجبات طازجة ومتوازنة بطابع الأكل البيتي، لتكون وجبتك اليومية أسهل.
          </p>
          <a href="#/about" className="btn secondary">
            عن مطبخنا
          </a>
        </div>
        <img loading="lazy" src={asset("chef.webp")} alt="الشيف أثناء تحضير الوجبات في مطبخنا" />
      </section>
      <section className="container section">
        <h2>آراء الناس وتجاربهم</h2>
        <div className="reviews visual-order">
          {reviews.map(([n, t], i) => (
            <article dir="rtl" className="panel" key={n}>
              <div className="review-person">
                <img loading="lazy" src={asset("review-" + (i + 1) + ".webp")} alt="" />
                <div>
                  <strong>{n}</strong>
                  <div className="stars" aria-label="خمس نجوم">
                    ★★★★★
                  </div>
                </div>
              </div>
              <p>«{t}»</p>
            </article>
          ))}
        </div>
        <small>آراء توضيحية من التصميم.</small>
      </section>
      <section className="container section faq">
        <h2>الأسئلة الشائعة</h2>
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
export function Title({ children, sub = "" }) {
  return (
    <div className="page-title">
      <h1>{children}</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}
export function Empty({ title, link = "/menu", label = "تصفّح المنيو" }) {
  return (
    <section className="empty panel">
      <h2>{title}</h2>
      <a className="btn primary" href={"#" + link}>
        {label}
      </a>
    </section>
  );
}
