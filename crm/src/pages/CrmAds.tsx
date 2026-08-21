import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useSpends, addSpend, delSpend } from "../data/adspend";
import { ORIGIN_OPTIONS, type Order } from "../data/orders";
import Btn from "../components/Btn";

/* ═══════════════════════ CRM — تكاليف الإعلانات ═══════════════════════
   💸 دخل المصروف → السيستم كايحسب الكوست لكل طلبية أوتوماتيك
   كوست الطلبية = المصروف ÷ عدد طلبيات البنت فـ نفس النهار + نفس المنتوج
   ═════════════════════════════════════════════════════════════════════════ */

const fmt2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export default function CrmAds() {
  const { orders, agentNames } = useStore();
  const spends = useSpends();

  const today = new Date().toISOString().slice(0, 10);
  const weekStart = (() => { const d = new Date(); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toISOString().slice(0, 10); })();

  const [from, setFrom] = useState(weekStart);
  const [to, setTo] = useState(today);
  const [who, setWho] = useState("all");

  /* ── فورم الإضافة ── */
  const [nDate, setNDate] = useState(today);
  const [nAgent, setNAgent] = useState(agentNames[0] || "");
  const [nProduit, setNProduit] = useState("");
  const [nSource, setNSource] = useState("Leader");
  const [nAmount, setNAmount] = useState("");

  /* المنتوجات المستعملة فـ الطلبيات (datalist) */
  const products = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o: Order) => { if (o.produit) m.set(o.produit, (m.get(o.produit) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);

  /* عدد الطلبيات ديال بنت فـ نهار (+ منتوج) */
  const ordersCount = (agent: string, date: string, produit: string) =>
    orders.filter((o: Order) =>
      o.agent.toLowerCase() === agent.toLowerCase() &&
      o.dateCreation === date &&
      (!produit || o.produit.trim().toLowerCase() === produit.trim().toLowerCase()),
    );

  const add = () => {
    const amt = Number(nAmount);
    if (!nAgent || !nDate || !amt) return alert("عمّر: التاريخ + البنت + المبلغ");
    addSpend(nDate, nAgent, nProduit, nSource, amt);
    setNAmount(""); setNProduit("");
  };

  /* ── التصفية ── */
  const filtered = useMemo(() => spends
    .filter((s) => (!from || s.date >= from) && (!to || s.date <= to))
    .filter((s) => who === "all" || s.agent === who)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id),
    [spends, from, to, who]);

  /* كل صف = حساباتو */
  const rows = useMemo(() => filtered.map((s) => {
    const list = ordersCount(s.agent, s.date, s.produit);
    const count = list.length;
    const livre = list.filter((o) => o.livraison === "Livrée").length;
    const conf = list.filter((o) => o.statut === "Confirmé").length;
    const cost = count > 0 ? s.amount / count : null;
    return { ...s, count, livre, conf, cost };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [filtered, orders]);

  /* ── ملخص البنات ── */
  const perGirl = useMemo(() => {
    const m = new Map<string, { spent: number; count: number }>();
    rows.forEach((r) => {
      const e = m.get(r.agent) || { spent: 0, count: 0 };
      e.spent += r.amount;
      e.count += r.count;
      m.set(r.agent, e);
    });
    return [...m.entries()].map(([girl, v]) => ({ girl, ...v, cost: v.count ? v.spent / v.count : null }));
  }, [rows]);

  const totalSpent = rows.reduce((s, r) => s + r.amount, 0);
  const totalOrders = rows.reduce((s, r) => s + r.count, 0);
  const avgCost = totalOrders ? totalSpent / totalOrders : 0;

  const sel = "rounded-xl border border-slate-300 bg-white px-2.5 py-[7px] text-xs font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div dir="rtl" className="h-full overflow-auto bg-slate-50 p-4 text-sm">
      <div className="mx-auto max-w-6xl">

        {/* ── الرأس ── */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-xl text-white shadow-md shadow-violet-200">💸</span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">CRM — تكاليف الإعلانات</h1>
            <p className="text-[11px] text-slate-500">دخل المصروف → الكوست لكل طلبية كايتحسب أوتوماتيك (المصروف ÷ الطلبيات ديال نفس النهار)</p>
          </div>
          <span className="ms-auto rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold text-violet-700">{rows.length} عمليات</span>
        </div>

        {/* ── KPI ── */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: "💵", label: "إجمالي المصروف (الفترة)", v: `${fmt2(totalSpent)} DH`, c: "#7c3aed", bg: "#ede9fe" },
            { icon: "🛒", label: "الطلبيات المغطاة", v: `${totalOrders}`, c: "#2563eb", bg: "#dbeafe" },
            { icon: "📊", label: "متوسط كوست الطلبية", v: totalOrders ? `${fmt2(avgCost)} DH` : "—", c: "#059669", bg: "#d1fae5" },
            { icon: "👩", label: "بنات عندهم صرف", v: `${perGirl.length}`, c: "#b45309", bg: "#fef3c7" },
          ].map((k) => (
            <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: k.bg, color: k.c }}>{k.icon}</span>
              <div className="min-w-0">
                <div className="text-lg font-extrabold leading-none" style={{ color: k.c }}>{k.v}</div>
                <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{k.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── فورم الإضافة ── */}
        <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5 shadow-sm">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-base text-violet-600 shadow-sm">＋</span>
            <b className="text-sm font-extrabold text-slate-800">إضافة مصروف جديد</b>
            <span className="text-[10px] font-semibold text-violet-500">— حنا كانزيدو غير اللي تصرف، والباقي أوتوماتيك ⚡</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <label className="text-[10px] font-bold text-slate-500">📅 التاريخ
              <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} className={sel + " mt-0.5 w-full"} />
            </label>
            <label className="text-[10px] font-bold text-slate-500">👩 البنت
              <select value={nAgent} onChange={(e) => setNAgent(e.target.value)} className={sel + " mt-0.5 w-full cursor-pointer"}>
                {agentNames.map((a) => <option key={a}>{a}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-500">📦 المنتوج
              <input list="ads-products" value={nProduit} onChange={(e) => setNProduit(e.target.value)} placeholder="نظارة القراءة..." className={sel + " mt-0.5 w-full"} />
            </label>
            <label className="text-[10px] font-bold text-slate-500">📣 المصدر
              <select value={nSource} onChange={(e) => setNSource(e.target.value)} className={sel + " mt-0.5 w-full cursor-pointer"}>
                {ORIGIN_OPTIONS.filter((x) => x).map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-500">💵 المبلغ (DH)
              <input type="number" step="0.01" value={nAmount} onChange={(e) => setNAmount(e.target.value)} placeholder="200" className={sel + " mt-0.5 w-full"} />
            </label>
            <div className="flex items-end">
              <Btn icon="＋" color="violet" className="w-full justify-center" onClick={add}>إضافة</Btn>
            </div>
          </div>
          <datalist id="ads-products">
            {products.map(([p]) => <option key={p} value={p} />)}
          </datalist>
        </div>

        {/* ── الفلاتر ── */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {([["today", "اليوم"], ["week", "هاد الأسبوع"], ["last7", "آخر 7 أيام"], ["all", "الكل"]] as const).map(([k, label]) => {
            const active = (k === "today" && from === today && to === today)
              || (k === "week" && from === weekStart && to === today)
              || (k === "all" && !from && !to)
              || (k === "last7" && from === new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10) && to === today);
            return (
              <button key={k} onClick={() => {
                if (k === "today") { setFrom(today); setTo(today); }
                else if (k === "week") { setFrom(weekStart); setTo(today); }
                else if (k === "last7") { setFrom(new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)); setTo(today); }
                else { setFrom(""); setTo(""); }
              }} className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${active ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {label}
              </button>
            );
          })}
          <span className="h-6 w-px bg-slate-200" />
          <select value={who} onChange={(e) => setWho(e.target.value)} className={sel + " cursor-pointer"}>
            <option value="all">👩 كل البنات</option>
            {agentNames.map((a) => <option key={a}>{a}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-violet-400" /> من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-purple-400" /> إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} />
          </label>
        </div>

        {/* ── الجدول الرئيسي ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50 text-sm text-violet-600">📋</span>
            <b className="text-xs font-extrabold text-slate-700">جدول التكاليف</b>
            <span className="ms-auto text-[10px] text-slate-400">⚡ الطلبيات والكوست محسوبين أوتوماتيك من طلبيات نفس النهار</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-start">التاريخ</th>
                  <th className="px-3 py-2 text-start">البنت</th>
                  <th className="px-3 py-2 text-start">المنتوج</th>
                  <th className="px-3 py-2 text-center">المصدر</th>
                  <th className="px-3 py-2 text-center">المصروف</th>
                  <th className="px-3 py-2 text-center">طلبيات</th>
                  <th className="px-3 py-2 text-center">Confirmé</th>
                  <th className="px-3 py-2 text-center">Livrée</th>
                  <th className="px-3 py-2 text-center">كوست الطلبية</th>
                  <th className="px-3 py-2 text-center" style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 transition hover:bg-violet-50/30">
                    <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-600">{r.date}</td>
                    <td className="px-3 py-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700">{r.agent}</span></td>
                    <td className="max-w-44 truncate px-3 py-2 font-semibold text-slate-700" title={r.produit}>{r.produit || "— كل المنتوجات —"}</td>
                    <td className="px-3 py-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{r.source || "—"}</span></td>
                    <td className="px-3 py-2 text-center text-sm font-extrabold text-red-600">{fmt2(r.amount)} DH</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-lg px-2 py-1 text-sm font-extrabold ${r.count ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-600"}`}>{r.count}</span>
                    </td>
                    <td className="px-3 py-2 text-center font-bold text-blue-600">{r.conf || "—"}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{r.livre || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      {r.cost !== null ? (
                        <span className={`rounded-lg px-2 py-1 text-sm font-extrabold ${r.cost <= 2 ? "bg-emerald-100 text-emerald-700" : r.cost <= 4 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {fmt2(r.cost)} DH
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-400" title="ما لقيناش طلبيات لهاد البنت فهاد النهار/المنتوج">بلا طلبيات!</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => confirm(`مسح مصروف ${r.agent} — ${r.amount} DH؟`) && delSpend(r.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600" title="مسح">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="p-10 text-center">
                <div className="mb-2 text-4xl">💸</div>
                <p className="text-sm font-bold text-slate-500">ما كاين حتى مصروف فهاد الفترة</p>
                <p className="mt-1 text-xs text-slate-400">زيد أول واحد من الفورم لي فوق — مثال: مريم + نظارة القراءة + Leader + 200 DH</p>
              </div>
            )}
          </div>
        </div>

        {/* ── ملخص البنات ── */}
        {perGirl.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-sm text-amber-600">👑</span>
              <b className="text-xs font-extrabold text-slate-700">ملخص البنات (الفترة المختارة)</b>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 text-start">البنت</th>
                    <th className="px-3 py-2 text-center">إجمالي المصروف</th>
                    <th className="px-3 py-2 text-center">الطلبيات</th>
                    <th className="px-3 py-2 text-center">كوست الطلبية</th>
                  </tr>
                </thead>
                <tbody>
                  {perGirl.sort((a, b) => b.spent - a.spent).map((g) => (
                    <tr key={g.girl} className="border-b border-slate-50 hover:bg-amber-50/30">
                      <td className="px-3 py-2"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-700">{g.girl}</span></td>
                      <td className="px-3 py-2 text-center text-sm font-extrabold text-red-600">{fmt2(g.spent)} DH</td>
                      <td className="px-3 py-2 text-center text-sm font-extrabold text-blue-700">{g.count}</td>
                      <td className="px-3 py-2 text-center text-sm font-extrabold text-emerald-700">{g.cost !== null ? `${fmt2(g.cost)} DH` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
