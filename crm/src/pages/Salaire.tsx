import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useAvances, addAvance, delAvance, avanceDate } from "../data/avances";
import Btn from "../components/Btn";
import type { Order } from "../data/orders";

/* ═══════════════════════ Salaire — سالير البنات ═══════════════════════
   💵 الحساب الأوتوماتيك:
   • عادي:  Livrée × 8 DH + UPSEL × 8 DH
   • 151+ :  Livrée × 5 DH + UPSEL × 5 DH + بونص 1000 DH
   (من طلبيات CRM — نفس الداتا، بلا تكرار)
   ═══════════════════════════════════════════════════════════════════════ */

const RATE_NORMAL = 8;
const RATE_BONUS = 5;
const BONUS_THRESHOLD = 151;
const BONUS_AMOUNT = 1000;
const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR");

const AV = ["from-indigo-500 to-violet-600", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-slate-500 to-slate-700"];
const avColor = (n: string) => AV[[...(n || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export default function Salaire() {
  const { orders, agentNames } = useStore();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  const weekStart = (() => { const d = new Date(); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toISOString().slice(0, 10); })();

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  /* 💰 Avances */
  const avances = useAvances();
  const [avAgent, setAvAgent] = useState(agentNames[0] || "");
  const [avAmount, setAvAmount] = useState("");
  const [avNote, setAvNote] = useState("");

  const avancesInRange = useMemo(
    () => avances.filter((a) => (!from || avanceDate(a.at) >= from) && (!to || avanceDate(a.at) <= to))
      .sort((a, b) => b.at.localeCompare(a.at)),
    [avances, from, to],
  );
  const avancesOf = (agent: string) => avancesInRange
    .filter((a) => a.agent.toLowerCase() === agent.toLowerCase())
    .reduce((s, a) => s + a.amount, 0);

  const addAv = () => {
    if (!avAgent || !Number(avAmount)) return alert("اختار البنت واكتب المبلغ");
    addAvance(avAgent, Number(avAmount), avNote);
    setAvAmount(""); setAvNote("");
  };

  const rows = useMemo(() => {
    return agentNames.map((name) => {
      const list = orders.filter((o: Order) =>
        o.agent.toLowerCase() === name.toLowerCase() &&
        (!from || o.dateCreation >= from) && (!to || o.dateCreation <= to));
      const liv = list.filter((o) => o.livraison === "Livrée").length;
      const upsell = list.reduce((s, o) => s + (o.upsell || 0), 0);
      const bonus = liv >= BONUS_THRESHOLD;
      const rate = bonus ? RATE_BONUS : RATE_NORMAL;
      const salaire = liv * rate + upsell * rate + (bonus ? BONUS_AMOUNT : 0);
      const progress = Math.min(100, Math.round((liv / BONUS_THRESHOLD) * 100));
      return { name, total: list.length, liv, upsell, bonus, rate, salaire, progress };
    }).sort((a, b) => b.salaire - a.salaire);
  }, [orders, agentNames, from, to]);

  const totals = useMemo(() => ({
    salaires: rows.reduce((s, r) => s + r.salaire, 0),
    liv: rows.reduce((s, r) => s + r.liv, 0),
    upsell: rows.reduce((s, r) => s + r.upsell, 0),
    withBonus: rows.filter((r) => r.bonus).length,
    avances: avancesInRange.reduce((s, a) => s + a.amount, 0),
  }), [rows, avancesInRange]);

  const th = "border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap";

  return (
    <div dir="rtl" className="h-full overflow-auto bg-slate-50 p-4 text-sm">
      <div className="mx-auto max-w-5xl">

        {/* ── الرأس ── */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl text-white shadow-md shadow-emerald-200">💵</span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">Salaire — سالير الفريق</h1>
            <p className="text-[11px] text-slate-500">Livrée × 8 DH + UPSEL × 8 DH · من 151 Livrée: × 5 DH + بونص 1000 DH — محسوب أوتوماتيك من طلبيات CRM</p>
          </div>
          <span className="ms-auto rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">{rows.length} بنات</span>
        </div>

        {/* ── KPI ── */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { icon: "💰", label: "مجموع الساليرات", v: `${fmt(totals.salaires)} DH`, c: "#059669", bg: "#d1fae5" },
            { icon: "📦", label: "مجموع Livrée", v: fmt(totals.liv), c: "#2563eb", bg: "#dbeafe" },
            { icon: "⬆️", label: "مجموع UPSEL", v: fmt(totals.upsell), c: "#7c3aed", bg: "#ede9fe" },
            { icon: "🏆", label: "وصلو 151+ (بونص)", v: `${totals.withBonus}`, c: "#b45309", bg: "#fef3c7" },
            { icon: "💰", label: "مجموع Avances", v: `${fmt(totals.avances)} DH`, c: "#dc2626", bg: "#fee2e2" },
            { icon: "🧾", label: "المتبقي الصافي (Net)", v: `${fmt(totals.salaires - totals.avances)} DH`, c: "#0f766e", bg: "#ccfbf1" },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: k.bg, color: k.c }}>{k.icon}</span>
              <div className="min-w-0">
                <div className="truncate text-lg font-extrabold leading-none" style={{ color: k.c }}>{k.v}</div>
                <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── فلاتر التاريخ ── */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {([
            ["today", "اليوم"], ["week", "هاد الأسبوع"], ["month", "هاد الشهر"], ["last30", "آخر 30 يوم"], ["all", "الكل"],
          ] as const).map(([k, label]) => {
            const active = (k === "today" && from === today && to === today)
              || (k === "week" && from === weekStart && to === today)
              || (k === "month" && from === monthStart && to === today)
              || (k === "all" && !from && !to)
              || (k === "last30" && from === new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10) && to === today);
            return (
              <button key={k} onClick={() => {
                if (k === "today") { setFrom(today); setTo(today); }
                else if (k === "week") { setFrom(weekStart); setTo(today); }
                else if (k === "month") { setFrom(monthStart); setTo(today); }
                else if (k === "last30") { setFrom(new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)); setTo(today); }
                else { setFrom(""); setTo(""); }
              }} className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${active ? "bg-emerald-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {label}
              </button>
            );
          })}
          <span className="h-6 w-px bg-slate-200" />
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-emerald-400" /> من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-teal-400" /> إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <span className="ms-auto text-[10px] font-bold text-slate-400">⚡ من نفس داتا COMONDES — بلا حفظ جديد</span>
        </div>

        {/* ── الجدول ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={th + " text-start"}>#</th>
                  <th className={th + " text-start"}>البنت</th>
                  <th className={th + " text-center"}>الطلبيات</th>
                  <th className={th + " text-center"}>Livrée</th>
                  <th className={th + " text-center"}>UPSEL</th>
                  <th className={th + " text-center"}>السعر/وحدة</th>
                  <th className={th + " text-center"}>التقدم نحو 151</th>
                  <th className={th + " text-center"}>البونص</th>
                  <th className={th + " text-center"}>Salaire</th>
                  <th className={th + " text-center"}>Avance 💰</th>
                  <th className={th + " text-center"}>Net à payer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.name} className={`border-b border-slate-50 transition hover:bg-emerald-50/30 ${r.bonus ? "bg-amber-50/40" : ""}`}>
                    <td className="px-3 py-2.5 text-center text-[10px] font-bold text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-extrabold text-white shadow-sm ${avColor(r.name)}`}>
                          {r.name.charAt(0).toUpperCase()}
                        </span>
                        <b className="text-xs font-extrabold text-slate-800">{r.name}</b>
                        {r.bonus && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-700">🏆 151+</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold text-slate-500">{r.total}</td>
                    <td className="px-3 py-2.5 text-center"><span className="rounded-lg bg-emerald-50 px-2 py-1 text-sm font-extrabold text-emerald-700">{r.liv}</span></td>
                    <td className="px-3 py-2.5 text-center"><span className="rounded-lg bg-violet-50 px-2 py-1 text-sm font-extrabold text-violet-700">{r.upsell}</span></td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${r.bonus ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{r.rate} DH</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="min-w-28">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${r.bonus ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${r.progress}%` }} />
                        </div>
                        <span className="mt-0.5 block text-[9px] font-bold text-slate-400">{r.liv} / {BONUS_THRESHOLD}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-extrabold text-amber-600">{r.bonus ? `+${BONUS_AMOUNT} DH` : "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-3 py-1.5 text-sm font-extrabold text-white shadow-md shadow-emerald-200">{fmt(r.salaire)} DH</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {avancesOf(r.name) > 0
                        ? <span className="rounded-lg bg-red-50 px-2 py-1 text-xs font-extrabold text-red-600">− {fmt(avancesOf(r.name))} DH</span>
                        : <span className="text-[10px] text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-block rounded-xl bg-gradient-to-b from-slate-700 to-slate-900 px-3 py-1.5 text-sm font-extrabold text-white shadow-md">{fmt(r.salaire - avancesOf(r.name))} DH</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-extrabold">
                    <td className="px-3 py-3" colSpan={2}>المجموع الكلي</td>
                    <td className="px-3 py-3 text-center text-emerald-700">{fmt(totals.liv)}</td>
                    <td className="px-3 py-3 text-center text-violet-700">{fmt(totals.upsell)}</td>
                    <td className="px-3 py-3 text-center text-amber-600">{totals.withBonus ? `×${totals.withBonus}` : "—"}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block rounded-xl bg-slate-800 px-3 py-1.5 text-sm text-white">{fmt(totals.salaires)} DH</span>
                    </td>
                    <td className="px-3 py-3 text-center text-red-600">− {fmt(totals.avances)} DH</td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-white">{fmt(totals.salaires - totals.avances)} DH</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!rows.length && (
            <div className="p-10 text-center">
              <div className="mb-2 text-4xl">💵</div>
              <p className="text-xs font-bold text-slate-500">ما كاين حتى بنت — زيد البنات من Work Team</p>
            </div>
          )}
        </div>

        {/* ═══ 💰 Avances — تسبيقات السالير ═══ */}
        <div className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 bg-gradient-to-l from-rose-500 to-red-500 px-4 py-3 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-base">💰</span>
            <b className="text-sm font-extrabold">Avances — تسبيقات السالير</b>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">{avancesInRange.length} تسبيق</span>
            <span className="ms-auto rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-bold">المجموع: {fmt(totals.avances)} DH</span>
          </div>

          {/* فورم الإضافة */}
          <div className="grid gap-2 border-b border-slate-100 bg-red-50/50 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-bold text-slate-500">👩 البنت
              <select value={avAgent} onChange={(e) => setAvAgent(e.target.value)}
                className="mt-0.5 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-2.5 py-[7px] text-xs font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100">
                {agentNames.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-500">💵 المبلغ (DH)
              <input type="number" value={avAmount} onChange={(e) => setAvAmount(e.target.value)} placeholder="200"
                className="mt-0.5 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-[7px] text-xs font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
            </label>
            <label className="text-[10px] font-bold text-slate-500">📝 ملاحظة (اختياري)
              <input value={avNote} onChange={(e) => setAvNote(e.target.value)} placeholder="سبب التسبيق..."
                className="mt-0.5 w-full rounded-xl border border-slate-300 bg-white px-2.5 py-[7px] text-xs font-semibold outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" />
            </label>
            <div className="flex items-end">
              <Btn icon="＋" color="red" className="w-full justify-center" onClick={addAv}>سجل Avance</Btn>
            </div>
          </div>

          {/* الجدول */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={th + " text-start"}>التاريخ</th>
                  <th className={th + " text-start"}>البنت</th>
                  <th className={th + " text-center"}>المبلغ</th>
                  <th className={th + " text-start"}>ملاحظة</th>
                  <th className={th} style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {avancesInRange.map((a) => (
                  <tr key={a.id} className="border-b border-slate-50 transition hover:bg-red-50/30">
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-500">{avanceDate(a.at)}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700">{a.agent}</span>
                    </td>
                    <td className="px-3 py-2 text-center"><b className="rounded-lg bg-red-50 px-2 py-1 text-sm font-extrabold text-red-600">{fmt(a.amount)} DH</b></td>
                    <td className="max-w-52 truncate px-3 py-2 text-slate-500" title={a.note}>{a.note || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => confirm(`مسح تسبيق ${a.amount} DH ديال ${a.agent}؟`) && delAvance(a.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!avancesInRange.length && (
              <div className="p-8 text-center">
                <div className="mb-2 text-3xl">💰</div>
                <p className="text-xs font-bold text-slate-500">ما كاين حتى تسبيق فهاد الفترة</p>
                <p className="mt-1 text-[11px] text-slate-400">ملي شي بنت تطلب Avance — سجلو من الفورم لي فوق</p>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">
          💡 المعادلة: Livrée × 8 + UPSEL × 8 · إلا وصلات <b>151 Livrée</b> → Livrée × 5 + UPSEL × 5 + <b>1000 DH</b> بونص
        </p>
      </div>
    </div>
  );
}
