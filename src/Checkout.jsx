import React, { useState } from "react";
import { weekdays, meals, planById, mealById, eligible, money } from "../public/catalog.js";
import { go, icon, Modal, Title, dishPhoto, AreaPicker } from "./ui.jsx";

export function Planner({ draft, setDraft, fees, next, editing = false }) {
  const plan = planById(draft.plan);
  const [week, weekSet] = useState(0),
    [day, daySet] = useState(null),
    [pick, setPick] = useState(null),
    [zones, showZones] = useState(!draft.contact.area),
    [message, msg] = useState("");
  const rows = draft.schedule;
  const weeks = Math.ceil(plan.count / 5);
  const selected = rows.filter((r) => r.meal).length;
  const updateRows = (schedule) => setDraft({ ...draft, schedule });
  const open = (i) => {
    daySet(i);
    setPick({ ...rows[i] });
  };
  function advance() {
    if (!draft.contact.area) {
      showZones(true);
      return;
    }
    const first = rows.findIndex((r) => !r.meal);
    if (first >= 0) {
      weekSet(Math.floor(first / 5));
      msg("اختار وجبة لكل يوم قبل المتابعة.");
      open(first);
      return;
    }
    next();
  }
  return (
    <div className="container page">
      <Title sub="اختار وجباتك لكل يوم، واحفظ جدولك قبل المتابعة.">
        {editing ? "تعديل جدول اشتراكك" : "رتّب وجبات اشتراكك"}
      </Title>
      <div className="toolbar">
        <b>
          {plan.name} · {plan.count} وجبة
        </b>
        <button disabled={editing} className="text-action" onClick={() => showZones(true)}>
          {icon("pin", 18)} {draft.contact.area || "حدد منطقة التوصيل"}
          {editing ? "" : " · تغيير المنطقة"}
        </button>
      </div>
      <div className="tabs">
        {Array.from({ length: weeks }, (_, i) => (
          <button
            className={i === week ? "active" : ""}
            aria-pressed={i === week}
            onClick={() => weekSet(i)}
            key={i}
          >
            الأسبوع {["الأول", "الثاني", "الثالث", "الرابع"][i]}
          </button>
        ))}
      </div>
      <div className="split">
        <section>
          <div className="row">
            <h2>وجبات الأسبوع {week + 1}</h2>
            <span>
              {rows.slice(week * 5, week * 5 + 5).filter((r) => r.meal).length} وجبات محددة
            </span>
          </div>
          <div className="stack">
            {rows.slice(week * 5, week * 5 + 5).map((r, j) => {
              const m = mealById(r.meal);
              return (
                <article key={j} className="day-card panel">
                  <div>
                    <b>{weekdays[j]}</b>
                    <small>{m ? "تم الاختيار ✓" : "بانتظار الاختيار"}</small>
                  </div>
                  {m ? (
                    <img src={dishPhoto(m.id)} alt="" />
                  ) : (
                    <div className="day-empty">{icon("add-cart", 25)}</div>
                  )}
                  <div className="grow">
                    <h3>{m?.name || "اختر وجبة اليوم"}</h3>
                    <p>{r.date ? "تاريخ التوصيل: " + r.date : "ضمن الاشتراك · وجبة فردية"}</p>
                    {r.note && <small>{r.note}</small>}
                  </div>
                  <div>
                    <button className="btn line" onClick={() => open(week * 5 + j)}>
                      {m ? "تغيير الوجبة" : "اختيار الوجبة"}
                    </button>
                    <button className="text-action" onClick={() => open(week * 5 + j)}>
                      تأجيل أو إضافة ملاحظة
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="panel summary">
          <h2>ملخص الاشتراك</h2>
          <p>
            {plan.name} · {plan.count} وجبة
          </p>
          <dl>
            <dt>تم اختيارها</dt>
            <dd>{selected}</dd>
            <dt>متبقية</dt>
            <dd>{plan.count - selected}</dd>
            <dt>قيمة الباقة</dt>
            <dd>{money(plan.price)}</dd>
          </dl>
          <progress value={selected} max={plan.count} />
          <small>يمكن تعديل اختيارك قبل موعد التحضير.</small>
        </aside>
      </div>
      {message && <p role="status">{message}</p>}
      <div className="action-bar">
        {week < weeks - 1 && (
          <>
            <button
              className="btn line"
              onClick={() => {
                const copy = rows.map((r) => ({ ...r }));
                rows
                  .slice(week * 5, week * 5 + 5)
                  .forEach((r, i) => (copy[(week + 1) * 5 + i] = { ...r, date: "" }));
                updateRows(copy);
                weekSet(week + 1);
                msg("تم نسخ الأسبوع.");
              }}
            >
              نسخ الأسبوع للتالي
            </button>
            <button
              className="btn primary"
              onClick={() => {
                weekSet(week + 1);
                msg("تم حفظ الأسبوع.");
              }}
            >
              حفظ الأسبوع والمتابعة
            </button>
          </>
        )}
        <button className="btn primary" onClick={advance}>
          {editing ? "حفظ التعديلات" : "مراجعة الجدول والمتابعة"}
        </button>
      </div>
      {zones && (
        <Modal
          title="تأكّد من التوصيل لمنطقتك"
          close={() => {
            if (draft.contact.area) showZones(false);
            else go("/home/plans");
          }}
        >
          <p>قبل ما ترتّب وجبات اشتراكك، خلينا نتأكد إن منطقتك مشمولة بالتوصيل.</p>
          <AreaPicker
            fees={fees}
            initial={draft.contact.area}
            onConfirm={(area) => {
              setDraft({ ...draft, contact: { ...draft.contact, area } });
              showZones(false);
            }}
          />
        </Modal>
      )}
      {day !== null && (
        <Modal title={"وجبة " + weekdays[day % 5]} close={() => daySet(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              updateRows(rows.map((r, i) => (i === day ? pick : r)));
              daySet(null);
            }}
          >
            <label>
              اختار الوجبة
              <select
                required
                value={pick.meal}
                onChange={(e) => setPick({ ...pick, meal: e.target.value })}
              >
                <option value="">حدد وجبة</option>
                {meals
                  .filter((m) => eligible(plan, m))
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              تاريخ بديل للتوصيل (اختياري)
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={pick.date}
                onChange={(e) => setPick({ ...pick, date: e.target.value })}
              />
            </label>
            <label>
              ملاحظة للمطبخ
              <textarea
                maxLength={250}
                value={pick.note}
                onChange={(e) => setPick({ ...pick, note: e.target.value })}
              />
            </label>
            <button className="btn primary">حفظ الوجبة</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
export function Totals({ draft, cart, fees }) {
  const p = planById(draft.plan),
    isPlan = draft.kind === "subscription",
    sum = isPlan
      ? p.price
      : Object.entries(cart).reduce((s, [id, q]) => s + mealById(id).price * q, 0),
    fee = fees[draft.contact.area];
  return (
    <aside className="panel summary">
      <h2>{isPlan ? "ملخص الاشتراك" : "ملخص الطلب"}</h2>
      {isPlan ? (
        <>
          <h3>{p.name}</h3>
          <p>
            {p.count} وجبة · {p.count === 3 ? "باقة تجربة" : "4 أسابيع"}
          </p>
        </>
      ) : (
        Object.entries(cart).map(([id, qty]) => (
          <div className="cost-row" key={id}>
            <span>
              {mealById(id).name} × {qty}
            </span>
            <b>{money(qty * mealById(id).price)}</b>
          </div>
        ))
      )}
      <dl>
        <dt>منطقة التوصيل</dt>
        <dd>{draft.contact.area || "لم تُحدّد"}</dd>
        <dt>{isPlan ? "قيمة الباقة" : "قيمة الوجبات"}</dt>
        <dd>{money(sum)}</dd>
        <dt>رسوم التوصيل</dt>
        <dd>{fee === undefined ? "بعد اختيار المنطقة" : money(fee)}</dd>
      </dl>
      <div className="total">
        <span>الإجمالي</span>
        <strong>{money(sum + (fee || 0))}</strong>
      </div>
    </aside>
  );
}
export function Identity({ draft, cart, fees, onLogin }) {
  return (
    <div className="container page">
      <Title sub="اختر طريقة المتابعة قبل الدفع.">كيف تحب تكمّل؟</Title>
      <div className="split">
        <section className="panel">
          <h2>بيانات {draft.kind === "meal" ? "الطلب" : "الاشتراك"}</h2>
          <button className="choice" onClick={onLogin}>
            <strong>عندي حساب</strong>
            <small>استخدم بياناتك المحفوظة لتسريع الطلب</small>
          </button>
          <button className="choice" onClick={() => go("/details")}>
            <strong>المتابعة كضيف</strong>
            <small>بدون إنشاء حساب</small>
          </button>
        </section>
        <Totals {...{ draft, cart, fees }} />
      </div>
    </div>
  );
}
export function ContactFields({ initial, fees, submit, button = "متابعة", busy = false }) {
  const [f, set] = useState(initial);
  const props = (key) => ({
    value: f[key] || "",
    onChange: (e) => set({ ...f, [key]: e.target.value }),
  });
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(f);
      }}
    >
      <label>
        الاسم الكامل *<input required autoComplete="name" maxLength={120} {...props("name")} />
      </label>
      <label>
        رقم الهاتف *
        <input
          required
          dir="ltr"
          type="tel"
          autoComplete="tel"
          minLength={7}
          maxLength={22}
          {...props("phone")}
        />
      </label>
      <label>
        منطقة التوصيل *
        <select required {...props("area")}>
          <option value="">حدد منطقتك</option>
          {Object.keys(fees).map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label>
        عنوان التوصيل *
        <input
          required
          maxLength={400}
          autoComplete="street-address"
          placeholder="الشارع، رقم المبنى، علامة قريبة"
          {...props("address")}
        />
      </label>
      <label>
        البريد الإلكتروني (اختياري)
        <input type="email" autoComplete="email" dir="ltr" {...props("email")} />
      </label>
      <button className="btn primary" disabled={busy}>
        {button}
      </button>
    </form>
  );
}
export function Details({ draft, cart, fees, save }) {
  return (
    <div className="container page">
      <Title sub="املأ البيانات الأساسية لإكمال الطلب.">بيانات التوصيل</Title>
      <div className="split">
        <section className="panel">
          <h2>معلوماتك الأساسية</h2>
          <ContactFields
            initial={draft.contact}
            fees={fees}
            submit={save}
            button="متابعة إلى المراجعة"
          />
        </section>
        <Totals {...{ draft, cart, fees }} />
      </div>
    </div>
  );
}
export function Review({ draft, setDraft, cart, fees, send, busy, error }) {
  const sub = draft.kind === "subscription";
  return (
    <div className="container page">
      <Title sub="تأكد من بياناتك وطريقة الدفع قبل الإرسال.">
        {sub ? "مراجعة الاشتراك والدفع" : "مراجعة الطلب والدفع"}
      </Title>
      <div className="split">
        <div className="stack">
          {sub && (
            <section className="panel">
              <div className="row">
                <h2>الوجبات المختارة</h2>
                <a href="#/planner">تعديل الجدول</a>
              </div>
              {Array.from({ length: Math.ceil(draft.schedule.length / 5) }, (_, w) => (
                <details key={w}>
                  <summary>
                    الأسبوع {w + 1} · {draft.schedule.slice(w * 5, w * 5 + 5).length} وجبات
                  </summary>
                  {draft.schedule.slice(w * 5, w * 5 + 5).map((r, i) => (
                    <p key={i}>
                      {weekdays[i]} · {mealById(r.meal)?.name} {r.date} {r.note}
                    </p>
                  ))}
                </details>
              ))}
            </section>
          )}
          <section className="panel">
            <div className="row">
              <h2>عنوان التوصيل</h2>
              <a href="#/details">تعديل البيانات</a>
            </div>
            <p>
              {draft.contact.name} · <bdi>{draft.contact.phone}</bdi>
            </p>
            <p>
              {draft.contact.area} · {draft.contact.address}
            </p>
          </section>
          <section className="panel">
            <h2>طريقة الدفع</h2>
            {[
              ["cliq", "تحويل CliQ", "تحويل بنكي سريع ومراجعة إشعار الدفع", "bank"],
              [
                "restaurant",
                "الدفع داخل المطعم",
                "رقم مرجعي ورمز QR لإظهار الطلب عند الكاشير",
                "restaurant",
              ],
            ].map(([v, t, d, i]) => (
              <label key={v} className={"pay-option " + (draft.payment === v ? "selected" : "")}>
                {icon(i)}
                <span>
                  <strong>{t}</strong>
                  <small>{d}</small>
                </span>
                <input
                  type="radio"
                  name="payment"
                  value={v}
                  checked={draft.payment === v}
                  onChange={() => setDraft({ ...draft, payment: v })}
                />
              </label>
            ))}
          </section>
        </div>
        <div className="stack">
          <Totals {...{ draft, cart, fees }} />
          <div className="panel">
            <label className="check">
              <input
                type="checkbox"
                checked={draft.terms}
                onChange={(e) => setDraft({ ...draft, terms: e.target.checked })}
              />{" "}
              أوافق على <a href="#/policy/terms">شروط الطلب</a>
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button disabled={!draft.terms || busy} className="btn primary full" onClick={send}>
              {busy ? "جارٍ الإرسال…" : sub ? "تأكيد الاشتراك" : "تأكيد الطلب"}
            </button>
            <small>يبدأ التحضير بعد تأكيد استلام الدفع.</small>
          </div>
        </div>
      </div>
    </div>
  );
}
