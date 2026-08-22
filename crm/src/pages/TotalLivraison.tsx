import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useAuth } from "../auth";
import { usePeriod } from "../period";
import { useVilles, priceForCity } from "../data/villes";
import type { Order } from "../data/orders";
import CityInput from "../components/CityInput";

const nf = (n: number) => n.toLocaleString("fr-FR");
const rate = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

/* ───────── Donut chart ───────── */
function Donut({ livrees, echouees, encours }: { livrees: number; echouees: number; encours: number }) {
  const total = livrees + echouees + encours;
  const pct = total ? (livrees / total) * 100 : 0;
  const R = 70, C = 2 * Math.PI * R, gap = 6;
  const seg = (v: number) => (total ? (v / total) * (C - gap * 3) : 0);
  let offset = 0;
  const parts = [
    { v: livrees, color: "#22c55e" },
    { v: echouees, color: "#ef4444" },
    { v: encours, color: "#f59e0b" },
  ].map((p) => {
    const len = seg(p.v);
    const el = { ...p, len, offset };
    offset += len + gap;
    return el;
  });

  return (
    <div className="flex flex-col items-center">
      <svg width="190" height="190" viewBox="0 0 190 190">
        <g transform="rotate(-90 95 95)">
          <circle cx="95" cy="95" r={R} fill="none" stroke="#f1f5f9" strokeWidth="26" />
          {parts.filter((p) => p.v > 0).map((p, i) => (
            <circle key={i} cx="95" cy="95" r={R} fill="none" stroke={p.color} strokeWidth="26"
              strokeDasharray={`${p.len} ${C - p.len}`} strokeDashoffset={-p.offset} strokeLinecap="round" />
          ))}
        </g>
        <text x="95" y="90" textAnchor="middle" className="fill-emerald-500" style={{ fontSize: 30, fontWeight: 800 }}>{pct.toFixed(0)}%</text>
        <text x="95" y="112" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 13 }}>Livrées</text>
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Livrées</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-red-500" /> Échouées</span>
        <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> En cours</span>
      </div>
    </div>
  );
}

/* ───────── Line/area chart ───────── */
function AreaChart({ points, labels }: { points: number[]; labels: string[] }) {
  const W = 940, H = 260, PL = 42, PR = 12, PT = 14, PB = 30;
  const max = Math.max(5, ...points);
  const step = Math.ceil(max / 5) || 1;
  const top = step * 5;
  const x = (i: number) => PL + (i * (W - PL - PR)) / Math.max(1, points.length - 1);
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / top);

  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H - PB} L${PL},${H - PB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 620 }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const v = step * i, yy = y(v);
        return (
          <g key={i}>
            <line x1={PL} y1={yy} x2={W - PR} y2={yy} stroke="#eef2f7" strokeWidth="1" />
            <text x={PL - 8} y={yy + 4} textAnchor="end" style={{ fontSize: 11, fill: "#94a3b8" }}>{v}</text>
          </g>
        );
      })}
      <path d={area} fill="#3b82f6" fillOpacity="0.10" />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#3b82f6" />)}
      {labels.map((l, i) => (
        (points.length <= 8 || i % Math.ceil(points.length / 7) === 0 || i === points.length - 1) &&
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" style={{ fontSize: 11, fill: "#94a3b8" }}>{l}</text>
      ))}
    </svg>
  );
}

/* ───────── KPI card ───────── */
function Kpi({ label, value, sub, color, bg, onClick }: { label: string; value: string | number; sub?: string; color: string; bg: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-white p-4 ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md active:scale-[0.99]" : ""}`}
      title={onClick ? "Cliquez pour voir les commandes" : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: bg, color }}>{sub}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold" style={{ color }}>{value}</div>
    </div>
  );
}

/* ───────── Detail view: filtered orders (entièrement modifiable) ───────── */
const STATUT_OPTIONS = ["", "Confirmé", "Annulé", "Rappel", "Suivé", "Appel-1", "Appel-2", "Appel-3", "Appel-4", "Appel-5", "Appel-6", "Whatssap"];
const LIVRAISON_OPTIONS = ["", "Livrée", "Retour", "Out Of Stock", "Expédier vers"];

