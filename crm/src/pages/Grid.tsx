import { useEffect, useMemo, useState } from "react";
import type { SheetData } from "../data/sheets";
import DualScroll from "../components/DualScroll";
import { useAuth } from "../auth";
import { useStore } from "../store";
import { cloudPush } from "../data/cloud";

function exportCSV(headers: string[], rows: string[][], name: string) {
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `${name}.csv`;
  a.click();
}

/** Colonnes calculées automatiquement depuis les commandes (comme les formules Google Sheets) */
type AutoCol = { header: string; compute: (row: string[], ctx: AutoCtx) => string };
type AutoCtx = { orders: ReturnType<typeof useStore>["orders"] };

const nf = (n: number) => n.toLocaleString("fr-FR");
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(1) + "%" : "0%");

/** Trouve les commandes liées au produit nommé dans la 1re colonne */
function ordersOf(name: string, ctx: AutoCtx) {
  const key = (name || "").trim().toLowerCase();
  if (!key) return [];
  return ctx.orders.filter((o) => o.produit.trim().toLowerCase() === key);
}

const AUTO: Record<string, AutoCol[]> = {
  PRODUITS: [
    { header: "CMD (auto)", compute: (r, c) => nf(ordersOf(r[0], c).length) },
    { header: "Livrée (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").length) },
    { header: "Retour (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Retour").length) },
    { header: "Tx livraison", compute: (r, c) => {
      const l = ordersOf(r[0], c); const liv = l.filter((o) => o.livraison === "Livrée").length;
      const ret = l.filter((o) => o.livraison === "Retour").length;
      return pct(liv, liv + ret);
    } },
    { header: "Pièces (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.qte, 0)) },
    { header: "CA (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.prix, 0)) + " DH" },
  ],
  "pièce": [
    { header: "Sorties (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.qte, 0)) },
    { header: "CA (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.prix, 0)) + " DH" },
    { header: "Stock restant", compute: (r, c) => {
      const initial = Number(String(r[1] ?? "").replace(/[^\d.-]/g, "")) || 0;
      const out = ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.qte, 0);
      return nf(initial - out);
    } },
  ],
  statistique: [
    { header: "Livré (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").length) },
    { header: "CA réel (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.prix, 0)) + " DH" },
  ],
  "Dashboard performance": [
    { header: "CMD (auto)", compute: (r, c) => nf(ordersOf(r[0], c).length) },
    { header: "Livré (auto)", compute: (r, c) => nf(ordersOf(r[0], c).filter((o) => o.livraison === "Livrée").length) },
    { header: "Tx livraison (auto)", compute: (r, c) => {
      const l = ordersOf(r[0], c); const liv = l.filter((o) => o.livraison === "Livrée").length;
      const ret = l.filter((o) => o.livraison === "Retour").length;
      return pct(liv, liv + ret);
    } },
  ],
};

