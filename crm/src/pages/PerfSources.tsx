import { useMemo, useState } from "react";
import { useStore } from "../store";
import { usePerfRows, addPerfRow, updPerfRow, delPerfRow, PERF_SOURCES, type PerfRow } from "../data/perfrows";
import { useSpends } from "../data/adspend";
import type { Order } from "../data/orders";
import Btn from "../components/Btn";
import { SHEETS } from "../data/sheets";
import { normalizeCity } from "../data/villes";

/* ═══════════════════════ Dashboard performance ═══════════════════════
   📊 5 جداول (Leader · WhatsApp · Facebook · TikTok · Google) + غلوبال
   كانحطو غير: المنتوج + التاريخ + PRIX DE VENTE → الباقي أوتوماتيك
   (cost per lead كايجي من صفحة 💸 CRM — المصروفات)
   ═══════════════════════════════════════════════════════════════════════ */

/* ألوان المصادر — نفس هوية تبويبات المينو الرئيسي بالضبط */
const SRC_STYLES: Record<string, { base: string; on: string }> = {
  Leader: {
    base: "border-violet-500 bg-gradient-to-b from-violet-400 to-violet-600 text-white shadow-sm shadow-violet-200/60 hover:from-violet-500 hover:to-violet-700",
    on: "border-violet-700 bg-gradient-to-b from-violet-600 to-violet-800 text-white shadow-md ring-2 ring-violet-300/70",
  },
  whatssap: {
    base: "border-emerald-500 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-200/60 hover:from-emerald-500 hover:to-emerald-700",
    on: "border-emerald-700 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white shadow-md ring-2 ring-emerald-300/70",
  },
  Facebook: {
    base: "border-blue-500 bg-gradient-to-b from-blue-400 to-blue-600 text-white shadow-sm shadow-blue-200/60 hover:from-blue-500 hover:to-blue-700",
    on: "border-blue-700 bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-md ring-2 ring-blue-300/70",
  },
  TikTok: {
    base: "border-slate-400 bg-gradient-to-b from-slate-400 to-slate-600 text-white shadow-sm hover:from-slate-500 hover:to-slate-700",
    on: "border-slate-700 bg-gradient-to-b from-slate-600 to-slate-800 text-white shadow-md ring-2 ring-slate-300/70",
  },
  Google: {
    base: "border-red-500 bg-gradient-to-b from-red-400 to-red-600 text-white shadow-sm shadow-red-200/60 hover:from-red-500 hover:to-red-700",
    on: "border-red-700 bg-gradient-to-b from-red-600 to-red-800 text-white shadow-md ring-2 ring-red-300/70",
  },
};

const fmt = (n: number | null, d = 2) =>
  n === null || !isFinite(n) ? "—" : (Math.round(n * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: d });
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

/* 📦 PRIX D'achat — من صفحة pièce (التعديلات الحية + الأصل) */
function usePrixAchat(): Map<string, number> {
  return useMemo(() => {
    const m = new Map<string, number>();
    let rows: string[][] = [];
    try {
      const s = localStorage.getItem("sheet_pièce");
      if (s) rows = JSON.parse(s);
    } catch { /* */ }
    if (!rows.length) rows = (SHEETS["pièce"]?.rows as string[][]) ?? [];
    rows.forEach((r) => {
      const nom = String(r?.[0] ?? "").trim();
      const prix = Number(r?.[2]);
      if (nom && prix > 0) m.set(normalizeCity(nom), prix);
    });
    return m;
  }, []);
}

type Calc = {
  row: PerfRow;
  total: number; conf: number; ann: number; liv: number; ret: number; enc: number;
  confRate: number | null; delRate: number | null; totRate: number | null;
  spend: number; cpl: number | null; cplc: number | null; cpll: number | null;
  bep: number | null; gain: number; achat: number | null;
  ship: number; retShip: number;
};
const shipOf = (c: Calc) => c.ship;
const retShipOf = (c: Calc) => c.retShip;

