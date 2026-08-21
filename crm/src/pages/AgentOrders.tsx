import { useEffect, useMemo, useState } from "react";
import DualScroll from "../components/DualScroll";
import CityInput from "../components/CityInput";
import Btn from "../components/Btn";
import Remarques from "./Remarques";
import TotalLivraison from "./TotalLivraison";
import Historique from "./Historique";
import { useStore } from "../store";
import { useAuth } from "../auth";
import { usePeriod } from "../period";
import { useVilles, priceForCity } from "../data/villes";
import { buildDupIndex, dupInfoFor } from "../data/duplicates";
import { ORIGIN_OPTIONS, type Order } from "../data/orders";

const statusOptions = ["", "Confirmé", "Annulé", "Rappel", "Suivé", "Appel-1", "Appel-2", "Appel-3", "Appel-4", "Appel-5", "Appel-6", "Whatssap"];
const deliveryOptions = ["", "Livrée", "Retour", "Out Of Stock", "Expédier vers"];

/** 📱 هل نحن فـ الهاتف؟ */
function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return m;
}

function rowAppearance(order: Order, index: number) {
  const bg =
    order.livraison === "Livrée" ? "#34c759" :
    order.livraison === "Retour" ? "#ff2b2b" :
    order.livraison === "Out Of Stock" ? "#3c78d8" :
    order.livraison === "Expédier vers" ? "#f6b26b" :
    order.statut === "Annulé" ? "#ff2b2b" :
    order.statut === "Rappel" ? "#ffff00" :
    index % 2 ? "#f8f9fa" : "#ffffff";
  return { bg, strike: order.livraison === "Retour" || order.statut === "Annulé" };
}

