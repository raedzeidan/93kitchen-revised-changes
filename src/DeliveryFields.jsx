import React, { useState } from "react";
import { districts } from "../public/delivery.js";

export function DeliveryFields({ fees, value, onChange }) {
  const custom = Object.keys(fees).filter(name => !Object.values(districts).some(list => list.includes(name)));
  const groups = custom.length ? { ...districts, "مناطق إضافية": custom } : districts;
  const [province, setProvince] = useState(() => Object.keys(groups).find(key => groups[key].includes(value)) || "");
  return <>
    <label>المحافظة
      <select required value={province} onChange={e => { setProvince(e.target.value); onChange(""); }}>
        <option value="">اختار المحافظة</option>
        {Object.keys(groups).map(key => <option key={key}>{key}</option>)}
      </select>
    </label>
    <label>منطقة التوصيل
      <select required disabled={!province} value={value} onChange={e => onChange(e.target.value)}>
        <option value="">اختار المنطقة</option>
        {(groups[province] || []).map(name => <option key={name}>{name}</option>)}
      </select>
    </label>
    {value && fees[value] === null && <small>يتأكّد المطعم من التغطية ورسوم التوصيل قبل الدفع. اكتب اسم الحي والشارع في عنوان الطلب.</small>}
  </>;
}