export default function PerfSources() {
  const { orders } = useStore();
  const rows = usePerfRows();
  const spends = useSpends();
  const [src, setSrc] = useState(PERF_SOURCES[0].key);
  const today = new Date().toISOString().slice(0, 10);

  /* فورم: المنتوج + التاريخ + تمن البيع */
  const [nProduit, setNProduit] = useState("");
  const [nDate, setNDate] = useState(today);
  const [nPrix, setNPrix] = useState("");

  /* المنتوجات المستعملة */
  const prixAchat = usePrixAchat();

  const products = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o: Order) => { if (o.produit) m.set(o.produit, (m.get(o.produit) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);
  }, [orders]);

  /* ═══ الحساب الأوتوماتيك ═══ */
  const calc = (r: PerfRow): Calc => {
    const list = orders.filter((o: Order) =>
      o.originLead.trim().toLowerCase() === r.source.trim().toLowerCase() &&
      o.produit.trim().toLowerCase() === r.produit.trim().toLowerCase() &&
      o.dateCreation === r.date,
    );
    const livList = list.filter((o) => o.livraison === "Livrée");
    const liv = livList.length;
    const ret = list.filter((o) => o.livraison === "Retour").length;
    const ann = list.filter((o) => o.statut === "Annulé" && o.livraison !== "Livrée" && o.livraison !== "Retour").length;
    const conf = list.filter((o) => o.statut === "Confirmé").length;
    const total = list.length;
    const enc = Math.max(0, total - liv - ret - ann);
    // المصروف من صفحة 💸 CRM (نفس المصدر + المنتوج + النهار)
    const spend = spends
      .filter((s) => s.source.trim().toLowerCase() === r.source.trim().toLowerCase()
        && s.produit.trim().toLowerCase() === r.produit.trim().toLowerCase()
        && s.date === r.date)
      .reduce((sum, s) => sum + s.amount, 0);
    const retList = list.filter((o) => o.livraison === "Retour");
    const ship = livList.reduce((s, o) => s + (o.commission || 0), 0);   // شحن المسلّم
    const retShip = retList.reduce((s, o) => s + (o.commission || 0), 0); // الرتور كايكلف التوصيل تاني
    const shipPerLiv = liv ? ship / liv : 0;
    const achat = prixAchat.get(normalizeCity(r.produit)) ?? null;
    return {
      row: r, total, conf, ann, liv, ret, enc, achat, ship, retShip,
      confRate: total ? (conf / total) * 100 : null,
      delRate: liv + ret ? (liv / (liv + ret)) * 100 : null,
      totRate: total ? (liv / total) * 100 : null,
      spend,
      cpl: total ? spend / total : (spend ? null : null),
      cplc: conf ? spend / conf : null,
      cpll: liv ? spend / liv : null,
      // ═══ GAIN/PERTE بالطريقة الصحيحة ═══
      // (Livré × PRIX DE VENTE) − (Livré × PRIX D'achat) − شحن Livré − شحن Retour − المصروف
      bep: liv ? (spend + retShip) / liv + shipPerLiv + (achat ?? 0) : (shipPerLiv || null),
      gain: liv * r.prix
        - (achat !== null ? liv * achat : 0)
        - ship
        - retShip
        - spend,
    };
  };

  const srcRows = useMemo(() => rows.filter((r) => r.source === src).map(calc).sort((a, b) => b.row.date.localeCompare(a.row.date)), [rows, src, orders, spends, prixAchat]); // eslint-disable-line
  const allRows = useMemo(() => rows.map(calc).sort((a, b) => b.row.date.localeCompare(a.row.date)), [rows, orders, spends, prixAchat]); // eslint-disable-line

  const add = () => {
    if (!nProduit.trim() || !nPrix) return alert("عمّر: المنتوج + PRIX DE VENTE");
    addPerfRow(src, nProduit, nDate, Number(nPrix));
    setNProduit(""); setNPrix("");
  };

  const totals = (list: Calc[]) => ({
    total: list.reduce((s, c) => s + c.total, 0),
    conf: list.reduce((s, c) => s + c.conf, 0),
    liv: list.reduce((s, c) => s + c.liv, 0),
    spend: list.reduce((s, c) => s + c.spend, 0),
    gain: list.reduce((s, c) => s + c.gain, 0),
  });
  const k = totals(srcRows);
  const g = totals(allRows);

  const sel = "rounded-xl border border-slate-300 bg-white px-2.5 py-[7px] text-xs font-semibold outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
  const th = "sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-2 py-2 text-[9px] font-extrabold uppercase tracking-wide text-slate-600 whitespace-nowrap";

  const Table = ({ list, showSource = false }: { list: Calc[]; showSource?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]" dir="ltr">
        <thead>
          <tr>
            {showSource && <th className={th}>SOURCE</th>}
            <th className={th + " text-start"}>Produit</th>
            <th className={th + " text-start"}>Date</th>
            <th className={th}>totale order</th>
            <th className={th}>confirmé</th>
            <th className={th}>Annulé</th>
            <th className={th}>Livré</th>
            <th className={th}>Retour</th>
            <th className={th}>en cours</th>
            <th className={th}>confirmation rate</th>
            <th className={th}>delivre rate</th>
            <th className={th}>TOTAL RATE</th>
            <th className={th}>cost per lead</th>
            <th className={th}>cost per lead confirmé</th>
            <th className={th}>cost per lead livrée</th>
            <th className={th}>BREAK EVENT PRICE</th>
            <th className={th}>PRIX D'achat</th>
            <th className={th}>PRIX DE VENTE</th>
            <th className={th}>GAIN/PERTE</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.row.id} className="border-b border-slate-100 transition hover:bg-indigo-50/40">
              {showSource && (
                <td className="px-2 py-2 text-center">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    {PERF_SOURCES.find((s) => s.key === c.row.source)?.label || c.row.source}
                  </span>
                </td>
              )}
              <td className="max-w-40 truncate px-2 py-2 font-bold text-slate-700" title={c.row.produit}>{c.row.produit}</td>
              <td className="whitespace-nowrap px-2 py-2 font-semibold text-slate-400">{c.row.date}</td>
              <td className="px-2 py-2 text-center"><span className={`rounded-lg px-2 py-1 text-xs font-extrabold ${c.total ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-500"}`}>{c.total}</span></td>
              <td className="px-2 py-2 text-center font-bold text-blue-600">{c.conf || "—"}</td>
              <td className="px-2 py-2 text-center font-bold text-red-400">{c.ann || "—"}</td>
              <td className="px-2 py-2 text-center font-bold text-emerald-600">{c.liv || "—"}</td>
              <td className="px-2 py-2 text-center font-bold text-red-500">{c.ret || "—"}</td>
              <td className="px-2 py-2 text-center font-bold text-amber-500">{c.enc || "—"}</td>
              <td className="px-2 py-2 text-center">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${(c.confRate ?? 0) >= 50 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{pct(c.confRate)}</span>
              </td>
              <td className="px-2 py-2 text-center">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${(c.delRate ?? 0) >= 60 ? "bg-emerald-100 text-emerald-700" : (c.delRate ?? 0) >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{pct(c.delRate)}</span>
              </td>
              <td className="px-2 py-2 text-center font-extrabold text-slate-700">{pct(c.totRate)}</td>
              <td className="px-2 py-2 text-center font-bold text-red-600">{c.spend ? `${fmt(c.cpl)} DH` : "—"}</td>
              <td className="px-2 py-2 text-center font-bold text-red-600">{c.spend && c.conf ? `${fmt(c.cplc)} DH` : "—"}</td>
              <td className="px-2 py-2 text-center font-bold text-red-600">{c.spend && c.liv ? `${fmt(c.cpll)} DH` : "—"}</td>
              <td className="px-2 py-2 text-center font-extrabold text-violet-700">{c.bep !== null ? `${fmt(c.bep)} DH` : "—"}</td>
              <td className="px-2 py-2 text-center" title={c.achat !== null ? "تمن الشراء — من صفحة pièce" : "المنتوج ما موجودش فـ صفحة pièce"}>
                {c.achat !== null
                  ? <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-extrabold text-orange-600">{c.achat} DH</span>
                  : <span className="text-[10px] font-bold text-red-400">ما كاينش</span>}
              </td>
              <td className="px-2 py-2 text-center">
                <input type="number" value={c.row.prix} onChange={(e) => updPerfRow(c.row.id, { prix: Number(e.target.value) || 0 })}
                  title="PRIX DE VENTE — قابل للتعديل"
                  className="w-16 rounded-lg border border-slate-200 px-1 py-1 text-center text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-400" />
              </td>
              <td className="px-2 py-2 text-center">
                <span
                  title={`الحساب:\n(${c.liv} × ${c.row.prix} PRIX DE VENTE) = ${fmt(c.liv * c.row.prix)} DH\n− (${c.liv} × ${c.achat ?? 0} PRIX D'achat) = ${fmt(c.liv * (c.achat ?? 0))} DH\n− شحن Livré = ${fmt(shipOf(c))} DH\n− شحن Retour = ${fmt(retShipOf(c))} DH\n− المصروف = ${fmt(c.spend)} DH\n═══════\nGAIN/PERTE = ${fmt(c.gain)} DH`}
                  className={`cursor-help rounded-lg px-2 py-1 text-xs font-extrabold ${c.gain >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{fmt(c.gain)} DH</span>
              </td>
              <td className="px-2 py-2 text-center">
                <button onClick={() => confirm("مسح السطر؟") && delPerfRow(c.row.id)}
                  className="grid h-6 w-6 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!list.length && (
        <div className="p-8 text-center">
          <div className="mb-2 text-3xl">📊</div>
          <p className="text-xs font-bold text-slate-500">ما كاين حتى سطر — زيد المنتوج + التاريخ + PRIX DE VENTE من الفورم</p>
        </div>
      )}
    </div>
  );

  return (
    <div dir="rtl" className="h-full overflow-auto bg-slate-50 p-4 text-sm">
      <div className="mx-auto max-w-[1400px]">

        {/* ── الرأس ── */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl text-white shadow-md shadow-blue-200">📊</span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-800">Dashboard performance</h1>
            <p className="text-[11px] text-slate-500">كانحطو غير: المنتوج + التاريخ + PRIX DE VENTE — الباقي كامل أوتوماتيك من CRM (طلبيات + مصروفات 💸)</p>
          </div>
        </div>

        {/* ── المينوا — 5 تبويبات بنفس شكل المينو الرئيسي ── */}
        <nav className="mb-3">
          <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {PERF_SOURCES.map((s) => {
              const c = SRC_STYLES[s.key] ?? SRC_STYLES.TikTok;
              return (
                <button key={s.key} onClick={() => setSrc(s.key)}
                  className={`flex h-8 shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-[11px] font-bold text-white transition-all duration-150 active:scale-[0.96] ${src === s.key ? c.on : c.base}`}>
                  <span className="text-[12px] leading-none">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── KPI ── */}
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { icon: "🛒", label: "totale order", v: k.total, c: "#2563eb", bg: "#dbeafe" },
            { icon: "✅", label: "confirmé", v: k.conf, c: "#059669", bg: "#d1fae5" },
            { icon: "📦", label: "Livré", v: k.liv, c: "#0f766e", bg: "#ccfbf1" },
            { icon: "💸", label: "المصروف (CRM)", v: `${fmt(k.spend)} $`, c: "#7c3aed", bg: "#ede9fe" },
            { icon: "📈", label: "GAIN/PERTE", v: `${fmt(k.gain)} DH`, c: k.gain >= 0 ? "#059669" : "#dc2626", bg: k.gain >= 0 ? "#d1fae5" : "#fee2e2" },
          ].map((x) => (
            <div key={x.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base" style={{ background: x.bg, color: x.c }}>{x.icon}</span>
              <div className="min-w-0">
                <div className="truncate text-base font-extrabold leading-none" style={{ color: x.c }}>{x.v}</div>
                <div className="mt-0.5 truncate text-[10px] font-medium text-slate-500">{x.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── فورم الإضافة ── */}
        <div className="mb-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-base text-indigo-600 shadow-sm">＋</span>
            <b className="text-sm font-extrabold text-slate-800">زيد سطر فـ {PERF_SOURCES.find((s) => s.key === src)?.label}</b>
            <span className="text-[10px] font-semibold text-indigo-500">— غير 3 حوايج، الباقي أوتوماتيك ⚡</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-bold text-slate-500">📦 Produit
              <input list="perf-products" value={nProduit} onChange={(e) => setNProduit(e.target.value)} placeholder="نظارة القراءة..." className={sel + " mt-0.5 w-full"} />
            </label>
            <label className="text-[10px] font-bold text-slate-500">📅 Date
              <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} className={sel + " mt-0.5 w-full"} />
            </label>
            <label className="text-[10px] font-bold text-slate-500">💵 PRIX DE VENTE (DH)
              <input type="number" value={nPrix} onChange={(e) => setNPrix(e.target.value)} placeholder="250" className={sel + " mt-0.5 w-full"} />
            </label>
            <div className="flex items-end">
              <Btn icon="＋" color="indigo" className="w-full justify-center" onClick={add}>إضافة</Btn>
            </div>
          </div>
          <datalist id="perf-products">{products.map((p) => <option key={p} value={p} />)}</datalist>
        </div>

        {/* ── جدول المصدر ── */}
        <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
            <span className="text-base">{PERF_SOURCES.find((s) => s.key === src)?.icon}</span>
            <b className="text-xs font-extrabold text-slate-700">{PERF_SOURCES.find((s) => s.key === src)?.label}</b>
            <span className="ms-auto text-[10px] text-slate-400">⚡ طلبيات CRM (نفس المصدر+المنتوج+النهار) + مصروفات 💸 CRM</span>
          </div>
          <Table list={srcRows} />
        </div>

        {/* ── الجدول الغلوبال ── */}
        <div className="overflow-hidden rounded-2xl border-2 border-indigo-200 bg-white shadow-md">
          <div className="flex flex-wrap items-center gap-2 bg-gradient-to-l from-indigo-600 to-violet-600 px-4 py-3 text-white">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/20 text-base">🌍</span>
            <b className="text-sm font-extrabold">GLOBAL — كل المصادر</b>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">{allRows.length} سطر</span>
            <span className="ms-auto flex flex-wrap gap-3 text-[10px] font-bold">
              <span>🛒 {g.total}</span><span>✅ {g.conf}</span><span>📦 {g.liv}</span>
              <span>💸 {fmt(g.spend)} DH</span><span>📈 {fmt(g.gain)} DH</span>
            </span>
          </div>
          <Table list={allRows} showSource />
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
