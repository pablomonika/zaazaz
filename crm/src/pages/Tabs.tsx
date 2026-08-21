import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { useAuth } from "../auth";
import type { Order } from "../data/orders";
import { PRODUITS_CATALOG, PRODUITS_DU_MOIS, ZONES_LIVRAISON } from "../data/produits";

const fmt = (n: number) => n.toLocaleString("fr-FR");
const th = "border border-slate-400 bg-[#4a86c8] text-white px-2 py-1 text-[11px] font-bold text-center whitespace-nowrap";
const thG = "border border-slate-400 bg-[#6aa84f] text-white px-2 py-1 text-[11px] font-bold text-center whitespace-nowrap";
const c = "border border-slate-300 px-2 py-[3px]";
const cc = "border border-slate-300 px-2 py-[3px] text-center";

function pct(a: number, b: number) { return b ? ((a / b) * 100).toFixed(2) + "%" : "0%"; }

/* ═══ Dashboard performance ═══ */
export function DashboardPerf() {
  const { orders, agents, gs } = useStore();
  const kpi = useMemo(() => {
    const liv = orders.filter((o: Order) => o.livraison === "Livrée");
    return {
      cmd: orders.length,
      conf: orders.filter((o: Order) => o.statut === "Confirmé").length,
      liv: liv.length,
      ret: orders.filter((o: Order) => o.livraison === "Retour").length,
      ann: orders.filter((o: Order) => o.statut === "Annulé").length,
      ca: liv.reduce((s: number, o: Order) => s + o.prix, 0),
      pcs: liv.reduce((s: number, o: Order) => s + o.qte, 0),
      comm: liv.reduce((s: number, o: Order) => s + o.commission, 0),
    };
  }, [orders]);
  const cards = [
    { t: "CMD", v: kpi.cmd, bg: "from-slate-600 to-slate-800" },
    { t: "CMD confirmé", v: kpi.conf, bg: "from-emerald-500 to-teal-600" },
    { t: "CMD livrée", v: kpi.liv, bg: "from-sky-500 to-indigo-600" },
    { t: "CMD retourner", v: kpi.ret, bg: "from-rose-500 to-pink-600" },
    { t: "CMD Annulé", v: kpi.ann, bg: "from-orange-500 to-red-500" },
    { t: "Chiffre d'affaire", v: fmt(kpi.ca) + " DH", bg: "from-violet-500 to-fuchsia-600" },
    { t: "Pièces sortie", v: kpi.pcs, bg: "from-amber-500 to-yellow-600" },
    { t: "Commissions", v: fmt(kpi.comm) + " DH", bg: "from-cyan-500 to-blue-600" },
  ];
  const maxCA = Math.max(1, ...agents.map((a) => orders.filter((o: Order) => o.agent === a.name && o.livraison === "Livrée").reduce((s: number, o: Order) => s + o.prix, 0)));
  return (
    <div className="p-4 space-y-5" dir="ltr">
      <h2 className="text-lg font-bold">📊 Dashboard performance</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((k) => (
          <div key={k.t} className={`rounded-xl bg-gradient-to-br ${k.bg} p-4 text-white shadow`}>
            <div className="text-xs opacity-90">{k.t}</div>
            <div className="mt-1 text-2xl font-extrabold">{k.v}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 font-bold text-sm">CA par agent</h3>
        <div className="space-y-2">
          {agents.map((a) => {
            const ca = orders.filter((o: Order) => o.agent === a.name && o.livraison === "Livrée").reduce((s: number, o: Order) => s + o.prix, 0);
            return (
              <div key={a.name} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 font-semibold">{a.name}</span>
                <div className="h-4 flex-1 rounded bg-slate-100"><div className="h-4 rounded bg-emerald-500" style={{ width: `${(ca / maxCA) * 100}%` }} /></div>
                <span className="w-20 text-right font-bold">{fmt(ca)} DH</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <h3 className="mb-2 font-bold">Statistiques globales (Sheet)</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded bg-slate-50 p-2">Tx livraison: <b>{gs.txLivraison}</b></div>
          <div className="rounded bg-slate-50 p-2">Tx confirmation: <b>{gs.txConfirmation}</b></div>
          <div className="rounded bg-slate-50 p-2">Charge livraison: <b>{gs.chargeLivraison} DH</b></div>
          <div className="rounded bg-slate-50 p-2">CMD total: <b>{gs.cmd}</b></div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Generic filtered orders table ═══ */
function OrdersTable({ rows }: { rows: Order[] }) {
  return (
    <div className="overflow-auto" dir="ltr">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={th}>DATE</th><th className={th}>Statut</th><th className={thG}>Nom&amp; Prénom</th>
            <th className={thG}>Télephone</th><th className={th}>Ville</th><th className={th}>Adress</th>
            <th className={th}>Qte</th><th className={thG}>Prix</th><th className={thG}>Produit</th>
            <th className={th}>Livraison</th><th className={th}>Agent</th><th className={th}>ORIGIN LEAD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="odd:bg-white even:bg-[#f8f9fa]">
              <td className={cc}>{o.dateCreation}</td>
              <td className={cc} style={{ background: o.statut === "Annulé" ? "#ffe4e6" : o.statut === "Confirmé" ? "#d1fae5" : "" }}>{o.statut}</td>
              <td className={c}>{o.nom}</td>
              <td className={c}>{o.telephone} {o.telephone && <a href={`https://wa.me/${o.telephone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600">💬</a>}</td>
              <td className={c}>{o.ville}</td><td className={c}>{o.adresse}</td>
              <td className={cc}>{o.qte}</td><td className={cc}>{o.prix}</td>
              <td className={c}>{o.produit}</td>
              <td className={cc} style={{ background: o.livraison === "Livrée" ? "#d1fae5" : o.livraison === "Retour" ? "#ffe4e6" : "" }}>{o.livraison}</td>
              <td className={cc}>{o.agent}</td><td className={cc}>{o.originLead}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="p-8 text-center text-slate-400">لا توجد بيانات</div>}
    </div>
  );
}

/* ═══ LES RENV (returns) ═══ */
export function LesRenv() {
  const { orders } = useStore();
  const rows = orders.filter((o: Order) => o.livraison === "Retour");
  return (<div className="p-4"><h2 className="mb-3 text-lg font-bold" dir="ltr">↩️ LES RENV — المرتجعات ({rows.length})</h2><OrdersTable rows={rows} /></div>);
}

/* ═══ PRODUITS ═══ */
type Prod = { nom: string; link: string; prix: string; commission: string; stock: string };
const CATALOG_KEY = "afrizon_catalog_v1";

export function Produits() {
  const { orders } = useStore();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [view, setView] = useState<"catalog" | "stats" | "mois" | "zones">("catalog");

  // Catalogue éditable (persisté)
  const [catalog, setCatalog] = useState<Prod[]>(() => {
    try {
      const s = localStorage.getItem(CATALOG_KEY);
      if (s) return JSON.parse(s);
    } catch { /* */ }
    return PRODUITS_CATALOG.map((p) => ({ nom: p[0], link: p[1], prix: p[2], commission: "35", stock: "" }));
  });
  useEffect(() => { localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog)); }, [catalog]);

  const empty: Prod = { nom: "", link: "", prix: "", commission: "35", stock: "" };
  const [form, setForm] = useState<Prod>(empty);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; liv: number; ret: number; ca: number; pcs: number }>();
    orders.forEach((o: Order) => {
      if (!o.produit) return;
      const e = m.get(o.produit) || { total: 0, liv: 0, ret: 0, ca: 0, pcs: 0 };
      e.total++;
      if (o.livraison === "Livrée") { e.liv++; e.ca += o.prix; e.pcs += o.qte; }
      if (o.livraison === "Retour") e.ret++;
      m.set(o.produit, e);
    });
    return [...m.entries()].map(([nom, v]) => ({ nom, ...v })).sort((a, b) => b.total - a.total);
  }, [orders]);

  /** Stats automatiques par produit (mêmes formules que Google Sheets) */
  const statOf = (nom: string) => {
    const key = nom.trim().toLowerCase();
    const l = orders.filter((o: Order) => o.produit.trim().toLowerCase() === key);
    const liv = l.filter((o) => o.livraison === "Livrée");
    const ret = l.filter((o) => o.livraison === "Retour").length;
    return {
      cmd: l.length, liv: liv.length, ret,
      pcs: liv.reduce((s, o) => s + o.qte, 0),
      ca: liv.reduce((s, o) => s + o.prix, 0),
      taux: liv.length + ret ? Math.round((liv.length / (liv.length + ret)) * 100) : 0,
    };
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) return alert("اسم المنتج مطلوب");
    if (editIdx === null) setCatalog((p) => [...p, form]);
    else setCatalog((p) => p.map((x, i) => i === editIdx ? form : x));
    setForm(empty); setEditIdx(null); setOpen(false);
  };
  const edit = (i: number) => { setForm(catalog[i]); setEditIdx(i); setOpen(true); };
  const del = (i: number) => { if (confirm(`مسح المنتج "${catalog[i].nom}"؟`)) setCatalog((p) => p.filter((_, j) => j !== i)); };

  const shown = catalog.filter((p) => !q.trim() || p.nom.toLowerCase().includes(q.trim().toLowerCase()));

  const btn = (v: typeof view, label: string) =>
    <button onClick={() => setView(v)} className={`rounded px-3 py-1 text-xs font-bold ${view === v ? "bg-[#6aa84f] text-white" : "bg-slate-200 text-slate-700"}`}>{label}</button>;

  return (
    <div className="p-4" dir="ltr">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">📦 PRODUITS</h2>
        {btn("catalog", `Catalogue (${catalog.length})`)}
        {btn("stats", `Statistiques ventes (${stats.length})`)}
        {btn("mois", `Produits du mois (${PRODUITS_DU_MOIS.length})`)}
        {btn("zones", `Zones livraison (${ZONES_LIVRAISON.length})`)}
        {isAdmin
          ? <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">✏️ Admin</span>
          : <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">🔒 قراءة فقط</span>}
      </div>

      {view === "catalog" && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 بحث عن منتج..." className="w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
            {isAdmin && <button onClick={() => { setForm(empty); setEditIdx(null); setOpen(true); }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">➕ إضافة منتج</button>}
            <span className="ml-auto rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">⚡ الإحصائيات محسوبة تلقائياً من الطلبات</span>
          </div>

          {open && isAdmin && (
            <form onSubmit={save} className="mb-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <b className="text-sm text-blue-900">{editIdx === null ? "➕ منتج جديد" : "✏️ تعديل المنتج"}</b>
                <button type="button" onClick={() => setOpen(false)} className="ml-auto rounded-lg bg-white px-3 py-1 text-xs font-bold text-slate-600">إلغاء</button>
                <button className="rounded-lg bg-blue-600 px-4 py-1 text-xs font-bold text-white">حفظ</button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-[11px] font-medium text-slate-600">اسم المنتج <span className="text-red-500">*</span>
                  <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
                <label className="text-[11px] font-medium text-slate-600 lg:col-span-2">الرابط (LINK)
                  <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
                <label className="text-[11px] font-medium text-slate-600">الثمن (Prix)
                  <input type="number" value={form.prix} onChange={(e) => setForm({ ...form, prix: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
                <label className="text-[11px] font-medium text-slate-600">العمولة
                  <input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
                <label className="text-[11px] font-medium text-slate-600">المخزون الأولي
                  <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </label>
              </div>
            </form>
          )}

          <div className="overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead><tr>
                <th className={th} style={{ width: 40 }}>#</th>
                <th className={thG}>PRODUITE</th>
                <th className={th}>LINK</th>
                <th className={thG}>Prix</th>
                <th className={th}>commision</th>
                <th className="border border-slate-400 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">⚡ CMD</th>
                <th className="border border-slate-400 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">⚡ Livrée</th>
                <th className="border border-slate-400 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">⚡ Retour</th>
                <th className="border border-slate-400 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">⚡ Tx</th>
                <th className="border border-slate-400 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">⚡ Pièces</th>
                <th className="border border-slate-400 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white">⚡ CA</th>
                <th className="border border-slate-400 bg-teal-700 px-2 py-1 text-[11px] font-bold text-white">⚡ Stock</th>
                {isAdmin && <th className="border border-slate-400 bg-slate-700 px-2 py-1 text-[11px] font-bold text-white">Actions</th>}
              </tr></thead>
              <tbody>
                {shown.map((p, i) => {
                  const idx = catalog.indexOf(p);
                  const s = statOf(p.nom);
                  const stockLeft = (Number(p.stock) || 0) - s.pcs;
                  return (
                    <tr key={idx} className="odd:bg-white even:bg-[#f8f9fa]">
                      <td className={cc + " text-slate-400"}>{i + 1}</td>
                      <td className={c + " font-medium"}>{p.nom}</td>
                      <td className={c}>{p.link ? <a href={p.link} target="_blank" rel="noreferrer" className="text-blue-600 underline">🔗 {p.link.slice(0, 40)}...</a> : "—"}</td>
                      <td className={cc + " font-bold"}>{p.prix || "—"}</td>
                      <td className={cc}>{p.commission || "35"}</td>
                      <td className={cc + " bg-emerald-50 font-bold"}>{s.cmd}</td>
                      <td className={cc + " bg-emerald-50 font-bold text-emerald-700"}>{s.liv}</td>
                      <td className={cc + " bg-emerald-50 font-bold text-red-600"}>{s.ret}</td>
                      <td className={cc + " bg-emerald-50 font-bold"} style={{ color: s.taux >= 60 ? "#059669" : s.taux >= 40 ? "#ca8a04" : "#dc2626" }}>{s.taux}%</td>
                      <td className={cc + " bg-emerald-50 font-bold"}>{s.pcs}</td>
                      <td className={cc + " bg-emerald-50 font-bold text-teal-700"}>{s.ca.toLocaleString("fr-FR")}</td>
                      <td className={cc + " bg-teal-50 font-bold"} style={{ color: stockLeft < 0 ? "#dc2626" : stockLeft < 10 ? "#ca8a04" : "#0f766e" }}>
                        {p.stock ? stockLeft : "—"}
                      </td>
                      {isAdmin && (
                        <td className={cc + " bg-slate-50"}>
                          <button onClick={() => edit(idx)} title="تعديل" className="px-1 text-blue-600 hover:text-blue-800">✏️</button>
                          <button onClick={() => del(idx)} title="مسح" className="px-1 text-red-600 hover:text-red-800">✕</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!shown.length && <div className="p-8 text-center text-slate-400">لا توجد منتجات</div>}
          </div>
        </div>
      )}

      {view === "stats" && (
        <div className="overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className={thG}>Produit</th><th className={th}>CMD</th><th className={th}>Livrée</th><th className={th}>Retour</th><th className={th}>Tx livraison</th><th className={thG}>CA</th><th className={th}>Pièces</th></tr></thead>
            <tbody>
              {stats.map((r) => (
                <tr key={r.nom} className="odd:bg-white even:bg-[#f8f9fa]">
                  <td className={c}>{r.nom}</td><td className={cc}>{r.total}</td>
                  <td className={`${cc} text-emerald-700`}>{r.liv}</td><td className={`${cc} text-rose-600`}>{r.ret}</td>
                  <td className={cc}>{pct(r.liv, r.liv + r.ret)}</td>
                  <td className={`${cc} font-bold`}>{fmt(r.ca)} DH</td><td className={cc}>{r.pcs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "mois" && (
        <div className="overflow-auto max-w-2xl">
          <h3 className="mb-2 font-bold text-sm">LES PRODUITS DE MOIS</h3>
          <table className="w-full border-collapse text-xs">
            <thead><tr><th className={th} style={{ width: 40 }}>#</th><th className={th} style={{ width: 110 }}>Date</th><th className={thG}>Produit</th></tr></thead>
            <tbody>
              {PRODUITS_DU_MOIS.map((p, i) => (
                <tr key={i} className="odd:bg-white even:bg-[#f8f9fa]">
                  <td className={cc + " text-slate-400"}>{i + 1}</td><td className={cc}>{p[0] || "—"}</td><td className={c}>{p[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === "zones" && (
        <div>
          <h3 className="mb-2 font-bold text-sm">Zones de livraison (Expédier vers)</h3>
          <div className="flex flex-wrap gap-2">
            {ZONES_LIVRAISON.map((z, i) => (
              <span key={i} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs">{z}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══ LES OBJECTIFS ═══ */
export function LesObjectifs() {
  const { orders, agents } = useStore();
  return (
    <div className="p-4" dir="ltr">
      <h2 className="mb-3 text-lg font-bold">🎯 LES OBJECTIFS</h2>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs max-w-3xl">
          <thead><tr><th className={thG}>Agent</th><th className={th}>Objectif CMD</th><th className={th}>Réalisé (livré)</th><th className={th}>Progression</th></tr></thead>
          <tbody>
            {agents.map((a) => {
              const liv = orders.filter((o: Order) => o.agent === a.name && o.livraison === "Livrée").length;
              const obj = 100;
              return (
                <tr key={a.name} className="odd:bg-white even:bg-[#f8f9fa]">
                  <td className={c + " font-semibold"}>{a.name}</td><td className={cc}>{obj}</td><td className={cc}>{liv}</td>
                  <td className={c}><div className="h-3 rounded bg-slate-100"><div className="h-3 rounded bg-emerald-500" style={{ width: `${Math.min(100, (liv / obj) * 100)}%` }} /></div><span className="text-[10px]">{pct(liv, obj)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ Agent sheet (Imane / SANAE) ═══ */
export function AgentSheet({ name }: { name: string }) {
  const { orders } = useStore();
  const rows = orders.filter((o: Order) => o.agent.toLowerCase() === name.toLowerCase());
  return (<div className="p-4"><h2 className="mb-3 text-lg font-bold" dir="ltr">👤 {name} ({rows.length})</h2><OrdersTable rows={rows} /></div>);
}

/* ═══ suivi confirmation ═══ */
export function SuiviConfirmation() {
  const { orders } = useStore();
  const rows = orders.filter((o: Order) => o.statut === "Confirmé" || o.statut === "Rappel" || o.statut === "Annulé");
  const stats = ["Confirmé", "Rappel", "Annulé"].map((s) => ({ s, n: orders.filter((o: Order) => o.statut === s).length }));
  return (
    <div className="p-4">
      <h2 className="mb-3 text-lg font-bold" dir="ltr">✅ suivi confirmation</h2>
      <div className="mb-4 flex gap-3" dir="ltr">
        {stats.map((x) => <div key={x.s} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"><b>{x.s}:</b> {x.n}</div>)}
      </div>
      <OrdersTable rows={rows} />
    </div>
  );
}

/* ═══ pièce ═══ */
export function Piece() {
  const { orders } = useStore();
  const rows = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o: Order) => { if (o.livraison === "Livrée" && o.produit) m.set(o.produit, (m.get(o.produit) || 0) + o.qte); });
    return [...m.entries()].map(([p, q]) => ({ p, q })).sort((a, b) => b.q - a.q);
  }, [orders]);
  const total = rows.reduce((s, r) => s + r.q, 0);
  return (
    <div className="p-4" dir="ltr">
      <h2 className="mb-3 text-lg font-bold">🧩 pièce — Total pièces sorties: {total}</h2>
      <div className="overflow-auto max-w-2xl">
        <table className="w-full border-collapse text-xs">
          <thead><tr><th className={thG}>Produit</th><th className={th}>Pièces sorties</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.p} className="odd:bg-white even:bg-[#f8f9fa]"><td className={c}>{r.p}</td><td className={cc + " font-bold"}>{r.q}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ RECLAMATION ═══ */
export function Reclamation() {
  const { orders } = useStore();
  const rows = orders.filter((o: Order) => o.remarques && (o.remarques.includes("?") || o.livraison === "Retour" || o.statut === "Annulé"));
  return (
    <div className="p-4" dir="ltr">
      <h2 className="mb-3 text-lg font-bold">⚠️ RECLAMATION ({rows.length})</h2>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead><tr><th className={th}>DATE</th><th className={thG}>Nom</th><th className={th}>Télephone</th><th className={th}>Ville</th><th className="border border-slate-400 bg-[#f1c232] px-2 py-1 text-[11px] font-bold">Remarques</th><th className={th}>Statut</th><th className={th}>Livraison</th><th className={th}>Agent</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="odd:bg-white even:bg-[#f8f9fa]">
                <td className={cc}>{o.dateCreation}</td><td className={c}>{o.nom}</td><td className={c}>{o.telephone}</td><td className={c}>{o.ville}</td>
                <td className={c + " bg-yellow-50"}>{o.remarques}</td>
                <td className={cc} style={{ background: o.statut === "Annulé" ? "#ffe4e6" : "" }}>{o.statut}</td>
                <td className={cc} style={{ background: o.livraison === "Retour" ? "#ffe4e6" : "" }}>{o.livraison}</td><td className={cc}>{o.agent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ statistique ═══ */
export function Statistique() {
  const { orders } = useStore();
  const byCity = useMemo(() => {
    const m = new Map<string, { t: number; liv: number; ca: number }>();
    orders.forEach((o: Order) => { if (!o.ville) return; const e = m.get(o.ville) || { t: 0, liv: 0, ca: 0 }; e.t++; if (o.livraison === "Livrée") { e.liv++; e.ca += o.prix; } m.set(o.ville, e); });
    return [...m.entries()].map(([v, x]) => ({ v, ...x })).sort((a, b) => b.t - a.t);
  }, [orders]);
  const byOrigin = useMemo(() => {
    const m = new Map<string, number>();
    orders.forEach((o: Order) => { const k = o.originLead || "—"; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].map(([o, n]) => ({ o, n })).sort((a, b) => b.n - a.n);
  }, [orders]);
  return (
    <div className="p-4 grid gap-5 lg:grid-cols-2" dir="ltr">
      <div>
        <h2 className="mb-3 text-lg font-bold">📈 statistique — Villes ({byCity.length})</h2>
        <div className="overflow-auto max-h-[500px]">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0"><tr><th className={thG}>Ville</th><th className={th}>CMD</th><th className={th}>Livrée</th><th className={thG}>CA</th></tr></thead>
            <tbody>{byCity.map((r) => <tr key={r.v} className="odd:bg-white even:bg-[#f8f9fa]"><td className={c}>{r.v}</td><td className={cc}>{r.t}</td><td className={cc + " text-emerald-700"}>{r.liv}</td><td className={cc + " font-bold"}>{fmt(r.ca)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-bold">Origin Lead</h2>
        <table className="w-full border-collapse text-xs max-w-sm">
          <thead><tr><th className={thG}>ORIGIN LEAD</th><th className={th}>CMD</th></tr></thead>
          <tbody>{byOrigin.map((r) => <tr key={r.o} className="odd:bg-white even:bg-[#f8f9fa]"><td className={c}>{r.o}</td><td className={cc + " font-bold"}>{r.n}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ suivi rentabilité ═══ */
export function SuiviRentabilite() {
  const { orders, agents } = useStore();
  return (
    <div className="p-4" dir="ltr">
      <h2 className="mb-3 text-lg font-bold">💰 suivi rentabilité</h2>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs max-w-4xl">
          <thead><tr><th className={thG}>Agent</th><th className={th}>CA (livré)</th><th className={th}>Commissions</th><th className={thG}>Net</th></tr></thead>
          <tbody>
            {agents.map((a) => {
              const liv = orders.filter((o: Order) => o.agent === a.name && o.livraison === "Livrée");
              const ca = liv.reduce((s: number, o: Order) => s + o.prix, 0);
              const comm = liv.reduce((s: number, o: Order) => s + o.commission, 0);
              return (
                <tr key={a.name} className="odd:bg-white even:bg-[#f8f9fa]">
                  <td className={c + " font-semibold"}>{a.name}</td>
                  <td className={cc + " font-bold text-emerald-700"}>{fmt(ca)} DH</td>
                  <td className={cc + " text-amber-600"}>{fmt(comm)} DH</td>
                  <td className={cc + " font-bold"}>{fmt(ca - comm)} DH</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ Blank editable sheet (Sheet129) ═══ */
export function BlankSheet({ name }: { name: string }) {
  return (
    <div className="p-4" dir="ltr">
      <h2 className="mb-3 text-lg font-bold">📄 {name}</h2>
      <div className="overflow-auto">
        <table className="border-collapse text-xs">
          <thead><tr><th className={th} style={{ width: 40 }}></th>{["A", "B", "C", "D", "E", "F", "G", "H"].map((l) => <th key={l} className={th} style={{ width: 120 }}>{l}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: 25 }).map((_, r) => (
              <tr key={r}>
                <td className="border border-slate-300 bg-slate-100 text-center text-slate-400">{r + 1}</td>
                {Array.from({ length: 8 }).map((__, ci) => <td key={ci} className="border border-slate-300 p-0"><input className="h-full w-full border-0 bg-transparent px-1 py-[3px] text-xs outline-none" /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
