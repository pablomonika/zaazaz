import { useMemo, useState } from "react";
import { useStore } from "../store";
import { usePeriod } from "../period";
import type { Order } from "../data/orders";

const nf = (n: number) => n.toLocaleString("fr-FR");
const PHOTOS_KEY = "afrizon_team_photos_v1";
const GOAL_KEY = "afrizon_ranking_goal_v1";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const PODIUM = [
  { medal: "🥇", ring: "#f59e0b", soft: "#fffbeb", text: "#b45309", chip: "#fef3c7", crown: true },
  { medal: "🥈", ring: "#94a3b8", soft: "#f8fafc", text: "#475569", chip: "#e2e8f0", crown: false },
  { medal: "🥉", ring: "#f97316", soft: "#fff7ed", text: "#c2410c", chip: "#ffedd5", crown: false },
];

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

function Avatar({ name, photo, size, ring }: { name: string; photo?: string; size: number; ring: string }) {
  return (
    <div className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-slate-300 to-slate-400 font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size / 2.6, boxShadow: `0 0 0 3px #fff, 0 0 0 6px ${ring}` }}>
      {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" draggable={false} /> : initials(name)}
    </div>
  );
}

export default function Ranking() {
  const { orders: allOrders, agentNames } = useStore();
  const { inRange, label, period } = usePeriod();
  const orders = useMemo(() => period === "all" ? allOrders : allOrders.filter((o: Order) => inRange(o.dateCreation)), [allOrders, inRange, period]);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [all, setAll] = useState(false);
  const [sortBy, setSortBy] = useState<"conf" | "ca" | "taux">("conf");
  const [goal, setGoal] = useState<number>(() => Number(localStorage.getItem(GOAL_KEY)) || 2000);

  const photos: Record<string, string> = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); } catch { return {}; }
  }, []);

  const inPeriod = (o: Order, m: number, y: number) => {
    if (all) return true;
    const d = o.dateCreation;
    return d.slice(0, 4) === String(y) && Number(d.slice(5, 7)) === m + 1;
  };

  const build = (m: number, y: number) => agentNames.map((name) => {
    const list = orders.filter((o) => o.agent.toLowerCase() === name.toLowerCase() && inPeriod(o, m, y));
    const conf = list.filter((o) => o.statut === "Confirmé").length;
    const liv = list.filter((o) => o.livraison === "Livrée").length;
    const ret = list.filter((o) => o.livraison === "Retour").length;
    const ca = list.filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.prix, 0);
    const taux = liv + ret ? Math.round((liv / (liv + ret)) * 100) : 0;
    return { name, conf, liv, ret, ca, taux, total: list.length };
  });

  const prevM = month === 0 ? 11 : month - 1;
  const prevY = month === 0 ? year - 1 : year;

  const rows = useMemo(() => {
    const cur = build(month, year);
    const prev = build(prevM, prevY);
    const maxConf = Math.max(1, ...cur.map((r) => r.conf));
    return cur.map((r) => {
      const before = prev.find((p) => p.name === r.name);
      const delta = before && before.conf > 0 ? Math.round(((r.conf - before.conf) / before.conf) * 100) : (r.conf > 0 ? 100 : 0);
      return { ...r, photo: photos[r.name], progress: Math.round((r.conf / maxConf) * 100), delta };
    }).sort((a, b) => sortBy === "ca" ? b.ca - a.ca : sortBy === "taux" ? b.taux - a.taux : b.conf - a.conf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, agentNames, month, year, all, sortBy, photos]);

  const totals = useMemo(() => {
    const conf = rows.reduce((s, r) => s + r.conf, 0);
    const ca = rows.reduce((s, r) => s + r.ca, 0);
    const liv = rows.reduce((s, r) => s + r.liv, 0);
    const ret = rows.reduce((s, r) => s + r.ret, 0);
    const prev = build(prevM, prevY);
    const pConf = prev.reduce((s, r) => s + r.conf, 0);
    const pCa = prev.reduce((s, r) => s + r.ca, 0);
    const pLiv = prev.reduce((s, r) => s + r.liv, 0);
    const pRet = prev.reduce((s, r) => s + r.ret, 0);
    const taux = liv + ret ? Math.round((liv / (liv + ret)) * 100) : 0;
    const pTaux = pLiv + pRet ? Math.round((pLiv / (pLiv + pRet)) * 100) : 0;
    return {
      conf, ca, taux,
      dConf: pConf ? Math.round(((conf - pConf) / pConf) * 100) : 0,
      dCa: pCa ? Math.round(((ca - pCa) / pCa) * 100) : 0,
      dTaux: taux - pTaux,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orders, month, year, all]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const order = [1, 0, 2]; // 2e, 1er, 3e (visuel)
  const topProg = [...rows].sort((a, b) => b.delta - a.delta)[0];

  const Delta = ({ v, suffix = "%" }: { v: number; suffix?: string }) => (
    <span className={`text-xs font-bold ${v >= 0 ? "text-emerald-600" : "text-red-500"}`}>
      {v >= 0 ? "↑" : "↓"} {Math.abs(v)}{suffix}
    </span>
  );

  return (
    <div dir="ltr" className="h-full overflow-auto bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-2xl">🏆</div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Classement des Filles</h1>
            <p className="text-sm text-slate-500">Performance des confirmatrices · <span className="font-bold text-orange-600">⏱ {label}</span></p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none">
              <option value="conf">Trier: Confirmés</option>
              <option value="ca">Trier: Montant</option>
              <option value="taux">Trier: Réussite</option>
            </select>
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${all ? "border-slate-200 bg-slate-100 opacity-60" : "border-slate-200 bg-white"}`}>
              <select disabled={all} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-transparent text-sm font-semibold outline-none">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select disabled={all} value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent text-sm font-semibold outline-none">
                {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className="text-slate-400">📅</span>
            </div>
            <button onClick={() => setAll(!all)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${all ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {all ? "✓ Tout" : "Tout"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* Podium */}
          <div className="grid gap-4 sm:grid-cols-3">
            {order.map((idx) => {
              const r = podium[idx];
              const p = PODIUM[idx];
              if (!r) return <div key={idx} className="hidden sm:block" />;
              return (
                <div key={r.name}
                  className={`relative rounded-2xl border-2 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${idx === 0 ? "sm:-mt-4 sm:pb-7" : ""}`}
                  style={{ borderColor: idx === 0 ? p.ring : "#e2e8f0", background: `linear-gradient(180deg, ${p.soft}, #fff)` }}>
                  {p.crown && <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">👑</div>}
                  <div className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full text-lg shadow-sm"
                    style={{ background: p.chip }}>{p.medal}</div>
                  <div className="mx-auto w-fit">
                    <Avatar name={r.name} photo={r.photo} size={idx === 0 ? 96 : 80} ring={p.chip} />
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold" style={{ color: p.text }}>{r.name}</h3>
                  <p className="mt-1 text-sm text-slate-600"><b>{nf(r.conf)}</b> confirmés</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: p.text }}>⭐ {r.taux}%</p>
                  <div className="mt-3 rounded-xl py-2.5 text-sm font-extrabold" style={{ background: p.chip, color: p.text }}>
                    {nf(r.ca)} MAD
                  </div>
                </div>
              );
            })}
          </div>

          {/* Classement complet */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-lg">📊</span>
              <h3 className="text-base font-bold text-slate-800">Classement Complet</h3>
              <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{rows.length} filles</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-5 py-3">#</th>
                  <th className="px-3 py-3">Fille</th>
                  <th className="px-3 py-3">Confirmés</th>
                  <th className="px-3 py-3">Taux de réussite</th>
                  <th className="px-3 py-3">Montant généré</th>
                  <th className="px-3 py-3 w-56">Progression</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((r, i) => (
                  <tr key={r.name} className="border-b border-slate-50 transition hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-400">{i + 4}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={r.name} photo={r.photo} size={36} ring="#f1f5f9" />
                        <span className="text-sm font-bold text-slate-800">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">{nf(r.conf)}</td>
                    <td className="px-3 py-3 text-sm font-bold"
                      style={{ color: r.taux >= 80 ? "#059669" : r.taux >= 70 ? "#ca8a04" : "#dc2626" }}>{r.taux}%</td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-700">{nf(r.ca)} MAD</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${r.progress}%` }} />
                        </div>
                        <span className="w-9 text-right text-xs font-bold text-slate-500">{r.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rest.length && <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-400">Aucune autre fille dans le classement</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50">📈</span>
              <h3 className="font-bold text-slate-800">Statistiques</h3>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500">Total confirmés</p>
                <div className="flex items-end gap-3">
                  <b className="text-2xl font-extrabold text-slate-900">{nf(totals.conf)}</b>
                  <div><Delta v={totals.dConf} /><p className="text-[10px] text-slate-400">vs mois dernier</p></div>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Taux de réussite moyen</p>
                <div className="flex items-end gap-3">
                  <b className="text-2xl font-extrabold text-slate-900">{totals.taux}%</b>
                  <div><Delta v={totals.dTaux} suffix="pt" /><p className="text-[10px] text-slate-400">vs mois dernier</p></div>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Montant total généré</p>
                <div className="flex items-end gap-3">
                  <b className="text-2xl font-extrabold text-slate-900">{nf(totals.ca)} MAD</b>
                  <div><Delta v={totals.dCa} /><p className="text-[10px] text-slate-400">vs mois dernier</p></div>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500">Objectif mensuel</p>
                <div className="flex items-center gap-2">
                  <b className="text-xl font-extrabold text-violet-600">{nf(totals.conf)}</b>
                  <span className="text-slate-400">/</span>
                  <input type="number" value={goal}
                    onChange={(e) => { const v = Number(e.target.value) || 0; setGoal(v); localStorage.setItem(GOAL_KEY, String(v)); }}
                    className="w-20 rounded border border-slate-200 px-2 py-0.5 text-lg font-extrabold text-slate-900 outline-none focus:border-violet-400" />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-violet-600" style={{ width: `${Math.min(100, goal ? (totals.conf / goal) * 100 : 0)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-500">{goal ? Math.round((totals.conf / goal) * 100) : 0}%</span>
                </div>
              </div>
            </div>
          </div>

          {topProg && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50">🚀</span>
                <h3 className="font-bold text-slate-800">Top Progression</h3>
              </div>
              <div className="flex items-center gap-3">
                <Avatar name={topProg.name} photo={topProg.photo} size={44} ring="#f1f5f9" />
                <div>
                  <p className="font-bold text-slate-800">{topProg.name}</p>
                  <p className="text-lg font-extrabold text-emerald-600">{topProg.delta >= 0 ? "+" : ""}{topProg.delta}%</p>
                  <p className="text-[10px] text-slate-400">vs mois dernier</p>
                </div>
                <span className="ml-auto text-3xl">📈</span>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 p-5 text-center">
            <div className="text-3xl">👑</div>
            <p className="mt-2 font-bold text-violet-800">Continuez votre excellent travail !</p>
            <p className="mt-1 text-sm text-violet-600">Chaque confirmation compte ✨</p>
          </div>
        </div>
      </div>
    </div>
  );
}
