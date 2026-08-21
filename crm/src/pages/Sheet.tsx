import { useCallback, useMemo, useState } from "react";
import { useStore, exportCSV } from "../store";
import { ORIGIN_OPTIONS, type Order } from "../data/orders";
import DualScroll from "../components/DualScroll";
import { usePeriod } from "../period";
import { useVilles } from "../data/villes";
import ImportExcel from "./ImportExcel";
import CityInput from "../components/CityInput";
import Btn from "../components/Btn";
import { buildDupIndex, dupGroups } from "../data/duplicates";

const fmt = (n: number) => n.toLocaleString("fr-FR");

/* ═══════════ Create Filters (comme Google Sheets) ═══════════ */
type Op = "eq" | "neq" | "contains" | "ncontains" | "empty" | "notEmpty" | "today";
type Cond = { id: number; field: keyof Order; op: Op; value: string };

const OPS: { key: Op; label: string }[] = [
  { key: "eq", label: "= يساوي" },
  { key: "neq", label: "≠ ماشي" },
  { key: "contains", label: "🔍 يحتوي" },
  { key: "ncontains", label: "🚫 لا يحتوي" },
  { key: "empty", label: "␀ فاضي" },
  { key: "notEmpty", label: "▣ عامر" },
  { key: "today", label: "📅 هو اليوم" },
];
const OPS_DATE: { key: Op; label: string }[] = [
  { key: "eq", label: "= يساوي" },
  { key: "neq", label: "≠ ماشي" },
  { key: "today", label: "📅 هو اليوم" },
];
const needsValue = (op: Op) => op !== "empty" && op !== "notEmpty" && op !== "today";

/* ⚡ فلاتر سريعة (Presets) */
const PRESETS: { label: string; conds: Omit<Cond, "id">[] }[] = [
  { label: "📦 طلبيات اليوم", conds: [{ field: "dateCreation", op: "today", value: "" }] },
  { label: "🚚 لديجيلوك (Confirmé · بلا Livrée · بلا Expédier)", conds: [
    { field: "statut", op: "eq", value: "Confirmé" },
    { field: "livraison", op: "neq", value: "Livrée" },
    { field: "livraison", op: "neq", value: "Expédier vers" },
  ] },
  { label: "✅ Confirmé", conds: [{ field: "statut", op: "eq", value: "Confirmé" }] },
  { label: "↩️ Retour", conds: [{ field: "livraison", op: "eq", value: "Retour" }] },
  { label: "❌ Annulé", conds: [{ field: "statut", op: "eq", value: "Annulé" }] },
  { label: "📦 Livrée", conds: [{ field: "livraison", op: "eq", value: "Livrée" }] },
];