export default function Grid({ name, data }: { name: string; data: SheetData }) {
  const KEY = `sheet_${name}`;
  const { currentUser } = useAuth();
  const { orders } = useStore();
  const isAdmin = currentUser?.role === "admin";

  const [rows, setRows] = useState<string[][]>(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) return JSON.parse(s);
    } catch { /* */ }
    return data.rows;
  });
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<string[]>(() => Array(data.headers.length).fill(""));
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(rows)); cloudPush(KEY); }, [rows, KEY]);
  useEffect(() => { setDraft(Array(data.headers.length).fill("")); setEditIndex(null); setShowForm(false); }, [name, data.headers.length]);

  const cols = data.headers.length;
  const autoCols = AUTO[name] || [];
  const ctx: AutoCtx = { orders };

  const filtered = useMemo(() => (
    q.trim() ? rows.filter((r) => r.join(" ").toLowerCase().includes(q.trim().toLowerCase())) : rows
  ), [rows, q]);

  const setCell = (ri: number, ci: number, v: string) => {
    if (!isAdmin) return;
    setRows((p) => p.map((row, i) => i === ri ? row.map((cell, j) => j === ci ? v : cell) : row));
  };
  const delRow = (ri: number) => { if (isAdmin && confirm("مسح هذا السطر؟")) setRows((p) => p.filter((_, i) => i !== ri)); };
  const reset = () => { if (isAdmin && confirm("إعادة تعيين البيانات الأصلية؟")) setRows(data.rows); };

  const openAdd = () => { setDraft(Array(cols).fill("")); setEditIndex(null); setShowForm(true); };
  const openEdit = (ri: number) => { setDraft([...rows[ri]]); setEditIndex(ri); setShowForm(true); };
  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft[0]?.trim()) return alert("الخانة الأولى مطلوبة");
    if (editIndex === null) setRows((p) => [...p, draft]);
    else setRows((p) => p.map((r, i) => i === editIndex ? draft : r));
    setShowForm(false);
  };

  const th = "border border-slate-300 bg-[#4a86c8] text-white px-2 py-2 text-[11px] font-bold text-center whitespace-nowrap";
  const thAuto = "border border-slate-300 bg-emerald-600 text-white px-2 py-2 text-[11px] font-bold text-center whitespace-nowrap";

  return (
    <div dir="ltr" className="flex h-full flex-col bg-slate-50">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-2.5">
        <h2 className="text-base font-bold text-slate-800">{name}</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 بحث..." className="w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
        {isAdmin ? (
          <>
            <button onClick={openAdd} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">➕ إضافة</button>
            <button onClick={() => exportCSV(data.headers, rows, name)} className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700">📥 CSV</button>
            <button onClick={reset} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700">↺ Reset</button>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">✏️ Admin</span>
          </>
        ) : (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">🔒 قراءة فقط</span>
        )}
        {!!autoCols.length && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">⚡ أعمدة محسوبة تلقائياً من الطلبات</span>}
        <span className="ml-auto text-[11px] text-slate-500">{filtered.length} lignes</span>
      </div>

      {/* Formulaire ajout / édition */}
      {showForm && isAdmin && (
        <form onSubmit={saveForm} className="border-b border-blue-200 bg-blue-50/60 p-3">
          <div className="mb-2 flex items-center gap-2">
            <b className="text-sm text-blue-900">{editIndex === null ? "➕ إضافة سطر جديد" : "✏️ تعديل السطر"}</b>
            <button type="button" onClick={() => setShowForm(false)} className="ml-auto rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
            <button className="rounded-lg bg-blue-600 px-4 py-1 text-xs font-bold text-white hover:bg-blue-700">حفظ</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {data.headers.map((h, i) => (
              <label key={i} className="text-[11px] font-medium text-slate-600">
                {h}{i === 0 && <span className="text-red-500"> *</span>}
                <input
                  value={draft[i] ?? ""}
                  onChange={(e) => setDraft((d) => d.map((v, j) => j === i ? e.target.value : v))}
                  list={i === 0 && (name === "PRODUITS" || name === "pièce" || name === "statistique") ? "produits-list" : undefined}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500"
                />
              </label>
            ))}
          </div>
          {/* Suggestions de produits existants (liaison avec les commandes) */}
          <datalist id="produits-list">
            {[...new Set(orders.map((o) => o.produit).filter(Boolean))].map((p) => <option key={p} value={p} />)}
          </datalist>
        </form>
      )}

      {/* Tableau */}
      <div className="flex-1 overflow-hidden">
        <DualScroll>
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-slate-500 px-1 py-2 text-[11px] text-white" style={{ width: 34 }}>#</th>
                {data.headers.map((h, i) => <th key={i} className={th}>{h}</th>)}
                {autoCols.map((c) => <th key={c.header} className={thAuto}>⚡ {c.header}</th>)}
                {isAdmin && <th className="border border-slate-300 bg-slate-700 px-1 py-2 text-[11px] text-white" style={{ width: 70 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const ri = rows.indexOf(row);
                return (
                  <tr key={ri} className="odd:bg-white even:bg-slate-50 hover:bg-blue-50/40">
                    <td className="border border-slate-200 bg-slate-100 text-center text-slate-400">{ri + 1}</td>
                    {Array.from({ length: cols }).map((_, ci) => (
                      <td key={ci} className="border border-slate-200 p-0">
                        {isAdmin ? (
                          <input value={row[ci] ?? ""} onChange={(e) => setCell(ri, ci, e.target.value)}
                            className="h-full w-full min-w-[80px] border-0 bg-transparent px-2 py-1.5 text-xs outline-none focus:bg-white" />
                        ) : (
                          <span className="block min-w-[80px] px-2 py-1.5 text-xs">{row[ci] || "—"}</span>
                        )}
                      </td>
                    ))}
                    {autoCols.map((c) => (
                      <td key={c.header} className="border border-slate-200 bg-emerald-50 px-2 py-1.5 text-center text-xs font-bold text-emerald-800">
                        {c.compute(row, ctx)}
                      </td>
                    ))}
                    {isAdmin && (
                      <td className="border border-slate-200 bg-slate-50 text-center">
                        <button onClick={() => openEdit(ri)} title="تعديل" className="px-1 text-blue-600 hover:text-blue-800">✏️</button>
                        <button onClick={() => delRow(ri)} title="مسح" className="px-1 text-red-600 hover:text-red-800">✕</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <div className="p-8 text-center text-slate-400">لا توجد بيانات</div>}
        </DualScroll>
      </div>
    </div>
  );
}
