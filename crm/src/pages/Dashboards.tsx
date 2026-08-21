import DualScroll from "../components/DualScroll";
import { useStore } from "../store";
import { usePeriod } from "../period";
import type { Order } from "../data/orders";

const box = "border border-slate-400 px-2 py-1 text-[11px] text-center whitespace-nowrap";
const pct = (a: number, b: number) => (b > 0 ? ((a / b) * 100).toFixed(2) + "%" : "0%");

/* ══════════════════ suivi confirmation (CALCULÉ depuis les commandes) ══════════════════ */
export function SuiviConfirmationView() {
  const { orders: allOrders, agentNames } = useStore();
  const { inRange, label } = usePeriod();
  const orders = allOrders.filter((o: Order) => inRange(o.dateCreation));

  const H = ({ children, bg = "#6aa84f", w = 80, color = "#fff" }: { children: React.ReactNode; bg?: string; w?: number; color?: string }) =>
    <td className={box + " font-bold"} style={{ background: bg, color, minWidth: w }}>{children}</td>;
  const V = ({ children, bg = "#fff", w = 80 }: { children?: React.ReactNode; bg?: string; w?: number }) =>
    <td className={box} style={{ background: bg, minWidth: w }}>{children}</td>;

  const agents = agentNames;
  const products = [...new Set(orders.map((o: Order) => o.produit).filter(Boolean))];

  // per-agent global stats
  const agentStats = agents.map((a) => {
    const l = orders.filter((o: Order) => o.agent === a);
    const total = l.length;
    const conf = l.filter((o: Order) => o.statut === "Confirmé").length;
    const rappel = l.filter((o: Order) => o.statut === "Rappel").length;
    const annule = l.filter((o: Order) => o.statut === "Annulé").length;
    const livre = l.filter((o: Order) => o.livraison === "Livrée").length;
    const retour = l.filter((o: Order) => o.livraison === "Retour").length;
    const expedie = l.filter((o: Order) => o.livraison === "Expédier vers" || o.livraison === "Expédié").length;
    const oos = l.filter((o: Order) => o.livraison === "Out Of Stock").length;
    const upsell = l.reduce((s: number, o: Order) => s + (o.upsell || 0), 0);
    const ca = l.filter((o: Order) => o.livraison === "Livrée").reduce((s: number, o: Order) => s + o.prix, 0);
    return { a, total, conf, rappel, annule, livre, retour, expedie, oos, upsell, ca,
      confRate: pct(conf, total), livrRate: pct(livre, livre + retour), totalRate: pct(livre, total) };
  });

  // CONFIRMATION: produit × agent (nombre confirmé)
  const confMatrix = products.map((p) => ({
    p,
    vals: agents.map((a) => orders.filter((o: Order) => o.produit === p && o.agent === a && o.statut === "Confirmé").length),
  })).filter((r) => r.vals.some((v) => v > 0));

  // Delivre rate: produit × agent (livré / (livré+retour))
  const rateMatrix = products.map((p) => ({
    p,
    vals: agents.map((a) => {
      const liv = orders.filter((o: Order) => o.produit === p && o.agent === a && o.livraison === "Livrée").length;
      const ret = orders.filter((o: Order) => o.produit === p && o.agent === a && o.livraison === "Retour").length;
      return { liv, ret, rate: (liv + ret) > 0 ? (liv / (liv + ret)) * 100 : NaN };
    }),
  })).filter((r) => r.vals.some((v) => v.liv > 0 || v.ret > 0));

  return (
    <div dir="ltr" className="h-full">
      <DualScroll>
        <div className="p-3 space-y-5" style={{ minWidth: 1200 }}>
          <div className="rounded bg-emerald-50 p-2 text-xs text-slate-600">
            ⚙️ هاد الصفحة كتتحسب أوتوماتيك من الطلبيات (COMONDES) — كل ما بدّلتي حالة طلبية كتتحدث المعدلات هنا مباشرة.
            <span className="mr-2 rounded bg-orange-100 px-2 py-0.5 font-bold text-orange-700">⏱ {label}</span>
          </div>

          {/* Résumé par agent */}
          <div>
            <h3 className="mb-1 text-sm font-bold">👤 Résumé par confirmatrice (calculé)</h3>
            <table className="border-collapse">
              <thead>
                <tr>
                  <H bg="#434343" w={90}>Agent</H>
                  <H bg="#3c78d8" w={70}>ORDER</H>
                  <H bg="#6aa84f" w={80}>Confirmé</H>
                  <H bg="#f1c232" w={70} color="#000">Rappel</H>
                  <H bg="#cc0000" w={70}>Annulé</H>
                  <H bg="#3c78d8" w={90}>CONF RATE</H>
                  <H bg="#6aa84f" w={70}>Livré</H>
                  <H bg="#cc0000" w={70}>Retour</H>
                  <H bg="#f6b26b" w={95} color="#000">Expédier vers</H>
                  <H bg="#3c78d8" w={95}>Out Of Stock</H>
                  <H bg="#3c78d8" w={90}>LIVR RATE</H>
                  <H bg="#3c78d8" w={90}>Rate totale</H>
                  <H bg="#f1c232" w={70} color="#000">UPSELL</H>
                  <H bg="#38761d" w={110}>C.A (livré)</H>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((s) => (
                  <tr key={s.a}>
                    <H bg="#93c47d" w={90} color="#000">{s.a}</H>
                    <V w={70}>{s.total}</V>
                    <V w={80} bg="#d9ead3">{s.conf}</V>
                    <V w={70} bg="#fff2cc">{s.rappel}</V>
                    <V w={70} bg="#f4cccc">{s.annule}</V>
                    <V w={90} bg="#d9ead3"><b>{s.confRate}</b></V>
                    <V w={70} bg="#d9ead3">{s.livre}</V>
                    <V w={70} bg="#f4cccc">{s.retour}</V>
                    <V w={95} bg="#fce5cd">{s.expedie}</V>
                    <V w={95} bg="#cfe2f3">{s.oos}</V>
                    <V w={90} bg="#cfe2f3"><b>{s.livrRate}</b></V>
                    <V w={90} bg="#cfe2f3">{s.totalRate}</V>
                    <V w={70}>{s.upsell}</V>
                    <V w={110}><b>{s.ca.toLocaleString("fr-FR")} DH</b></V>
                  </tr>
                ))}
                {!agentStats.length && <tr><td colSpan={14} className={box}>لا توجد بيانات</td></tr>}
              </tbody>
            </table>
          </div>

          {/* CONFIRMATION produit × agent */}
          <div>
            <h3 className="mb-1 text-sm font-bold">✅ CONFIRMATION — Produit × Agent (nombre confirmé)</h3>
            <table className="border-collapse">
              <thead>
                <tr><H bg="#38761d" w={240}>Produit</H>{agents.map((a) => <H key={a} bg="#6aa84f" w={80}>{a}</H>)}<H bg="#434343" w={70}>TOTAL</H></tr>
              </thead>
              <tbody>
                {confMatrix.map((r) => {
                  const tot = r.vals.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={r.p}>
                      <V w={240} bg="#f3f3f3">{r.p}</V>
                      {r.vals.map((v, i) => <V key={i} w={80}>{v || ""}</V>)}
                      <V w={70} bg="#d9ead3"><b>{tot}</b></V>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Delivre rate produit × agent */}
          <div>
            <h3 className="mb-1 text-sm font-bold">📊 Delivre rate — Produit × Agent (livré / livré+retour)</h3>
            <table className="border-collapse">
              <thead>
                <tr><H bg="#38761d" w={240}>Produit</H>{agents.map((a) => <H key={a} bg="#6aa84f" w={90}>{a}</H>)}</tr>
              </thead>
              <tbody>
                {rateMatrix.map((r) => (
                  <tr key={r.p}>
                    <V w={240} bg="#f3f3f3">{r.p}</V>
                    {r.vals.map((v, i) => {
                      if (isNaN(v.rate)) return <V key={i} w={90}></V>;
                      const bg = v.rate >= 55 ? "#b6d7a8" : v.rate >= 40 ? "#ffe599" : "#ea9999";
                      return <V key={i} w={90} bg={bg}>{v.rate.toFixed(2)}%</V>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DualScroll>
    </div>
  );
}