export default function AgentOrders({ agent: rawAgent }: { agent: string }) {
  const agent = String(rawAgent ?? "");
  const { orders, add, upd, del, saveCheckpoint, savedAt, savedCount } = useStore();
  const { currentUser: viewer } = useAuth();
  const isAdminViewer = viewer?.role === "admin";
  /* 🔒 Verrouillage: Livrée = مقفولة على البنات */
  const locked = (o: Order) => o.livraison === "Livrée" && !isAdminViewer;
  const { inRange } = usePeriod();
  const isMobile = useIsMobile();

  // Catalogue produits (page PRODUITS) — auto-complétion + prix automatique
  const catalog: { nom: string; link: string; prix: string }[] = useMemo(() => {
    try {
      const s = localStorage.getItem("afrizon_catalog_v1");
      if (s) return JSON.parse(s);
    } catch { /* */ }
    return [];
  }, []);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"orders" | "total" | "history" | "remarque">("orders");

  // Villes de livraison — prix automatique
  const villes = useVilles();
  const setVilleWithPrice = (id: number, v: string) => {
    const prix = priceForCity(v, villes);
    upd(id, prix !== null ? { ville: v, commission: prix } : { ville: v });
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => o.agent.toLowerCase() === agent.toLowerCase() && inRange(o.dateCreation))
      .filter((o) => !q || [o.nom, o.telephone, o.ville, o.produit, o.adresse, o.remarques, o.statut, o.livraison].join(" ").toLowerCase().includes(q));
  }, [orders, agent, query, inRange]);

  /* 🚨 كشف المكررات — فهرس على كل الطلبيات (حتى ديال البنات الأخرى) */
  const dupIdx = useMemo(() => buildDupIndex(orders), [orders]);
  const [dupOnly, setDupOnly] = useState(false);
  const shownRows = useMemo(
    () => (dupOnly ? rows.filter((o) => dupIdx.dupOrders.has(o.id)) : rows),
    [rows, dupOnly, dupIdx],
  );
  const dupCount = useMemo(() => rows.filter((o) => dupIdx.dupOrders.has(o.id)).length, [rows, dupIdx]);

  const stats = useMemo(() => {
    const all = orders.filter((o) => o.agent.toLowerCase() === agent.toLowerCase() && inRange(o.dateCreation));
    const confirme = all.filter((o) => o.statut === "Confirmé").length;
    const livre = all.filter((o) => o.livraison === "Livrée").length;
    const retour = all.filter((o) => o.livraison === "Retour").length;
    const ca = all.filter((o) => o.livraison === "Livrée").reduce((sum, o) => sum + o.prix, 0);
    return { total: all.length, confirme, livre, retour, ca };
  }, [orders, agent, inRange]);

  const addOrder = () => {
    const today = new Date().toISOString().slice(0, 10);
    add({
      dateCreation: today, dateConfirmation: today, statut: "", remarques: "", idCmd: "1",
      nom: "", telephone: "", ville: "", adresse: "", qte: 1, prix: 0, produit: "", livraison: "",
      upsell: 0, carousell: "", agent, link: "", carosellFlag: "", originLead: "", commission: 35, fees: "",
    });
  };

  const set = (id: number, key: keyof Order, value: string) => {
    const numeric = ["qte", "prix", "upsell", "commission"].includes(key);
    upd(id, { [key]: numeric ? Number(value) || 0 : value } as Partial<Order>);
  };

  const headers = ["#", "DATE", "date", "Statut", "Remarques", "Nom & Prénom", "Téléphone", "Ville", "Adresse", "Qte", "Prix", "Produit", "Suivie", "UPSEL", "ORIGIN LEAD", "commision", "🗑️"];
  const widths = [34, 105, 105, 90, 180, 150, 120, 120, 190, 45, 60, 220, 110, 55, 95, 75, 38];

  const Switcher = () => (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {([
        ["orders", "Commandes"],
        ["total", "📊 Total"],
        ["remarque", "📝 Remarque"],
        ["history", "🕘 Historique"],
      ] as const).map(([key, label]) => (
        <button key={key} onClick={() => setView(key)}
          className={`px-3 py-[7px] text-xs font-bold transition ${view === key ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
          {label}
        </button>
      ))}
    </div>
  );

  if (view === "total" || view === "history" || view === "remarque") {
    return (
      <div dir="ltr" className="flex h-full flex-col bg-white text-xs">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 p-2">
          <b className="text-sm">👤 {agent}</b>
          <Switcher />
        </div>
        <div className="flex-1 overflow-hidden">
          {view === "total" ? <TotalLivraison agent={agent} /> : view === "remarque" ? <Remarques agent={agent} /> : <Historique agent={agent} />}
        </div>
      </div>
    );
  }

  return (
    <div dir="ltr" className="flex h-full flex-col bg-white text-xs">
      <datalist id="catalog-products-agent">
        {catalog.map((p) => <option key={p.nom} value={p.nom} />)}
      </datalist>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-300 bg-slate-100 p-2">
        <b className="text-sm">👤 {agent}</b>
        <Switcher />
        <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
          <span className="pointer-events-none absolute inset-y-0 start-2 grid place-items-center text-xs text-slate-400">🔎</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..."
            className="w-full rounded-xl border border-slate-200 bg-white py-[7px] pe-2 ps-7 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <Btn icon="＋" color="blue" onClick={addOrder} title="إضافة طلبية جديدة">Commande</Btn>
        <Btn icon="💾" color="emerald" onClick={() => { const n = saveCheckpoint(); alert(`✅ تم الحفظ\n${n} طلبية محفوظة.`); }} title="حفظ الوضع الحالي كنقطة استرجاع">Save</Btn>
        {savedAt && <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">✓ {savedCount}</span>}
        {dupCount > 0 && (
        <button onClick={() => setDupOnly((v) => !v)} title="طلبيات بنفس الرقم ولا نفس العنوان"
          className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold transition ${dupOnly ? "border-red-500 bg-red-600 text-white shadow-sm" : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"}`}>
          🚨 مكررات: {dupCount} {dupOnly ? "✓" : ""}
        </button>
      )}
      <span className="hidden text-[10px] text-slate-500 sm:inline">CMD: <b>{stats.total}</b> · ✅ {stats.confirme} · 📦 {stats.livre} · ↩️ {stats.retour} · 💰 {stats.ca.toLocaleString("fr-FR")} DH</span>
      </div>

      {/* ════════ 📱 عرض الهاتف: كروت ════════ */}
      {isMobile ? (
        <div dir="rtl" className="flex-1 space-y-2.5 overflow-auto p-2.5">
          {shownRows.map((o, index) => {
            const { bg, strike } = rowAppearance(o, index);
            return (
              <div key={o.id} className={`overflow-hidden rounded-xl border shadow-sm ${locked(o) ? "border-amber-300" : "border-slate-200"}`} style={{ textDecoration: strike ? "line-through" : "none" }}>
                {locked(o) && (
                  <div className="flex items-center gap-2 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-800">
                    🔒 طلبية مسلّمة — مقفولة، الأدمين فقط يقدر يبدلها
                  </div>
                )}
                {/* رأس الكارت: الحالة + السمية + مسح */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ background: bg }}>
                  <span className="rounded-md bg-white/70 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{index + 1}</span>
                  <input value={o.nom} onChange={(e) => set(o.id, "nom", e.target.value)} placeholder="Nom & Prénom"
                    className="min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-bold outline-none" style={{ textDecoration: strike ? "line-through" : "none" }} />
                  {o.statut && <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-slate-700">{o.statut}</span>}
                  {o.livraison && <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-bold text-slate-700">{o.livraison}</span>}
                  <button onClick={() => confirm("Supprimer cette commande ?") && del(o.id)} className="shrink-0 px-1 text-sm text-red-900">✕</button>
                </div>

                {/* المحتوى */}
                <div className={`grid grid-cols-2 gap-2 bg-white p-2.5 ${locked(o) ? "pointer-events-none opacity-75" : ""}`}>
                  {/* الهاتف + واتساب */}
                  <label className="col-span-2 text-[10px] font-bold text-slate-400">📞 Téléphone
                    <div className="flex items-center gap-1">
                      <input value={o.telephone} onChange={(e) => set(o.id, "telephone", e.target.value)} dir="ltr"
                        className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm font-semibold outline-none focus:border-blue-400 ${dupIdx.dupOrders.has(o.id) ? "border-red-400 bg-red-50" : "border-slate-200"}`} />
                      {o.telephone && (
                        <a href={`https://wa.me/${o.telephone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-base">💬</a>
                      )}
                      {o.telephone && (
                        <a href={`tel:${o.telephone.replace(/[^0-9+]/g, "")}`}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-base">📞</a>
                      )}
                    </div>
                  </label>

                  {/* 🚨 تحذير المكررات */}
                  {(() => {
                    const d = dupInfoFor(o, dupIdx);
                    if (!d.count) return null;
                    return (
                      <div className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] leading-5">
                        <b className="text-red-700">🚨 طلبية مكررة!</b> <span className="text-red-600">نفس {d.byPhone ? "الرقم" : "العنوان"} موجود فـ {d.count} طلبيات أخرى:</span>
                        {d.others.slice(0, 2).map((m) => (
                          <div key={m.id} className="truncate text-slate-600">• {m.nom || "(بلا سمية)"} — {m.produit || "—"} — {m.statut || "بلا حالة"} · {m.dateCreation} · {m.agent || "—"} {m.livraison ? `· ${m.livraison}` : ""}</div>
                        ))}
                        {d.count > 2 && <div className="text-slate-400">و {d.count - 2} أخرى...</div>}
                        <div className="mt-1 font-bold text-red-700">⚠️ تأكدي قبل الاتصال ولا الشحن!</div>
                      </div>
                    );
                  })()}

                  {/* المدينة الذكية */}
                  <label className="col-span-2 text-[10px] font-bold text-slate-400">🏙️ Ville
                    <div className="rounded-lg border border-slate-200 px-1 py-0.5">
                      <CityInput value={o.ville} onChange={(city) => setVilleWithPrice(o.id, city)}
                        className="w-full border-0 bg-transparent px-1 py-1 text-sm outline-none" />
                    </div>
                  </label>

                  {/* العنوان */}
                  <label className="col-span-2 text-[10px] font-bold text-slate-400">📍 Adresse
                    <input value={o.adresse} onChange={(e) => set(o.id, "adresse", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
                  </label>

                  {/* المنتوج */}
                  <label className="col-span-2 text-[10px] font-bold text-slate-400">📦 Produit
                    <input list="catalog-products-agent" value={o.produit}
                      onChange={(e) => {
                        const v = e.target.value;
                        const p = catalog.find((x) => x.nom === v);
                        if (p?.prix) upd(o.id, { produit: v, prix: Number(p.prix) || 0, link: p.link || o.link });
                        else set(o.id, "produit", v);
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
                  </label>

                  <label className="text-[10px] font-bold text-slate-400">💰 Prix
                    <input type="number" value={o.prix} onChange={(e) => set(o.id, "prix", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-400" />
                  </label>
                  <label className="text-[10px] font-bold text-slate-400">🔢 Qte
                    <input type="number" value={o.qte} onChange={(e) => set(o.id, "qte", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-bold outline-none focus:border-blue-400" />
                  </label>

                  {/* الحالات */}
                  <label className="text-[10px] font-bold text-slate-400">🏷️ Statut
                    <select value={o.statut} onChange={(e) => set(o.id, "statut", e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none">
                      {statusOptions.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] font-bold text-slate-400">🚚 Suivie
                    <select value={o.livraison} onChange={(e) => set(o.id, "livraison", e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none">
                      {deliveryOptions.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
                    </select>
                  </label>

                  {/* المصدر ORIGIN */}
                  <label className="col-span-2 text-[10px] font-bold text-slate-400">📣 Origin
                    <select value={o.originLead} onChange={(e) => set(o.id, "originLead", e.target.value)}
                      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none">
                      {ORIGIN_OPTIONS.map((x) => <option key={x} value={x}>{x || "—"}</option>)}
                    </select>
                  </label>

                  {/* commision + تاريخ */}
                  <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
                    <span className="text-[10px] font-bold text-slate-400">🚚 شحن</span>
                    <b className="text-sm text-emerald-700">{o.commission} DH</b>
                    <span className="ms-auto text-[10px] text-slate-400">{o.dateCreation}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {!shownRows.length && <div className="p-8 text-center text-slate-400">Aucune commande pour {agent}</div>}
          <div className="h-2" />
        </div>
      ) : (
        /* ════════ 💻 عرض الحاسوب: الجدول ════════ */
        <div className="flex-1 overflow-hidden">
          <DualScroll>
            <table className="border-collapse">
              <thead>
                <tr>{headers.map((h, i) => <th key={h} className="border border-slate-400 bg-[#4a86c8] px-2 py-1 font-bold text-white whitespace-nowrap" style={{ minWidth: widths[i] }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {shownRows.map((o, index) => {
                  const { bg, strike } = rowAppearance(o, index);
                  const input = "h-full w-full border-0 bg-transparent px-1 py-1 outline-none";
                  const style = { background: bg, textDecoration: strike ? "line-through" : "none" };
                  return (
                    <tr key={o.id} style={{ background: bg }} className={locked(o) ? "cmd-locked" : ""}>
                      <td className="border border-slate-400 text-center" style={style} title={locked(o) ? "🔒 مقفولة — Livrée" : undefined}>{index + 1}{locked(o) ? " 🔒" : ""}</td>
                      <td className="border border-slate-400 p-0"><input type="date" value={o.dateCreation} onChange={(e) => set(o.id, "dateCreation", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0"><input type="date" value={o.dateConfirmation} onChange={(e) => set(o.id, "dateConfirmation", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0"><select value={o.statut} onChange={(e) => set(o.id, "statut", e.target.value)} className={input} style={style}>{statusOptions.map((x) => <option key={x} value={x}>{x || "—"}</option>)}</select></td>
                      <td className="border border-slate-400 p-0"><input value={o.remarques} onChange={(e) => set(o.id, "remarques", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0"><input value={o.nom} onChange={(e) => set(o.id, "nom", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0" style={style}>
                        <div className="flex items-center">
                          <input value={o.telephone} onChange={(e) => set(o.id, "telephone", e.target.value)} className={`${input} ${dupIdx.dupOrders.has(o.id) ? "font-bold text-red-700" : ""}`} style={style} />
                          {dupIdx.dupOrders.has(o.id) && (
                            <span title="🚨 طلبية مكررة — نفس الرقم ولا العنوان موجود فـ طلبيات أخرى" className="shrink-0 px-0.5 text-[10px]">🚨</span>
                          )}
                        </div>
                      </td>
                      <td className="border border-slate-400 p-0" style={style}>
                        <CityInput value={o.ville} onChange={(city) => setVilleWithPrice(o.id, city)} className={input} style={style} />
                      </td>
                      <td className="border border-slate-400 p-0"><input value={o.adresse} onChange={(e) => set(o.id, "adresse", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0"><input type="number" value={o.qte} onChange={(e) => set(o.id, "qte", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0"><input type="number" value={o.prix} onChange={(e) => set(o.id, "prix", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0">
                        <input list="catalog-products-agent" value={o.produit}
                          onChange={(e) => {
                            const v = e.target.value;
                            const p = catalog.find((x) => x.nom === v);
                            if (p?.prix) upd(o.id, { produit: v, prix: Number(p.prix) || 0, link: p.link || o.link });
                            else set(o.id, "produit", v);
                          }}
                          className={input} style={style} />
                      </td>
                      <td className="border border-slate-400 p-0"><select value={o.livraison} onChange={(e) => set(o.id, "livraison", e.target.value)} className={input} style={style}>{deliveryOptions.map((x) => <option key={x} value={x}>{x || "—"}</option>)}</select></td>
                      <td className="border border-slate-400 p-0"><input type="number" value={o.upsell} onChange={(e) => set(o.id, "upsell", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 p-0"><select value={o.originLead} onChange={(e) => set(o.id, "originLead", e.target.value)} className={input} style={style}>{ORIGIN_OPTIONS.map((x) => <option key={x} value={x}>{x || "—"}</option>)}</select></td>
                      <td className="border border-slate-400 p-0"><input type="number" value={o.commission} onChange={(e) => set(o.id, "commission", e.target.value)} className={input} style={style} /></td>
                      <td className="border border-slate-400 text-center" style={{ background: bg }}><button onClick={() => confirm("Supprimer cette commande ?") && del(o.id)} className="text-red-900">✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!shownRows.length && <div className="p-8 text-center text-slate-400">Aucune commande pour {agent}</div>}
          </DualScroll>
        </div>
      )}
    </div>
  );
}
