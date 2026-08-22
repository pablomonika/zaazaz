import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useSpends } from "../data/adspend";
import { SHEETS } from "../data/sheets";
import { normalizeCity } from "../data/villes";
import type { Order } from "../data/orders";

/* ═══════════════════════ Statistique ═══════════════════════
   📊 جدول واحد لكل المنتوجات — كلشي أوتوماتيك:
   piece livré · Comd livrée · C.A · retour · prix d'achat (pièce)
   la livraison · advertising (💸 CRM) · charges fixe (20 DH/طلبية)
   → le bénéfice · PAR CMND · par piece · ROA
   ═════════════════════════════════════════════════════════════ */

const CHARGE_FIXE = 20; // درهم على كل طلبية livrée
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/* 📦 تمن الشراء من صفحة pièce */
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

type Row = {
  produit: string;
  pieces: number; comdL: number; ca: number; retour: number;
  achat: number; livraison: number; ads: number; charges: number;
  benef: number; parCmd: number | null; parPiece: number | null; roa: number | null;
};

export default function Statistique() {
  const { orders } = useStore();
  const spends = useSpends();
  const prixAchat = usePrixAchat();

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date().toISOString().slice(0, 8) + "01";
  const weekStart = (() => { const d = new Date(); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toISOString().slice(0, 10); })();
  const yearStart = new Date().toISOString().slice(0, 4) + "-01-01";

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const rows = useMemo<Row[]>(() => {
    const inPeriod = (d: string) => (!from || d >= from) && (!to || d <= to);
    const list = orders.filter((o: Order) => inPeriod(o.dateCreation));

    // المنتوجات
    const prods = [...new Set(list.map((o: Order) => o.produit).filter(Boolean))];

    return prods.map((p) => {
      const ofP = list.filter((o: Order) => o.produit === p);
      const liv = ofP.filter((o) => o.livraison === "Livrée");
      const pieces = liv.reduce((s, o) => s + (o.qte || 1), 0);
      const comdL = liv.length;
      const ca = liv.reduce((s, o) => s + o.prix * (o.qte || 1), 0);
      const retour = ofP.filter((o) => o.livraison === "Retour").length;
      const unitAchat = prixAchat.get(normalizeCity(p)) ?? 0;
      const achat = unitAchat * pieces;
      const livraison = liv.reduce((s, o) => s + (o.commission || 0), 0);
      // 💸 ADS من صفحة CRM (نفس المنتوج + نفس الفترة)
      const ads = spends
        .filter((s) => s.produit.trim().toLowerCase() === p.trim().toLowerCase() && inPeriod(s.date))
        .reduce((sum, s) => sum + s.amount, 0);
      const charges = comdL * CHARGE_FIXE;
      const benef = ca - achat - livraison - ads - charges;
      return {
        produit: p, pieces, comdL, ca, retour, achat, livraison, ads, charges, benef,
        parCmd: comdL ? benef / comdL : null,
        parPiece: pieces ? benef / pieces : null,
        roa: ads > 0 ? (benef / ads) * 100 : null,
      };
    }).sort((a, b) => b.benef - a.benef);
  }, [orders, spends, prixAchat, from, to]);

  const totals = useMemo(() => ({
    pieces: rows.reduce((s, r) => s + r.pieces, 0),
    comdL: rows.reduce((s, r) => s + r.comdL, 0),
    ca: rows.reduce((s, r) => s + r.ca, 0),
    retour: rows.reduce((s, r) => s + r.retour, 0),
    achat: rows.reduce((s, r) => s + r.achat, 0),
    livraison: rows.reduce((s, r) => s + r.livraison, 0),
    ads: rows.reduce((s, r) => s + r.ads, 0),
    charges: rows.reduce((s, r) => s + r.charges, 0),
    benef: rows.reduce((s, r) => s + r.benef, 0),
  }), [rows]);

  const th = "border border-slate-400 px-2 py-2 text-[10px] font-extrabold text-white text-center whitespace-nowrap";
  const td = "border border-slate-300 px-2 py-1.5 text-[11px] text-center whitespace-nowrap";

  return (
    <div dir="ltr" className="h-full overflow-auto bg-slate-50 p-4">
      <div className="mx-auto max-w-[1400px]">

        {/* ── الفلاتر ── */}
        <div dir="rtl" className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          {([
            ["week", "هاد الأسبوع"], ["month", "هاد الشهر"], ["year", "هاد السنة"], ["all", "الكل"],
          ] as const).map(([k, label]) => {
            const active = (k === "week" && from === weekStart && to === today)
              || (k === "month" && from === monthStart && to === today)
              || (k === "year" && from === yearStart && to === today)
              || (k === "all" && !from && !to);
            return (
              <button key={k} onClick={() => {
                if (k === "week") { setFrom(weekStart); setTo(today); }
                else if (k === "month") { setFrom(monthStart); setTo(today); }
                else if (k === "year") { setFrom(yearStart); setTo(today); }
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
              className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-teal-400" /> إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400" />
          </label>
          <span className="ms-auto text-[10px] font-bold text-slate-400">⚡ كلشي محسوب أوتوماتيك — الشحن من Les villes · الشراء من pièce · ADS من 💸 CRM · charges fixe = {CHARGE_FIXE} DH × Livrée</span>
        </div>

        {/* ── الجدول ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={th + " bg-[#38761d] text-start"}>produit</th>
                  <th className={th + " bg-[#6aa84f]"}>piece livré</th>
                  <th className={th + " bg-[#6aa84f]"}>Comd livrée</th>
                  <th className={th + " bg-[#3c78d8]"}>C.A</th>
                  <th className={th + " bg-[#cc0000]"}>retour</th>
                  <th className={th + " bg-[#f1c232] !text-slate-800"}>prix d'achat</th>
                  <th className={th + " bg-[#f6b26b] !text-slate-800"}>la livraison</th>
                  <th className={th + " bg-[#a64d79]"}>advirtising</th>
                  <th className={th + " bg-[#b3562d]"}>charges fixe</th>
                  <th className={th + " bg-[#38761d]"}>le bénéfice</th>
                  <th className={th + " bg-[#434343]"}>PAR CMND</th>
                  <th className={th + " bg-[#434343]"}>par piece</th>
                  <th className={th + " bg-[#674ea7]"}>ROA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.produit} className="transition hover:bg-emerald-50/40">
                    <td className={td + " max-w-56 truncate text-start font-bold text-slate-700"} title={r.produit}>{r.produit}</td>
                    <td className={td + " font-extrabold text-blue-700"}>{r.pieces}</td>
                    <td className={td + " font-extrabold text-emerald-700"}>{r.comdL}</td>
                    <td className={td + " font-extrabold text-teal-700"}>{fmt(r.ca)} DH</td>
                    <td className={td + " font-bold text-red-600"}>{r.retour}</td>
                    <td className={td + " font-bold text-amber-700"}>{fmt(r.achat)} DH</td>
                    <td className={td + " font-bold text-orange-600"}>{fmt(r.livraison)} DH</td>
                    <td className={td + " font-bold text-fuchsia-700"}>{r.ads ? `${fmt(r.ads)} DH` : "—"}</td>
                    <td className={td + " font-bold text-[#b3562d]"}>{fmt(r.charges)} DH</td>
                    <td className={td}>
                      <span className={`rounded-lg px-2 py-1 text-[11px] font-extrabold ${r.benef >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{fmt(r.benef)} DH</span>
                    </td>
                    <td className={td + " font-extrabold text-slate-800"}>{r.parCmd !== null ? `${fmt(r.parCmd)} DH` : "—"}</td>
                    <td className={td + " font-extrabold text-slate-800"}>{r.parPiece !== null ? `${fmt(r.parPiece)} DH` : "—"}</td>
                    <td className={td}>
                      {r.roa !== null
                        ? <span className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${r.roa >= 0 ? "bg-violet-100 text-violet-700" : "bg-red-100 text-red-700"}`}>{fmt(r.roa)}%</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-extrabold">
                    <td className={td + " text-start"}>TOTAL</td>
                    <td className={td}>{totals.pieces}</td>
                    <td className={td}>{totals.comdL}</td>
                    <td className={td + " text-teal-700"}>{fmt(totals.ca)} DH</td>
                    <td className={td + " text-red-600"}>{totals.retour}</td>
                    <td className={td + " text-amber-700"}>{fmt(totals.achat)} DH</td>
                    <td className={td + " text-orange-600"}>{fmt(totals.livraison)} DH</td>
                    <td className={td + " text-fuchsia-700"}>{fmt(totals.ads)} DH</td>
                    <td className={td + " text-[#b3562d]"}>{fmt(totals.charges)} DH</td>
                    <td className={td}>
                      <span className={`rounded-lg px-2 py-1 ${totals.benef >= 0 ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>{fmt(totals.benef)} DH</span>
                    </td>
                    <td className={td}>{totals.comdL ? `${fmt(totals.benef / totals.comdL)} DH` : "—"}</td>
                    <td className={td}>{totals.pieces ? `${fmt(totals.benef / totals.pieces)} DH` : "—"}</td>
                    <td className={td}>{totals.ads > 0 ? `${fmt((totals.benef / totals.ads) * 100)}%` : "—"}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!rows.length && (
            <div className="p-10 text-center">
              <div className="mb-2 text-4xl">📊</div>
              <p className="text-xs font-bold text-slate-500">ما كاين حتى منتوج فهاد الفترة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