function Cell({ val, onChange, w, bg, type = "text", opts, list, strike = "none" }: { val: string | number; onChange: (v: string) => void; w: number; bg?: string; type?: string; opts?: string[]; list?: string; strike?: string }) {
  const style = { minWidth: w, background: bg || "" };
  if (opts) return (
    <td style={style} className="border border-slate-300 p-0">
      <select value={String(val)} onChange={(e) => onChange(e.target.value)} className="h-full w-full border-0 bg-transparent px-1 py-[3px] text-xs font-semibold outline-none" style={{ background: bg || "", textDecoration: strike }}>
        {opts.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </td>
  );
  return (
    <td style={style} className="border border-slate-300 p-0">
      <input type={type} list={list} value={val} onChange={(e) => onChange(e.target.value)} className="h-full w-full border-0 bg-transparent px-1 py-[3px] text-xs outline-none" style={{ background: bg || "", textDecoration: strike }} />
    </td>
  );
}

export default function Sheet() {
  const { orders: allOrders, agentNames, gs, upd, add, del, reset, saveCheckpoint, savedAt, savedCount } = useStore();
  const { inRange, label } = usePeriod();
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [conds, setConds] = useState<Cond[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState("");

  /* ── Filtres par colonne (style Google Sheets) ── */
  const [colSel, setColSel] = useState<Record<string, string[]>>({}); // champ → valeurs autorisées
  const [menu, setMenu] = useState<{ field: keyof Order; x: number; y: number } | null>(null);
  const [menuQ, setMenuQ] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showDups, setShowDups] = useState(false);

  /* فلتر مفعّل؟ + زر الإيقاف */
  const filtersActive = conds.length > 0 || Object.keys(colSel).length > 0 || q.trim().length > 0;
  const stopAllFilters = () => {
    setConds([]);
    setColSel({});
    setQ("");
    setSel(new Set());
    setMenu(null);
  };

  /* Champs filtrables — 6 champs essentiels */
  const FIELDS = useMemo<{ key: keyof Order; label: string; type: "date" | "select" | "text" | "num"; options?: string[] }[]>(() => [
    { key: "dateCreation", label: "📅 Date", type: "date" },
    { key: "statut", label: "🏷️ Statut", type: "select", options: ["", "Confirmé", "Annulé", "Rappel", "Suivé", "Appel-1", "Appel-2", "Appel-3", "Appel-4", "Appel-5", "Appel-6", "Whatssap"] },
    { key: "livraison", label: "🚚 Suivie", type: "select", options: ["", "Livrée", "Retour", "Out Of Stock", "Expédier vers"] },
    { key: "telephone", label: "📞 Téléphone", type: "text" },
    { key: "ville", label: "🏙️ Ville", type: "text" },
    { key: "produit", label: "📦 Produit", type: "text" },
  ], []);
  const fieldDef = (f: keyof Order) => FIELDS.find((x) => x.key === f);

  // Catalogue produits (géré depuis la page PRODUITS)
  const catalog: { nom: string; link: string; prix: string }[] = useMemo(() => {
    try {
      const s = localStorage.getItem("afrizon_catalog_v1");
      if (s) return JSON.parse(s);
    } catch { /* */ }
    return [];
  }, []);

  const orders = useMemo(() => allOrders.filter((o: Order) => inRange(o.dateCreation)), [allOrders, inRange]);

  /* 🚨 فهرس المكررات (على كل الطلبيات — حتى خارج الفترة) */
  const dupIdx = useMemo(() => buildDupIndex(allOrders), [allOrders]);
  const dupGrps = useMemo(() => dupGroups(dupIdx), [dupIdx]);

  // Villes de livraison (page LES VILLES) — prix de livraison automatique
  const villes = useVilles();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders.filter((o: Order) => {
      if (s && ![o.nom, o.telephone, o.ville, o.produit, o.adresse, o.remarques, o.agent, o.statut, o.livraison, o.originLead].join(" ").toLowerCase().includes(s)) return false;
      // ── filtres par colonne (style Google Sheets) ──
      const colPass = Object.entries(colSel).every(([f, allowed]) =>
        allowed.includes(String((o as unknown as Record<string, unknown>)[f] ?? "")));
      if (!colPass) return false;
      // ── conditions du filtre (AND) ──
      return conds.every((cond) => {
        const def = fieldDef(cond.field);
        const raw = String((o as unknown as Record<string, unknown>)[cond.field] ?? "");
        const v = cond.value.trim().toLowerCase();
        const isNum = def?.type === "num";
        const isDate = def?.type === "date";
        switch (cond.op) {
          case "eq": return isDate ? raw.slice(0, 10) === cond.value : isNum ? Number(raw) === Number(cond.value) : raw.trim().toLowerCase() === v;
          case "neq": return isDate ? raw.slice(0, 10) !== cond.value : isNum ? Number(raw) !== Number(cond.value) : raw.trim().toLowerCase() !== v;
          case "contains": return raw.toLowerCase().includes(v);
          case "ncontains": return !raw.toLowerCase().includes(v);
          case "empty": return raw.trim() === "";
          case "notEmpty": return raw.trim() !== "";
          case "today": return raw.slice(0, 10) === new Date().toISOString().slice(0, 10);
          default: return true;
        }
      });
    });
  }, [orders, q, conds, colSel, FIELDS]);

  /* ── Helpers filtres par colonne ── */
  const valuesOf = (field: keyof Order) => {
    const m = new Map<string, number>();
    orders.forEach((o) => {
      const v = String((o as unknown as Record<string, unknown>)[field] ?? "");
      m.set(v, (m.get(v) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0], "fr")));
  };
  const toggleColVal = (field: string, val: string) => {
    setColSel((p) => {
      const list = valuesOf(field as keyof Order).map(([v]) => v);
      const cur = p[field] ?? list;
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { ...p, [field]: next };
    });
  };
  const selectAllCol = (field: string, on: boolean) => {
    setColSel((p) => {
      const c = { ...p };
      if (on) delete c[field];
      else c[field] = [];
      return c;
    });
  };
  const isColFiltered = (field: string) => colSel[field] !== undefined;
  const openMenu = (e: React.MouseEvent, field: keyof Order) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuQ("");
    setMenu((m) => (m?.field === field ? null : { field, x: r.left, y: r.bottom + 4 }));
  };

  /* En-tête de colonne avec bouton filtre (style Google Sheets) */
  const FTh = ({ label, field, cls, w }: { label: string; field: keyof Order; cls: string; w?: number }) => (
    <th className={cls} style={w ? { width: w } : undefined}>
      <div className="flex items-center justify-center gap-0.5">
        <span className="truncate">{label}</span>
        <button
          onClick={(e) => { e.stopPropagation(); openMenu(e, field); }}
          title={`فلتر ${label} (بحال Google Sheets)`}
          className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] text-[7px] leading-none transition ${
            isColFiltered(String(field)) ? "bg-amber-400 text-white shadow" : "bg-white/20 text-white/80 hover:bg-white/40"
          }`}
        >▼</button>
      </div>
    </th>
  );

  /* ── Sélection multiple ── */
  const toggleSel = (id: number) => setSel((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const allSel = filtered.length > 0 && filtered.every((o) => sel.has(o.id));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(filtered.map((o) => o.id)));
  const selOrders = filtered.filter((o) => sel.has(o.id));

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(""), 3500); };
  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
  };

  /* نسخ جاهز للصق في ديجيلوك / Excel */
  const copyDigylock = async () => {
    const list = selOrders;
    if (!list.length) return;
    const header = "Nom\tTéléphone\tVille\tAdresse\tProduit\tQte\tPrix\tAgent";
    const rows = list.map((o) => [o.nom, o.telephone, o.ville, o.adresse, o.produit, o.qte, o.prix, o.agent].join("\t"));
    await copyText([header, ...rows].join("\n"));
    showToast(`✅ تنسخو ${list.length} طلبية — درك Ctrl+V فـ ديجيلوك`);
  };
  const copyFull = async () => {
    const list = selOrders;
    if (!list.length) return;
    const H = ["DATE", "date", "Statut", "Remarques", "ID", "Nom", "Téléphone", "Ville", "Adresse", "Qte", "Prix", "Produit", "Livraison", "UPSEL", "Agent", "ORIGIN", "commision"];
    const rows = list.map((o) => [o.dateCreation, o.dateConfirmation, o.statut, o.remarques, o.idCmd, o.nom, o.telephone, o.ville, o.adresse, o.qte, o.prix, o.produit, o.livraison, o.upsell, o.agent, o.originLead, o.commission].join("\t"));
    await copyText([H.join("\t"), ...rows].join("\n"));
    showToast(`✅ تنسخو ${list.length} طلبية بجميع الخانات`);
  };

  const applyPreset = (arr: Omit<Cond, "id">[]) => {
    setConds(arr.map((c, i) => ({ ...c, id: Date.now() + i })));
    setShowFilters(true);
    setSel(new Set());
  };

  const kpi = useMemo(() => {
    const conf = orders.filter((o: Order) => o.statut === "Confirmé");
    const liv = orders.filter((o: Order) => o.livraison === "Livrée");
    const ret = orders.filter((o: Order) => o.livraison === "Retour");
    const ann = orders.filter((o: Order) => o.statut === "Annulé");
    const ca = liv.reduce((s: number, o: Order) => s + o.prix, 0);
    const pcs = liv.reduce((s: number, o: Order) => s + o.qte, 0);
    return {
      cmd: orders.length, conf: conf.length, liv: liv.length, ret: ret.length, ann: ann.length, ca, pcs,
      confRate: orders.length ? ((conf.length / orders.length) * 100).toFixed(2) + "%" : "0%",
      livRate: liv.length + ret.length ? ((liv.length / (liv.length + ret.length)) * 100).toFixed(2) + "%" : "0%",
    };
  }, [orders]);

  const agentRows = useMemo(() => agentNames.map((name) => {
    const list = orders.filter((o) => o.agent.toLowerCase() === name.toLowerCase());
    const confirme = list.filter((o) => o.statut === "Confirmé").length;
    const rappel = list.filter((o) => o.statut === "Rappel").length;
    const annule = list.filter((o) => o.statut === "Annulé").length;
    const livre = list.filter((o) => o.livraison === "Livrée").length;
    const retour = list.filter((o) => o.livraison === "Retour").length;
    const expedierVers = list.filter((o) => o.livraison === "Expédier vers").length;
    const whatssap = list.filter((o) => o.statut === "Whatssap" || o.originLead.toLowerCase() === "whatssap").length;
    const upsell = list.reduce((sum, o) => sum + o.upsell, 0);
    return {
      name, confirme, rappel, annule, livre, retour, expedierVers, whatssap, upsell, carousell: 0,
      confRate: list.length ? ((confirme / list.length) * 100).toFixed(2) + "%" : "0%",
      livrRate: livre + retour ? ((livre / (livre + retour)) * 100).toFixed(2) + "%" : "0%",
      rateTotale: list.length ? ((livre / list.length) * 100).toFixed(2) + "%" : "0%",
    };
  }), [orders, agentNames]);

  const ch = useCallback((id: number, key: keyof Order, val: string) => {
    const nums: (keyof Order)[] = ["qte", "prix", "commission", "upsell"];
    upd(id, { [key]: nums.includes(key) ? Number(val) || 0 : val } as Partial<Order>);
  }, [upd]);

  const addRow = () => add({
    dateCreation: new Date().toISOString().slice(0, 10), dateConfirmation: new Date().toISOString().slice(0, 10),
    statut: "", remarques: "", idCmd: "1", nom: "", telephone: "", ville: "", adresse: "",
    qte: 1, prix: 0, produit: "", livraison: "", upsell: 0, carousell: "",
    agent: "", link: "", carosellFlag: "", originLead: "", commission: 35, fees: "",
  });

  const th = (bg: string) => `border border-slate-400 ${bg} text-white px-1 py-1 text-[11px] font-bold text-center whitespace-nowrap`;
  const B = th("bg-[#4a86c8]"), G = th("bg-[#6aa84f]"), Y = `border border-slate-400 bg-[#f1c232] text-slate-800 px-1 py-1 text-[11px] font-bold text-center whitespace-nowrap`, R = th("bg-[#cc0000]"), D = th("bg-[#999]");
  const c = "border border-slate-300 px-1 py-[2px] text-center";

  return (
    <div dir="ltr" className="flex h-full flex-col bg-white text-xs text-slate-800">
      {/* Liste des produits du catalogue (auto-complétion + prix auto) */}
      <datalist id="catalog-products">
        {catalog.map((p) => <option key={p.nom} value={p.nom} />)}
      </datalist>
      {/* Liste des villes (auto-complétion + prix livraison auto) */}
      <datalist id="villes-list">
        {villes.map((v) => <option key={v.nom} value={v.nom}>{v.prix} DH</option>)}
      </datalist>
      {/* Toolbar — أزرار احترافية */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-3 py-2 shadow-sm">
        <div className="flex shrink-0 items-center gap-2 border-e border-slate-200 pe-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-base text-white shadow-md shadow-indigo-200">📋</span>
          <b className="text-sm font-extrabold tracking-tight text-slate-800">Paraveda</b>
        </div>
        <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
          <span className="pointer-events-none absolute inset-y-0 start-2 grid place-items-center text-xs text-slate-400">🔎</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث..."
            className="w-full rounded-xl border border-slate-200 bg-white py-[7px] pe-2 ps-7 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <Btn icon="🧮" color="violet" variant={showFilters || conds.length ? "solid" : "ghost"}
          onClick={() => setShowFilters((v) => !v)} title="إنشاء فلتر خاص (بحال Google Sheets)">
          Create Filter{conds.length ? ` (${conds.length})` : ""}
        </Btn>
        <Btn icon="＋" color="blue" onClick={addRow} title="إضافة سطر جديد">Ligne</Btn>
        <Btn icon="📥" color="teal" onClick={() => setShowImport(true)} title="رفع طلبيات من ملف Excel / CSV">Import Excel</Btn>
        <Btn icon="🚨" color="red" variant={dupGrps.length ? "solid" : "ghost"} pulse={dupGrps.length > 0}
          onClick={() => setShowDups(true)} title="الطلبيات المكررة (نفس الرقم ولا العنوان)">
          Duplicates{dupGrps.length ? ` (${dupGrps.length})` : ""}
        </Btn>
        {filtersActive && (
          <Btn icon="⏹" color="red" variant="ghost" onClick={stopAllFilters} title="إيقاف كل الفلاتر والرجوع لكل الطلبيات">
            إيقاف الفلتر
          </Btn>
        )}
        <span className="h-6 w-px shrink-0 bg-slate-200" />
        <Btn icon="📥" color="teal" variant="ghost" onClick={() => exportCSV(orders as unknown as Record<string, unknown>[], "afrizon")} title="تصدير CSV">CSV</Btn>
        <Btn icon="💾" color="slate" variant="ghost" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(orders, null, 2)])); a.download = "backup.json"; a.click(); }} title="نسخة احتياطية JSON">JSON</Btn>
        <span className="h-6 w-px shrink-0 bg-slate-200" />
        <Btn icon="💾" color="emerald" onClick={() => { const n = saveCheckpoint(); alert(`✅ تم الحفظ\n${n} طلبية محفوظة.\nزر Reset غادي يرجع لهاد النقطة.`); }} title="حفظ الوضع الحالي كنقطة استرجاع">Save CMD</Btn>
        <Btn icon="↺" color="red" variant="ghost" onClick={() => confirm(savedAt ? `الرجوع لآخر حفظ (${savedCount} طلبية)؟` : "ما كاين حتى حفظ — الرجوع للبيانات الأصلية؟") && reset()}
          title={savedAt ? `آخر حفظ: ${new Date(savedAt).toLocaleString("fr-FR")}` : "ما كاين حتى حفظ"}>Reset</Btn>
        {savedAt && <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">✓ {savedCount} · {new Date(savedAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
        <span className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">⏱ {label}</span>
        <span className="ms-auto text-slate-500 text-[10px]">{orders.length} lignes · CA {fmt(kpi.ca)} DH</span>
      </div>

      {/* ══ Panneau Create Filter (pro) ══ */}
      {showFilters && (
        <div className="shrink-0 border-b border-indigo-100 bg-white shadow-sm" dir="rtl">
          {/* en-tête */}
          <div className="flex flex-wrap items-center gap-2 px-3 pt-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs text-white shadow-sm">🧮</span>
            <b className="text-xs font-extrabold tracking-tight text-slate-800">Filtres — تصفية الطلبيات</b>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${conds.length ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
              {conds.length ? `${conds.length} ${conds.length === 1 ? "شرط" : "شروط"} مفعّلة` : "بلا شروط"}
            </span>
            <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {filtered.length} / {orders.length} طلبية
            </span>
            <button onClick={() => setShowFilters(false)} className="ms-auto grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" title="إخفاء">✕</button>
          </div>

          {/* presets */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 px-3">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">سريع</span>
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p.conds)}
                className="rounded-full border border-indigo-200 bg-indigo-50/60 px-3 py-1 text-[10px] font-bold text-indigo-700 transition-all hover:border-indigo-400 hover:bg-indigo-100 active:scale-[0.97]">
                {p.label}
              </button>
            ))}
          </div>

          {/* conditions */}
          {conds.length > 0 && (
            <div className="mt-2.5 space-y-1.5 border-t border-slate-100 px-3 pt-2.5">
              {conds.map((c, i) => {
                const def = fieldDef(c.field);
                const isDate = def?.type === "date";
                const seg = "border-0 bg-transparent px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none";
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2">
                    <span className={`grid h-6 min-w-8 place-items-center rounded-md text-[9px] font-extrabold uppercase ${i === 0 ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-600"}`}>
                      {i === 0 ? "Où" : "ET"}
                    </span>
                    <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100" dir="ltr">
                      <select value={c.field} onChange={(e) => setConds((p) => p.map((x) => x.id === c.id ? { ...x, field: e.target.value as keyof Order, value: "" } : x))} className={seg + " cursor-pointer border-r border-slate-200 bg-slate-50 font-bold text-slate-800"}>
                        {FIELDS.map((f) => <option key={String(f.key)} value={String(f.key)}>{f.label}</option>)}
                      </select>
                      <select value={c.op} onChange={(e) => setConds((p) => p.map((x) => x.id === c.id ? { ...x, op: e.target.value as Op } : x))} className={seg + " cursor-pointer border-r border-slate-200"}>
                        {(isDate ? OPS_DATE : OPS).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                      {needsValue(c.op) ? (
                        def?.type === "select" ? (
                          <select value={c.value} onChange={(e) => setConds((p) => p.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} className={seg + " cursor-pointer min-w-32 bg-white"}>
                            <option value="">— اختر —</option>
                            {(def.options || []).map((x) => <option key={x} value={x}>{x}</option>)}
                          </select>
                        ) : def?.type === "date" ? (
                          <input type="date" value={c.value} onChange={(e) => setConds((p) => p.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} className={seg + " min-w-32 bg-white"} />
                        ) : (
                          <input value={c.value} onChange={(e) => setConds((p) => p.map((x) => x.id === c.id ? { ...x, value: e.target.value } : x))} placeholder={def?.key === "telephone" ? "06XXXXXXXX" : "اكتب القيمة..."} className={seg + " min-w-40 bg-white font-normal"} />
                        )
                      ) : (
                        <span className="grid place-items-center px-3 text-[10px] font-bold text-emerald-600" dir="rtl">تلقائي ✓</span>
                      )}
                    </div>
                    <button onClick={() => setConds((p) => p.filter((x) => x.id !== c.id))} title="حذف الشرط" className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600">✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* pied */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <Btn icon="＋" color="indigo" variant="ghost" onClick={() => setConds((p) => [...p, { id: Date.now(), field: "produit", op: "contains", value: "" }])}>إضافة شرط</Btn>
            {conds.length > 0 && (
              <Btn icon="🗑️" color="red" variant="ghost" onClick={() => setConds([])}>مسح كل الشروط</Btn>
            )}
            <span className="ms-auto text-[10px] font-medium text-slate-400">النتائج كتحسب فـ الوكت الحقيقي</span>
          </div>
        </div>
      )}

      {/* ══ Barre de sélection (نسخ / CSV) ══ */}
      {sel.size > 0 && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-emerald-300 bg-emerald-50 px-3 py-1.5 shadow-sm" dir="rtl">
          <b className="text-[11px] text-emerald-800">✅ محدد: {sel.size} طلبية</b>
          <Btn icon="📋" color="emerald" onClick={copyDigylock} title="نسخ جاهز للصق فـ ديجيلوك">نسخ لديجيلوك</Btn>
          <Btn icon="📋" color="slate" onClick={copyFull} title="نسخ بجميع الخانات (Excel/Sheets)">نسخ الكل</Btn>
          <Btn icon="📥" color="teal" variant="ghost" onClick={() => exportCSV(selOrders as unknown as Record<string, unknown>[], "commandes-filtrees")} title="تصدير المحدد CSV">CSV</Btn>
          <Btn icon="☑" color="emerald" variant="ghost" onClick={toggleAll} title="تحديد / إلغاء كل النتائج المعروضة">
            {allSel ? "إلغاء الكل" : `تحديد الكل (${filtered.length})`}
          </Btn>
          <Btn icon="✕" color="red" variant="ghost" onClick={() => setSel(new Set())} title="إلغاء التحديد">إلغاء التحديد</Btn>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
       <DualScroll>
        {/* ══ Agent Summary ══ */}
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className={D} style={{ width: 85 }}></th>
              <th className={G}>Confirmé</th><th className={Y}>Rappel</th><th className={R}>Annulé</th>
              <th className={B}>CONF RATE</th><th className={G}>livré</th><th className={R}>retour</th>
              <th className={B}>Expédier vers</th><th className={G}>whatssap</th>
              <th className={B}>LIVR RATE</th><th className={B}>Rate totale</th><th className={Y}>UPSELL</th><th className={D}>CAROUSELL</th>
              <th className="w-2 border border-slate-200"></th>
              <th className={B}>DATE TODAY</th><th className={D}></th>
              <th className={G}>CMD livrée</th><th className={G}>CMD confirmé</th><th className={Y}>CMD rechengé</th>
              <th className={R}>CMD Annulé</th><th className={R}>CMD retourner</th>
              <th className={B}>chaifre d&apos;affaire</th><th className={B}>totale pieces sortie</th>
            </tr>
          </thead>
          <tbody>
            {agentRows.map((a, i) => (
              <tr key={a.name} className={i % 2 ? "bg-[#f8f9fa]" : ""}>
                <td className={`${c} font-bold text-left px-2`}>{a.name}</td>
                <td className={`${c} bg-emerald-50`}>{a.confirme}</td>
                <td className={`${c} bg-yellow-50`}>{a.rappel}</td>
                <td className={`${c} bg-rose-50`}>{a.annule}</td>
                <td className={`${c} font-bold text-emerald-700`}>{a.confRate}</td>
                <td className={c}>{a.livre}</td><td className={c}>{a.retour}</td>
                <td className={c}>{a.expedierVers}</td><td className={c}>{a.whatssap}</td>
                <td className={`${c} font-bold text-sky-700`}>{a.livrRate}</td>
                <td className={c}>{a.rateTotale}</td><td className={c}>{a.upsell}</td><td className={c}>{a.carousell}</td>
                <td className="border border-slate-200"></td>
                {i === 0 && <><td className={`${c} font-bold`}>{gs.dateToday}</td><td className={`${c} text-[10px]`}>FROM</td><td className={c}></td><td className={c}></td><td className={c}></td><td className={c}></td><td className={c}></td><td className={c}></td><td className={c}></td></>}
                {i === 1 && <><td className={c}></td><td className={`${c} font-bold`}>{gs.from}</td><td className={`${c} font-bold text-emerald-700`}>{kpi.liv}</td><td className={`${c} font-bold`}>{kpi.conf}</td><td className={c}>{orders.filter((o) => o.livraison === "Expédier vers").length}</td><td className={`${c} text-rose-600 font-bold`}>{kpi.ann}</td><td className={c}>{kpi.ret}</td><td className={`${c} font-bold`}>{kpi.ca}</td><td className={c}>{kpi.pcs}</td></>}
                {i === 2 && <><td className={c}></td><td className={`${c} text-[10px]`}>TO</td><td className={`${c} text-[10px]`}>Tx livraison</td><td className={`${c} text-[10px]`}>Tx confirmation</td><td className={`${c} text-[10px]`}>charge livraison</td><td className={`${c} text-[10px]`}>Tx annulation</td><td className={`${c} text-[10px]`}>CMD</td><td className={c}></td><td className={c}></td></>}
                {i === 3 && <><td className={c}></td><td className={`${c} font-bold`}>{gs.to}</td><td className={`${c} font-bold`}>{kpi.livRate}</td><td className={`${c} font-bold`}>{kpi.confRate}</td><td className={`${c} font-bold`}>{gs.chargeLivraison}</td><td className={c}>{kpi.cmd ? ((kpi.ann / kpi.cmd) * 100).toFixed(2) + "%" : "0%"}</td><td className={`${c} font-bold`}>{kpi.cmd}</td><td className={c}></td><td className={c}></td></>}
                {i >= 4 && Array.from({ length: 9 }).map((_, j) => <td key={j} className="border border-slate-200"></td>)}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="h-2"></div>

        {/* ══ Orders ══ */}
        <table className="w-full border-collapse text-xs">
          <thead className="z-20">
            <tr>
              <th className={D} style={{ width: 30 }} title="تحديد / إلغاء كل النتائج المعروضة">
                <input type="checkbox" checked={allSel} onChange={toggleAll} className="accent-emerald-600" />
              </th>
              <th className={D} style={{ width: 28 }}>#</th>
              <FTh label="DATE" field="dateCreation" cls={B} w={88} />
              <FTh label="date" field="dateConfirmation" cls={B} w={88} />
              <FTh label="Statut" field="statut" cls={B} w={72} />
              <FTh label="Remarques" field="remarques" cls={Y} w={180} />
              <FTh label="ID" field="idCmd" cls={B} w={28} />
              <FTh label="Nom & Prénom" field="nom" cls={G} w={145} />
              <FTh label="Télephone" field="telephone" cls={G} w={105} />
              <FTh label="Ville" field="ville" cls={B} w={115} />
              <FTh label="Adress" field="adresse" cls={B} w={190} />
              <FTh label="Qte" field="qte" cls={B} w={33} />
              <FTh label="Prix" field="prix" cls={G} w={48} />
              <FTh label="Produit" field="produit" cls={G} w={200} />
              <FTh label="Suivie" field="livraison" cls={B} w={72} />
              <FTh label="UPSEL" field="upsell" cls={Y} w={40} />
              <FTh label="CAROUSELL" field="carousell" cls={D} w={120} />
              <FTh label="Agent" field="agent" cls={B} w={72} />
              <FTh label="LINK" field="link" cls={B} w={210} />
              <FTh label="CAROSELL" field="carosellFlag" cls={B} w={60} />
              <FTh label="ORIGIN LEAD" field="originLead" cls={B} w={85} />
              <FTh label="commision" field="commission" cls={G} w={68} />
              <FTh label="FEES" field="fees" cls={D} w={48} />
              <th className={R} style={{ width: 35 }}>🗑️</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o: Order, idx: number) => {
              // Row coloring like Google Sheets — Livraison prioritaire, puis Statut
              const liv = o.livraison;
              const st = o.statut;
              const isRetour = liv === "Retour";
              const isAnnule = st === "Annulé";
              const rowBg =
                liv === "Livrée" ? "#34c759" :              // vert
                liv === "Retour" ? "#ff2b2b" :              // rouge
                liv === "Out Of Stock" ? "#3c78d8" :        // bleu
                (liv === "Expédier vers" || liv === "Expédié") ? "#f6b26b" : // orange
                st === "Annulé" ? "#ff2b2b" :               // rouge
                st === "Rappel" ? "#ffff00" :               // jaune
                (idx % 2 ? "#f8f9fa" : "#ffffff");          // blanc (Confirmé/Appel/Whatssap)
              const strike = (isRetour || isAnnule) ? "line-through" : "none";
              const rowStyle = { background: rowBg, textDecoration: strike };
              return (
              <tr key={o.id} style={{ background: rowBg }} className="hover:brightness-95">
                <td className="border border-slate-300 text-center" style={{ background: rowBg }}>
                  <input type="checkbox" checked={sel.has(o.id)} onChange={() => toggleSel(o.id)} className="accent-emerald-600" title="تحديد الطلبية" />
                </td>
                <td className="border border-slate-300 px-1 text-center text-slate-500" style={rowStyle}>{idx + 1}</td>
                <Cell val={o.dateCreation} onChange={(v) => ch(o.id, "dateCreation", v)} w={88} type="date" bg={rowBg} strike={strike} />
                <Cell val={o.dateConfirmation} onChange={(v) => ch(o.id, "dateConfirmation", v)} w={88} type="date" bg={rowBg} strike={strike} />
                <Cell val={o.statut} onChange={(v) => ch(o.id, "statut", v)} w={90} bg={rowBg} strike={strike} opts={["", "Confirmé", "Annulé", "Rappel", "Suivé", "Appel-1", "Appel-2", "Appel-3", "Appel-4", "Appel-5", "Appel-6", "Whatssap"]} />
                <Cell val={o.remarques} onChange={(v) => ch(o.id, "remarques", v)} w={180} bg={rowBg} strike={strike} />
                <Cell val={o.idCmd} onChange={(v) => ch(o.id, "idCmd", v)} w={28} bg={rowBg} strike={strike} />
                <Cell val={o.nom} onChange={(v) => ch(o.id, "nom", v)} w={145} bg={rowBg} strike={strike} />
                <td className="border border-slate-300 p-0" style={{ minWidth: 105, background: rowBg }}>
                  <div className="flex items-center">
                    <input value={o.telephone} onChange={(e) => ch(o.id, "telephone", e.target.value)} style={{ textDecoration: strike }} className={`flex-1 border-0 bg-transparent px-1 py-[3px] text-xs outline-none min-w-0 ${dupIdx.dupOrders.has(o.id) ? "font-bold text-red-700" : ""}`} />
                    {dupIdx.dupOrders.has(o.id) && <span title="🚨 مكررة!" className="shrink-0 text-[10px]">🚨</span>}
                    {o.telephone && <a href={`https://wa.me/${o.telephone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" className="shrink-0 px-0.5 text-emerald-600">💬</a>}
                  </div>
                </td>
                <td className="border border-slate-300 p-0" style={{ minWidth: 115, background: rowBg }}>
                  <CityInput value={o.ville}
                    onChange={(city, prix) => upd(o.id, prix !== null ? { ville: city, commission: prix } : { ville: city })}
                    className="h-full w-full border-0 bg-transparent px-1 py-[3px] text-xs outline-none"
                    style={{ background: rowBg, textDecoration: strike }} />
                </td>
                <Cell val={o.adresse} onChange={(v) => ch(o.id, "adresse", v)} w={190} bg={rowBg} strike={strike} />
                <Cell val={o.qte} onChange={(v) => ch(o.id, "qte", v)} w={33} type="number" bg={rowBg} strike={strike} />
                <Cell val={o.prix} onChange={(v) => ch(o.id, "prix", v)} w={48} type="number" bg={rowBg} strike={strike} />
                <td style={{ minWidth: 200, background: rowBg }} className="border border-slate-300 p-0">
                  <input list="catalog-products" value={o.produit}
                    onChange={(e) => {
                      const v = e.target.value;
                      ch(o.id, "produit", v);
                      const p = catalog.find((x) => x.nom === v);
                      if (p?.prix) upd(o.id, { produit: v, prix: Number(p.prix) || 0, link: p.link || o.link });
                    }}
                    className="h-full w-full border-0 bg-transparent px-1 py-[3px] text-xs outline-none"
                    style={{ background: rowBg, textDecoration: strike }} />
                </td>
                <Cell val={o.livraison} onChange={(v) => ch(o.id, "livraison", v)} w={110} bg={rowBg} strike={strike} opts={["", "Livrée", "Retour", "Out Of Stock", "Expédier vers"]} />
                <Cell val={o.upsell} onChange={(v) => ch(o.id, "upsell", v)} w={40} type="number" bg={rowBg} strike={strike} />
                <Cell val={o.carousell} onChange={(v) => ch(o.id, "carousell", v)} w={120} bg={rowBg} strike={strike} />
                <Cell val={o.agent} onChange={(v) => ch(o.id, "agent", v)} w={90} bg={rowBg} strike={strike} opts={["", ...agentNames]} />
                <td className="border border-slate-300 p-0" style={{ minWidth: 210, background: rowBg }}>
                  <div className="flex items-center">
                    <input value={o.link} onChange={(e) => ch(o.id, "link", e.target.value)} className="flex-1 border-0 bg-transparent px-1 py-[3px] text-xs outline-none text-blue-600 underline min-w-0" />
                    {o.link && <a href={o.link} target="_blank" rel="noreferrer" className="shrink-0 px-0.5">🔗</a>}
                  </div>
                </td>
                <Cell val={o.carosellFlag} onChange={(v) => ch(o.id, "carosellFlag", v)} w={60} bg={rowBg} strike={strike} />
                <Cell val={o.originLead} onChange={(v) => ch(o.id, "originLead", v)} w={85} bg={rowBg} strike={strike} opts={ORIGIN_OPTIONS} />
                <Cell val={o.commission} onChange={(v) => ch(o.id, "commission", v)} w={68} type="number" bg={rowBg} strike={strike} />
                <Cell val={o.fees} onChange={(v) => ch(o.id, "fees", v)} w={48} bg={rowBg} strike={strike} />
                <td className="border border-slate-300 text-center" style={{ background: rowBg }}>
                  <button onClick={() => del(o.id)} className="text-red-500 hover:text-red-700 text-sm">✕</button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="p-8 text-center text-slate-400">لا توجد نتائج للبحث</div>}
       </DualScroll>
      </div>

      {/* Footer */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-[#e8e8e8] px-3 py-1 text-[11px] text-slate-600">
        <span>{filtered.length}/{orders.length} lignes</span>
        <span>CMD:{kpi.cmd} · Confirmé:{kpi.conf} · Livrée:{kpi.liv} · Retour:{kpi.ret} · Annulé:{kpi.ann} · CA:{fmt(kpi.ca)} DH · Pièces:{kpi.pcs}</span>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-2xl">
          {toast}
        </div>
      )}

      {/* ══ 🚨 تقرير المكررات ══ */}
      {showDups && (() => {
        return (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowDups(false)}>
            <div dir="rtl" onClick={(e) => e.stopPropagation()} className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-gradient-to-l from-red-600 to-rose-500 px-4 py-3 text-white">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/20 text-base">🚨</span>
                <div>
                  <h3 className="text-sm font-extrabold">الطلبيات المكررة</h3>
                  <p className="text-[10px] text-red-100">نفس رقم الهاتف — باش ما يتشحنش الطلب مرتين لنفس الشخص</p>
                </div>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold">{dupGrps.length} مجموعة</span>
                <button onClick={() => setShowDups(false)} className="ms-auto grid h-7 w-7 place-items-center rounded-lg bg-white/10 transition hover:bg-white/25">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-3">
                {dupGrps.map((g) => (
                  <div key={g.phone} className="mb-3 overflow-hidden rounded-xl border border-red-100">
                    <div className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50/70 px-3 py-2">
                      <span dir="ltr" className="rounded-lg bg-white px-2 py-0.5 text-xs font-extrabold text-red-700">{g.phone}</span>
                      <span className="text-[11px] font-bold text-slate-700">{g.orders.length} طلبيات لنفس الرقم</span>
                      <button onClick={() => { setQ(g.orders[0].telephone); setShowDups(false); }}
                        className="ms-auto rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-indigo-700">🔍 شوفهم فـ الجدول</button>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {g.orders.map((o) => (
                        <div key={o.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 text-[11px] hover:bg-slate-50">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">{o.dateCreation}</span>
                          <span className="min-w-0 truncate"><b className="text-slate-800">{o.nom || "(بلا سمية)"}</b> · {o.produit || "—"} · {o.ville || "—"} · <span className="text-slate-500">{o.agent || "—"}</span></span>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${o.livraison === "Livrée" ? "bg-emerald-100 text-emerald-700" : o.livraison === "Retour" ? "bg-red-100 text-red-700" : o.statut === "Confirmé" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {o.livraison || o.statut || "جديدة"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!dupGrps.length && (
                  <div className="p-10 text-center">
                    <div className="mb-2 text-4xl">✅</div>
                    <p className="text-sm font-bold text-emerald-700">ما كاين حتى تكرار!</p>
                    <p className="mt-1 text-xs text-slate-400">كل رقم هاتف مرتبط بطلبية وحدة</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ Import Excel ══ */}
      {showImport && <ImportExcel onClose={() => setShowImport(false)} />}

      {/* ══ Menu filtre par colonne (style Google Sheets) ══ */}
      {menu && (() => {
        const field = String(menu.field);
        const all = valuesOf(menu.field);
        const allowed = new Set(colSel[field] ?? all.map(([v]) => v));
        const shown = all.filter(([v]) => !menuQ.trim() || v.toLowerCase().includes(menuQ.trim().toLowerCase()));
        const def = fieldDef(menu.field);
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
            <div dir="rtl" className="fixed z-50 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 250)), top: Math.min(menu.y, window.innerHeight - 340) }}>
              {/* en-tête */}
              <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-2.5 py-2">
                <span className="text-[10px]">🔻</span>
                <b className="text-[11px] font-extrabold text-slate-700">{def?.label ?? field}</b>
                {isColFiltered(field) && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-bold text-amber-700">مفعّل</span>
                )}
                <button onClick={() => setMenu(null)} className="ms-auto grid h-5 w-5 place-items-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700">✕</button>
              </div>
              {/* recherche */}
              <div className="border-b border-slate-100 p-2">
                <input autoFocus value={menuQ} onChange={(e) => setMenuQ(e.target.value)} placeholder="🔍 بحث فـ القيم..."
                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
              {/* valeurs */}
              <div className="max-h-56 overflow-auto p-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-50/60 px-2 py-1.5 text-[11px] font-bold text-indigo-800">
                  <input type="checkbox" checked={allowed.size === all.length} onChange={(e) => selectAllCol(field, e.target.checked)} className="accent-indigo-600" />
                  تحديد الكل <span className="text-[9px] font-medium text-indigo-500">({all.length} قيم)</span>
                </label>
                <div className="my-1 h-px bg-slate-100" />
                {shown.map(([v, n]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[11px] transition hover:bg-slate-50">
                    <input type="checkbox" checked={allowed.has(v)} onChange={() => toggleColVal(field, v)} className="accent-indigo-600" />
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={v}>{v === "" ? "(فاضي)" : v}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[9px] font-bold text-slate-500">{n}</span>
                  </label>
                ))}
                {!shown.length && <p className="p-3 text-center text-[10px] text-slate-400">ما كاين حتى قيمة</p>}
              </div>
              {/* pied */}
              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 p-2">
                <button onClick={() => selectAllCol(field, true)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 transition hover:bg-slate-100">
                  ↺ مسح الفلتر
                </button>
                <span className="text-[9px] font-bold text-slate-500">{allowed.size}/{all.length} مختارين</span>
                <button onClick={() => setMenu(null)}
                  className="ms-auto rounded-lg bg-indigo-600 px-3 py-1 text-[10px] font-bold text-white transition hover:bg-indigo-700">
                  تم ✓
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
