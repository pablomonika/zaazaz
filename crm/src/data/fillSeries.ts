/* ═══════════════════════ Fill Series — التعبئة الذكية ═══════════════════════
   🖱️ بحال Google Sheets:
   • نص → كيتكرر
   • رقم واحد → كيتكرر · جوج أرقام (1,2) → سلسلة (3,4,5...)
   • تاريخ → كايتزيد نهار (ولا حسب الفرق لي بينات)
   ═══════════════════════════════════════════════════════════════════════════════ */

const pad = (n: number) => String(n).padStart(2, "0");

const parseDate = (s: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d.getTime();
};

const fmtDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** القيم الجداد بعد سحب الـ Fill Handle */
export function fillSeries(src: string, prev: string | null, count: number, isDate: boolean, isNum: boolean): string[] {
  const out: string[] = [];

  /* 📅 تواريخ: سلسلة بزينة نهار (ولا الفرق بين جوج تواريخ) */
  if (isDate) {
    const t1 = parseDate(src);
    if (t1 !== null) {
      let step = 86400000; // نهار واحد
      const t0 = prev ? parseDate(prev) : null;
      if (t0 !== null) {
        const d = Math.round((t1 - t0) / 86400000);
        if (d !== 0) step = d * 86400000;
      }
      for (let i = 1; i <= count; i++) out.push(fmtDate(t1 + step * i));
      return out;
    }
  }

  /* 🔢 أرقام: إلا كانو جوج أرقام (المصدر + لي فوقو) → سلسلة، وإلا كيتكرر */
  if (isNum) {
    const n1 = Number(src);
    if (src !== "" && isFinite(n1)) {
      const n0 = prev !== null && prev !== "" ? Number(prev) : null;
      if (n0 !== null && isFinite(n0)) {
        const diff = n1 - n0;
        for (let i = 1; i <= count; i++) out.push(String(n1 + diff * i));
        return out;
      }
    }
  }

  /* 📝 نص/Select: تكرار */
  for (let i = 0; i < count; i++) out.push(src);
  return out;
}