export function OrdersDetail({ title, color, list, onBack, readOnly = false }: { title: string; color: string; list: Order[]; onBack: () => void; readOnly?: boolean }) {
  const { upd, del } = useStore();
  const villes = useVilles();
  const [q, setQ] = useState("");
  const setField = (id: number, key: keyof Order, value: string) => {
    const numeric = ["qte", "prix", "upsell", "commission"].includes(key);
    upd(id, { [key]: numeric ? Number(value) || 0 : value } as Partial<Order>);
  };
  // Ville ➜ prix de livraison automatique (page LES VILLES)
  const setVille = (id: number, v: string) => {
    const prix = priceForCity(v, villes);
    upd(id, prix !== null ? { ville: v, commission: prix } : { ville: v });
  };
  const rows = list.filter((o) => {
    const s = q.trim().toLowerCase();
    return !s || [o.nom, o.telephone, o.ville, o.produit, o.adresse, o.remarques, o.statut, o.livraison].join(" ").toLowerCase().includes(s);
  });
  const ca = rows.filter((o) => o.livraison === "Livrée").reduce((a, o) => a + o.prix, 0);
  const qte = rows.reduce((a, o) => a + o.qte, 0);
  const th = "border border-slate-300 bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-700 whitespace-nowrap";
  const td = "border border-slate-200 px-2 py-1.5 text-xs";

  const rowBg = (o: Order, i: number) =>
    o.livraison === "Livrée" ? "#dcfce7" :
    o.livraison === "Retour" ? "#fee2e2" :
    o.livraison === "Out Of Stock" ? "#dbeafe" :
    o.livraison === "Expédier vers" || o.livraison === "Expédié" ? "#ffedd5" :
    o.statut === "Annulé" ? "#fee2e2" :
    o.statut === "Rappel" ? "#fef9c3" :
    i % 2 ? "#f8fafc" : "#ffffff";

  return (
    <div dir="ltr" className="flex h-full flex-col bg-slate-50">
      <datalist id="villes-list-detail">
        {villes.map((v) => <option key={v.nom} value={v.nom}>{v.prix} DH</option>)}
      </datalist>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          ← Retour
        </button>
        <h3 className="text-base font-bold" style={{ color }}>{title}</h3>
        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: color }}>{rows.length} commandes</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
        {readOnly
          ? <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">🔒 Lecture seule</span>
          : <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">✏️ Modification complète</span>}
        <span className="ml-auto text-xs text-slate-600">Qte: <b>{nf(qte)}</b> · CA livré: <b>{nf(ca)} DH</b></span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse bg-white">
          <thead className="sticky top-0 z-10">
            <tr>
              {["#", "DATE", "Statut", "Nom & Prénom", "Téléphone", "Ville", "Adresse", "Qte", "Prix", "Produit", "Livraison", "Remarques", ...(readOnly ? [] : ["🗑️"])].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((o, i) => {
              const bg = rowBg(o, i);
              const cell = "w-full border-0 bg-transparent px-2 py-1.5 text-xs outline-none focus:bg-white/80";
              const ro = td + " whitespace-nowrap";

              if (readOnly) {
                return (
                  <tr key={o.id} style={{ background: bg }}>
                    <td className={td + " text-center text-slate-400"}>{i + 1}</td>
                    <td className={ro}>{o.dateCreation || "—"}</td>
                    <td className={ro + " font-medium"}>{o.statut || "—"}</td>
                    <td className={td + " font-medium"}>{o.nom || "—"}</td>
                    <td className={ro}>
                      {o.telephone
                        ? <a href={`https://wa.me/${o.telephone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">{o.telephone} 💬</a>
                        : "—"}
                    </td>
                    <td className={td}>{o.ville || "—"}</td>
                    <td className={td}>{o.adresse || "—"}</td>
                    <td className={td + " text-center"}>{o.qte}</td>
                    <td className={td + " text-center font-bold"}>{o.prix}</td>
                    <td className={td}>{o.produit || "—"}</td>
                    <td className={ro + " font-medium"}>{o.livraison || "—"}</td>
                    <td className={td + " text-slate-600"}>{o.remarques || "—"}</td>
                  </tr>
                );
              }

              return (
                <tr key={o.id} style={{ background: bg }}>
                  <td className={td + " text-center text-slate-400"}>{i + 1}</td>
                  <td className={td + " p-0"}><input type="date" value={o.dateCreation} onChange={(e) => setField(o.id, "dateCreation", e.target.value)} className={cell} /></td>
                  <td className={td + " p-0"}>
                    <select value={o.statut} onChange={(e) => setField(o.id, "statut", e.target.value)} className={cell + " cursor-pointer font-medium"} title="La commande sera déplacée automatiquement">
                      {STATUT_OPTIONS.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
                    </select>
                  </td>
                  <td className={td + " p-0"}><input value={o.nom} onChange={(e) => setField(o.id, "nom", e.target.value)} className={cell + " font-medium"} /></td>
                  <td className={td + " p-0"}>
                    <div className="flex items-center">
                      <input value={o.telephone} onChange={(e) => setField(o.id, "telephone", e.target.value)} className={cell + " min-w-0 flex-1"} />
                      {o.telephone && <a href={`https://wa.me/${o.telephone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="shrink-0 px-1 text-emerald-700">💬</a>}
                    </div>
                  </td>
                  <td className={td + " p-0"}>
                    <CityInput value={o.ville} onChange={(city) => setVille(o.id, city)}
                      className={cell} style={{ background: bg }} />
                  </td>
                  <td className={td + " p-0"}><input value={o.adresse} onChange={(e) => setField(o.id, "adresse", e.target.value)} className={cell} /></td>
                  <td className={td + " p-0"}><input type="number" value={o.qte} onChange={(e) => setField(o.id, "qte", e.target.value)} className={cell + " text-center"} /></td>
                  <td className={td + " p-0"}><input type="number" value={o.prix} onChange={(e) => setField(o.id, "prix", e.target.value)} className={cell + " text-center font-bold"} /></td>
                  <td className={td + " p-0"}><input value={o.produit} onChange={(e) => setField(o.id, "produit", e.target.value)} className={cell} /></td>
                  <td className={td + " p-0"}>
                    <select value={o.livraison} onChange={(e) => setField(o.id, "livraison", e.target.value)} className={cell + " cursor-pointer font-medium"} title="La commande sera déplacée automatiquement">
                      {LIVRAISON_OPTIONS.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
                    </select>
                  </td>
                  <td className={td + " p-0"}><input value={o.remarques} onChange={(e) => setField(o.id, "remarques", e.target.value)} className={cell + " text-slate-600"} /></td>
                  <td className={td + " text-center"}>
                    <button onClick={() => confirm("Supprimer cette commande ?") && del(o.id)} className="text-red-600 hover:text-red-800">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="py-16 text-center text-slate-400">Aucune commande dans cette catégorie</p>}
      </div>
    </div>
  );
}

type DetailKey = null | { title: string; color: string; fn: (o: Order) => boolean; readOnly?: boolean };

export default function TotalLivraison({ agent }: { agent: string }) {
  const { orders } = useStore();
  const { currentUser } = useAuth();
  const isAdminUser = currentUser?.role === "admin";
  const { inRange, label } = usePeriod();
  const [days, setDays] = useState(7);
  const [topAll, setTopAll] = useState(false);
  const [detail, setDetail] = useState<DetailKey>(null);

  const mine = useMemo(
    () => orders.filter((o: Order) => o.agent.toLowerCase() === agent.toLowerCase() && inRange(o.dateCreation)),
    [orders, agent, inRange]
  );

  // readOnly = true → page en lecture seule (aucune modification / suppression)
  const open = (title: string, color: string, fn: (o: Order) => boolean, readOnly = false) =>
    () => setDetail({ title, color, fn, readOnly: readOnly && !isAdminUser }); // 🛡️ الأدمين عندو كل الصلاحيات

  const s = useMemo(() => {
    const count = (fn: (o: Order) => boolean) => mine.filter(fn).length;
    const total = mine.length;
    const confirme = count((o) => o.statut === "Confirmé");
    const annule = count((o) => o.statut === "Annulé");
    const rappel = count((o) => o.statut === "Rappel");
    const livree = count((o) => o.livraison === "Livrée");
    const retour = count((o) => o.livraison === "Retour");
    const expedier = count((o) => o.livraison === "Expédier vers" || o.livraison === "Expédié");
    const oos = count((o) => o.livraison === "Out Of Stock");
    const ca = mine.filter((o) => o.livraison === "Livrée").reduce((a, o) => a + o.prix, 0);
    const pieces = mine.filter((o) => o.livraison === "Livrée").reduce((a, o) => a + o.qte, 0);
    const appels = [1, 2, 3, 4, 5, 6].map((n) => ({
      label: `Appel-${n}`,
      value: count((o) => o.statut === `Appel-${n}`),
    }));
    const whatssap = count((o) => o.statut === "Whatssap");
    const suive = count((o) => o.statut === "Suivé");
    return { total, confirme, annule, rappel, livree, retour, expedier, oos, ca, pieces, appels, whatssap, suive };
  }, [mine]);

  // Évolution des expéditions
  const { points, labels } = useMemo(() => {
    const today = new Date();
    const pts: number[] = [], lbs: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      pts.push(mine.filter((o) => o.dateCreation === key).length);
      lbs.push(`${key.slice(8, 10)}/${key.slice(5, 7)}`);
    }
    return { points: pts, labels: lbs };
  }, [mine, days]);

  // Top produits vendus
  const top = useMemo(() => {
    const map = new Map<string, { qty: number; liv: number; tot: number }>();
    mine.forEach((o) => {
      if (!o.produit) return;
      const e = map.get(o.produit) || { qty: 0, liv: 0, tot: 0 };
      e.tot += 1;
      if (o.livraison === "Livrée") { e.qty += o.qte; e.liv += 1; }
      map.set(o.produit, e);
    });
    const list = [...map.entries()]
      .map(([name, v]) => ({ name, ventes: v.qty, pct: rate(v.liv, v.tot) }))
      .sort((a, b) => b.ventes - a.ventes);
    return topAll ? list : list.slice(0, 5);
  }, [mine, topAll]);
  const maxVentes = Math.max(1, ...top.map((t) => t.ventes));

  const statuses = [
    { label: "Livrées", value: s.livree, cls: "bg-emerald-50 text-emerald-700", icon: "✓", color: "#059669", fn: (o: Order) => o.livraison === "Livrée", ro: true },
    { label: "Expédier vers", value: s.expedier, cls: "bg-orange-50 text-orange-700", icon: "🚚", color: "#ea580c", fn: (o: Order) => o.livraison === "Expédier vers" || o.livraison === "Expédié", ro: false },
    { label: "En cours", value: s.total - s.livree - s.retour - s.expedier - s.oos, cls: "bg-amber-50 text-amber-700", icon: "🕐", color: "#ca8a04", fn: (o: Order) => !o.livraison, ro: false },
    { label: "Out Of Stock", value: s.oos, cls: "bg-blue-50 text-blue-700", icon: "⊗", color: "#2563eb", fn: (o: Order) => o.livraison === "Out Of Stock", ro: true },
    { label: "Retour", value: s.retour, cls: "bg-red-50 text-red-700", icon: "⊗", color: "#dc2626", fn: (o: Order) => o.livraison === "Retour", ro: false },
  ];

  if (detail) {
    return <OrdersDetail title={detail.title} color={detail.color} list={mine.filter(detail.fn)} onBack={() => setDetail(null)} readOnly={detail.readOnly} />;
  }

  return (
    <div dir="ltr" className="h-full overflow-auto bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
        <span className="text-sm">⏱</span>
        <span className="text-xs font-bold text-orange-800">الفترة: {label}</span>
        <span className="text-xs text-orange-600">— كل الأرقام محسوبة على هاد الفترة</span>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total commandes" value={nf(s.total)} sub="CMD" color="#0f172a" bg="#e2e8f0" onClick={open("Total commandes", "#0f172a", () => true, true)} />
        <Kpi label="Confirmées" value={nf(s.confirme)} sub={`${rate(s.confirme, s.total).toFixed(1)}%`} color="#16a34a" bg="#dcfce7" onClick={open("Commandes confirmées", "#16a34a", (o) => o.statut === "Confirmé")} />
        <Kpi label="Livrées" value={nf(s.livree)} sub={`${rate(s.livree, s.livree + s.retour).toFixed(1)}%`} color="#059669" bg="#d1fae5" onClick={open("Commandes livrées", "#059669", (o) => o.livraison === "Livrée", true)} />
        <Kpi label="Retour" value={nf(s.retour)} sub={`${rate(s.retour, s.livree + s.retour).toFixed(1)}%`} color="#dc2626" bg="#fee2e2" onClick={open("Commandes retour", "#dc2626", (o) => o.livraison === "Retour")} />
        <Kpi label="Annulées" value={nf(s.annule)} sub={`${rate(s.annule, s.total).toFixed(1)}%`} color="#e11d48" bg="#ffe4e6" onClick={open("Commandes annulées", "#e11d48", (o) => o.statut === "Annulé")} />
        <Kpi label="Rappel" value={nf(s.rappel)} sub={`${rate(s.rappel, s.total).toFixed(1)}%`} color="#ca8a04" bg="#fef9c3" onClick={open("Commandes Rappel", "#ca8a04", (o) => o.statut === "Rappel")} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Expédier vers" value={nf(s.expedier)} sub={`${rate(s.expedier, s.total).toFixed(1)}%`} color="#ea580c" bg="#ffedd5" onClick={open("Commandes Expédier vers", "#ea580c", (o) => o.livraison === "Expédier vers" || o.livraison === "Expédié")} />
        <Kpi label="Out Of Stock" value={nf(s.oos)} sub={`${rate(s.oos, s.total).toFixed(1)}%`} color="#2563eb" bg="#dbeafe" onClick={open("Commandes Out Of Stock", "#2563eb", (o) => o.livraison === "Out Of Stock", true)} />
        <Kpi label="Pièces sorties" value={nf(s.pieces)} sub="Qte" color="#7c3aed" bg="#ede9fe" onClick={open("Pièces sorties (livrées)", "#7c3aed", (o) => o.livraison === "Livrée", true)} />
        <Kpi label="Chiffre d'affaire" value={`${nf(s.ca)} DH`} sub="CA" color="#0f766e" bg="#ccfbf1" onClick={open("Chiffre d'affaire (livrées)", "#0f766e", (o) => o.livraison === "Livrée", true)} />
      </div>

      {/* Statuts d'appel */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Statuts (Appels & Whatssap)</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Total: {nf(s.appels.reduce((a, x) => a + x.value, 0) + s.whatssap + s.suive)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          {s.appels.map((a) => (
            <Kpi key={a.label} label={a.label} value={nf(a.value)} sub={`${rate(a.value, s.total).toFixed(1)}%`} color="#7c3aed" bg="#ede9fe"
              onClick={open(`Commandes ${a.label}`, "#7c3aed", (o) => o.statut === a.label)} />
          ))}
          <Kpi label="Whatssap" value={nf(s.whatssap)} sub={`${rate(s.whatssap, s.total).toFixed(1)}%`} color="#16a34a" bg="#dcfce7" onClick={open("Commandes Whatssap", "#16a34a", (o) => o.statut === "Whatssap")} />
          <Kpi label="Suivé" value={nf(s.suive)} sub={`${rate(s.suive, s.total).toFixed(1)}%`} color="#0284c7" bg="#e0f2fe" onClick={open("Commandes Suivé", "#0284c7", (o) => o.statut === "Suivé")} />
        </div>
      </div>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">Évolution des expéditions</h3>
            <div className="flex overflow-hidden rounded-lg border border-slate-200">
              {[7, 15, 30].map((d) => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-3 py-1.5 text-xs font-medium transition ${days === d ? "bg-emerald-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {d} Jours
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto"><AreaChart points={points} labels={labels} /></div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-2 text-base font-semibold text-slate-800">Taux de livraison</h3>
          <Donut livrees={s.livree} echouees={s.retour} encours={s.expedier + s.oos} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">Top {topAll ? "" : "5 "}produits vendus</h3>
            <button onClick={() => setTopAll(!topAll)} className="rounded-full border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
              {topAll ? "Top 5" : "Tous"}
            </button>
          </div>
          <div className="space-y-3">
            {top.map((p, i) => (
              <div key={p.name} onClick={open(`Produit: ${p.name}`, "#2563eb", (o) => o.produit === p.name)}
                className="flex cursor-pointer items-center gap-3 rounded-lg p-1 transition hover:bg-slate-50">
                <span className="w-4 shrink-0 text-xs text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-blue-700" title={p.name}>{p.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{p.ventes} ventes</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${(p.ventes / maxVentes) * 100}%` }} />
                  </div>
                </div>
                <span className="w-11 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[11px] font-bold text-slate-600">{p.pct.toFixed(0)}%</span>
              </div>
            ))}
            {!top.length && <p className="py-6 text-center text-sm text-slate-400">Aucun produit</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-base font-semibold text-slate-800">Statuts livraisons</h3>
          <div className="space-y-2.5">
            {statuses.map((st) => (
              <div key={st.label} onClick={open(`Commandes ${st.label}`, st.color, st.fn, st.ro)}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition hover:brightness-95 active:scale-[0.99] ${st.cls}`}>
                <span className="flex items-center gap-2">{st.icon} {st.label}</span>
                <b>{nf(Math.max(0, st.value))}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
