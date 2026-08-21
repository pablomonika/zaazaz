import { useMemo, useState } from "react";
import { useStore } from "../store";
import { usePeriod } from "../period";
import type { LogEntry } from "../history";

const nf = (n: number) => n.toLocaleString("fr-FR");
const PHOTOS_KEY = "afrizon_team_photos_v1";
const HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17];
const hLabel = (h: number) => `${String(h).padStart(2, "0")}h`;

/** Couleur selon le score (0-100) */
function scoreColor(v: number) {
  if (v >= 80) return { bg: "#16a34a", text: "#fff", tag: "ممتاز" };      // vert
  if (v >= 60) return { bg: "#ca8a04", text: "#fff", tag: "جيد" };        // jaune
  if (v > 0) return { bg: "#b91c1c", text: "#fff", tag: "ضعيف" };         // rouge
  return { bg: "#1e293b", text: "#64748b", tag: "—" };
}

function initials(n: string) {
  const p = (n || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

/* ── Courbe de performance ── */
function Curve({ pts }: { pts: { h: number; v: number }[] }) {
  const W = 900, H = 300, PL = 46, PR = 16, PT = 26, PB = 34;
  const x = (i: number) => PL + (i * (W - PL - PR)) / Math.max(1, pts.length - 1);
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / 100);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.v)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${H - PB} L${PL},${H - PB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }}>
      <defs>
        <linearGradient id="hgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 20, 40, 60, 80, 100].map((v) => (
        <g key={v}>
          <line x1={PL} y1={y(v)} x2={W - PR} y2={y(v)} stroke="#334155" strokeWidth="1" strokeDasharray="3 4" />
          <text x={PL - 10} y={y(v) + 4} textAnchor="end" style={{ fontSize: 12, fill: "#64748b" }}>{v}%</text>
        </g>
      ))}
      <path d={area} fill="url(#hgrad)" />
      <path d={line} fill="none" stroke="#22c55e" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const c = scoreColor(p.v);
        return (
          <g key={p.h}>
            <circle cx={x(i)} cy={y(p.v)} r="6" fill="#0f172a" stroke={c.bg} strokeWidth="3" />
            <text x={x(i)} y={y(p.v) - 14} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: c.bg }}>{p.v}%</text>
            <text x={x(i)} y={H - 10} textAnchor="middle" style={{ fontSize: 12, fill: "#94a3b8" }}>{hLabel(p.h)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Donut répartition ── */
function Donut({ good, mid, low }: { good: number; mid: number; low: number }) {
  const total = good + mid + low || 1;
  const R = 62, C = 2 * Math.PI * R, gap = 5;
  let off = 0;
  const segs = [
    { v: good, c: "#16a34a" },
    { v: mid, c: "#eab308" },
    { v: low, c: "#dc2626" },
  ].map((s) => {
    const len = (s.v / total) * (C - gap * 3);
    const o = off; off += len + gap;
    return { ...s, len, o };
  });

  return (
    <svg width="170" height="170" viewBox="0 0 170 170">
      <g transform="rotate(-90 85 85)">
        <circle cx="85" cy="85" r={R} fill="none" stroke="#1e293b" strokeWidth="22" />
        {segs.filter((s) => s.v > 0).map((s, i) => (
          <circle key={i} cx="85" cy="85" r={R} fill="none" stroke={s.c} strokeWidth="22"
            strokeDasharray={`${s.len} ${C - s.len}`} strokeDashoffset={-s.o} strokeLinecap="round" />
        ))}
      </g>
      <text x="85" y="80" textAnchor="middle" style={{ fontSize: 12, fill: "#94a3b8" }}>إجمالي الساعات</text>
      <text x="85" y="106" textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: "#fff" }}>{good + mid + low}</text>
    </svg>
  );
}

export default function Heatmap() {
  const { logs, orders, agentNames } = useStore();
  const { inRange, label } = usePeriod();
  const [agentFilter, setAgentFilter] = useState("all");

  const photos: Record<string, string> = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); } catch { return {}; }
  }, []);

  const periodLogs = useMemo(
    () => logs.filter((l: LogEntry) => inRange(l.at.slice(0, 10))),
    [logs, inRange]
  );

  /** Activité par heure : nb d'actions + nb de confirmations */
  const byHour = useMemo(() => {
    const map = new Map<number, { total: number; positive: number }>();
    HOURS.forEach((h) => map.set(h, { total: 0, positive: 0 }));
    periodLogs.forEach((l) => {
      if (agentFilter !== "all" && l.agent !== agentFilter) return;
      const h = new Date(l.at).getHours();
      if (!map.has(h)) return;
      const e = map.get(h)!;
      e.total += 1;
      const good = (l.field === "Statut" && l.after === "Confirmé")
        || (l.field === "Livraison" && l.after === "Livrée")
        || l.action === "add";
      if (good) e.positive += 1;
    });
    const maxTotal = Math.max(1, ...[...map.values()].map((v) => v.total));
    return HOURS.map((h) => {
      const e = map.get(h)!;
      // score = mix entre volume (40%) et qualité (60%)
      const volume = (e.total / maxTotal) * 100;
      const quality = e.total ? (e.positive / e.total) * 100 : 0;
      const v = Math.round(volume * 0.4 + quality * 0.6);
      return { h, v, cmd: e.total, ok: e.positive };
    });
  }, [periodLogs, agentFilter]);

  /** Matrice fille × heure */
  const matrix = useMemo(() => agentNames.map((name) => {
    const cells = HOURS.map((h) => {
      const list = periodLogs.filter((l) => l.agent === name && new Date(l.at).getHours() === h);
      const good = list.filter((l) =>
        (l.field === "Statut" && l.after === "Confirmé")
        || (l.field === "Livraison" && l.after === "Livrée")
        || l.action === "add").length;
      const v = list.length ? Math.round((good / list.length) * 100) : 0;
      return { h, v, n: list.length };
    });
    const active = cells.filter((c) => c.n > 0);
    const avg = active.length ? Math.round(active.reduce((s, c) => s + c.v, 0) / active.length) : 0;
    return { name, cells, avg, photo: photos[name] };
  }), [agentNames, periodLogs, photos]);

  const stats = useMemo(() => {
    const active = byHour.filter((b) => b.cmd > 0);
    const avg = active.length ? Math.round(active.reduce((s, b) => s + b.v, 0) / active.length) : 0;
    const best = [...active].sort((a, b) => b.v - a.v)[0];
    const worst = [...active].sort((a, b) => a.v - b.v)[0];
    const today = new Date().toISOString().slice(0, 10);
    const cmdToday = orders.filter((o) => o.dateCreation === today).length;
    const good = byHour.filter((b) => b.v >= 80).length;
    const mid = byHour.filter((b) => b.v >= 60 && b.v < 80).length;
    const low = byHour.filter((b) => b.v > 0 && b.v < 60).length;
    const totalCmd = byHour.reduce((s, b) => s + b.cmd, 0);
    return { avg, best, worst, cmdToday, good, mid, low, totalCmd, activeAgents: matrix.filter((m) => m.avg > 0).length };
  }, [byHour, orders, matrix]);

  const peak = [...byHour].filter((b) => b.cmd > 0).sort((a, b) => b.v - a.v).slice(0, 3);
  const lowest = [...byHour].filter((b) => b.cmd > 0).sort((a, b) => a.v - b.v).slice(0, 2);

  const Card = ({ title, value, sub, icon, color }: { title: string; value: string; sub: string; icon: string; color: string }) => (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400">{title}</p>
          <p className="mt-1 text-3xl font-extrabold text-white">{value}</p>
          <p className="mt-0.5 text-xs font-medium" style={{ color }}>{sub}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl text-xl" style={{ background: color + "22" }}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="h-full overflow-auto bg-slate-900 p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500/20 text-xl">🔥</div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Heatmap — ساعات العمل</h1>
          <p className="text-sm text-slate-400">أداء الفريق حسب الساعة · <span className="font-bold text-orange-400">⏱ {label}</span></p>
        </div>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}
          className="mr-auto rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-white outline-none">
          <option value="all">جميع الموظفات</option>
          {agentNames.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card title="متوسط الأداء اليومي" value={`${stats.avg}%`} sub="على الفترة المختارة" icon="📈" color="#8b5cf6" />
        <Card title="أفضل ساعة أداء" value={stats.best ? hLabel(stats.best.h) : "—"} sub={stats.best ? `${stats.best.v}% فعالية` : "لا يوجد"} icon="⬆️" color="#22c55e" />
        <Card title="أضعف ساعة أداء" value={stats.worst ? hLabel(stats.worst.h) : "—"} sub={stats.worst ? `${stats.worst.v}% فعالية` : "لا يوجد"} icon="⬇️" color="#ef4444" />
        <Card title="إجمالي الأنشطة" value={nf(stats.totalCmd)} sub="خلال الفترة" icon="🛒" color="#3b82f6" />
        <Card title="الموظفات النشيطات" value={`${stats.activeAgents}/${agentNames.length}`} sub="متصلات الآن" icon="👥" color="#14b8a6" />
      </div>

      {/* Curve + Donut */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-bold text-white">👥 أداء الفريق حسب الساعة</h3>
          <div className="overflow-x-auto"><Curve pts={byHour} /></div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
          <h3 className="mb-3 font-bold text-white">توزيع الفعالية</h3>
          <div className="flex justify-center"><Donut good={stats.good} mid={stats.mid} low={stats.low} /></div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-green-600" /> ممتاز (80% - 100%)</span>
              <b className="text-white">{stats.good}</b>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-yellow-500" /> جيد (60% - 79%)</span>
              <b className="text-white">{stats.mid}</b>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-red-600" /> ضعيف (أقل من 60%)</span>
              <b className="text-white">{stats.low}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Peak / Low */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/40 p-5">
          <h3 className="mb-3 font-bold text-emerald-400">🔥 Peak Performance Hours</h3>
          <div className="space-y-2">
            {peak.map((p) => (
              <div key={p.h} className="flex items-center gap-3">
                <span className="w-12 font-bold text-white">{hLabel(p.h)}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-700">
                  <div className="h-2.5 rounded-full bg-emerald-500" style={{ width: `${p.v}%` }} />
                </div>
                <span className="w-12 text-left font-bold text-emerald-400">{p.v}%</span>
                <span className="w-20 text-xs text-slate-400">{p.cmd} نشاط</span>
              </div>
            ))}
            {!peak.length && <p className="text-sm text-slate-500">لا توجد بيانات كافية</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-red-900 bg-red-950/30 p-5">
          <h3 className="mb-3 font-bold text-red-400">⚠️ Low Performance</h3>
          <div className="space-y-2">
            {lowest.map((p) => (
              <div key={p.h} className="flex items-center gap-3">
                <span className="w-12 font-bold text-white">{hLabel(p.h)}</span>
                <div className="h-2.5 flex-1 rounded-full bg-slate-700">
                  <div className="h-2.5 rounded-full bg-red-500" style={{ width: `${p.v}%` }} />
                </div>
                <span className="w-12 text-left font-bold text-red-400">{p.v}%</span>
                <span className="w-20 text-xs text-slate-400">{p.cmd} نشاط</span>
              </div>
            ))}
            {!lowest.length && <p className="text-sm text-slate-500">لا توجد بيانات كافية</p>}
          </div>
        </div>
      </div>

      {/* Matrice fille × heure */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60">
        <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-3">
          <span className="text-lg">🕐</span>
          <h3 className="font-bold text-white">الموظفات حسب الساعة</h3>
          <div className="mr-auto flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-300"><i className="h-3 w-3 rounded bg-green-600" /> Excellent</span>
            <span className="flex items-center gap-1.5 text-slate-300"><i className="h-3 w-3 rounded bg-yellow-600" /> Normal</span>
            <span className="flex items-center gap-1.5 text-slate-300"><i className="h-3 w-3 rounded bg-red-700" /> Faible</span>
          </div>
        </div>
        <div className="overflow-x-auto p-3">
          <table className="w-full border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="sticky right-0 bg-slate-800 px-3 py-2 text-right text-xs font-bold text-slate-300">الموظفة</th>
                {HOURS.map((h) => <th key={h} className="px-2 py-2 text-center text-xs font-bold text-slate-300">{hLabel(h)}</th>)}
                <th className="px-2 py-2 text-center text-xs font-bold text-slate-300">المعدل</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.name}>
                  <td className="sticky right-0 bg-slate-800 px-3 py-1">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-600 text-[10px] font-bold text-white">
                        {row.photo ? <img src={row.photo} alt={row.name} className="h-full w-full object-cover" /> : initials(row.name)}
                      </div>
                      <span className="whitespace-nowrap text-sm font-medium text-white">{row.name}</span>
                    </div>
                  </td>
                  {row.cells.map((c) => {
                    const col = scoreColor(c.v);
                    return (
                      <td key={c.h} title={`${row.name} · ${hLabel(c.h)} · ${c.n} نشاط`}
                        className="rounded-md px-2 py-2 text-center text-xs font-bold transition hover:scale-105"
                        style={{ background: col.bg, color: col.text }}>
                        {c.n ? `${c.v}%` : "—"}
                      </td>
                    );
                  })}
                  <td className="rounded-md bg-slate-700 px-2 py-2 text-center text-xs font-extrabold text-white">{row.avg}%</td>
                </tr>
              ))}
              {!matrix.length && <tr><td colSpan={HOURS.length + 2} className="py-8 text-center text-slate-500">لا توجد بيانات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Résumé intelligent */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-900 bg-blue-950/40 p-4">
          <h4 className="mb-1 flex items-center gap-2 font-bold text-blue-300">💡 ملخص ذكي</h4>
          <p className="text-sm text-slate-300">
            {peak.length
              ? <>يكون الفريق أكثر فعالية في الساعات <b className="text-emerald-400">{peak.map((p) => hLabel(p.h)).join("، ")}</b>. حاول تجنب توزيع مهام كثيرة في <b className="text-red-400">{lowest.map((p) => hLabel(p.h)).join("، ")}</b>.</>
              : "لا توجد بيانات كافية بعد — استمر في العمل وستظهر التحليلات."}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-900 bg-amber-950/30 p-4">
          <h4 className="mb-1 flex items-center gap-2 font-bold text-amber-300">💡 نصيحة</h4>
          <p className="text-sm text-slate-300">حاول توزيع أكبر عدد من الطلبات خلال الساعات الخضراء لزيادة الإنتاجية وتحقيق أفضل النتائج.</p>
        </div>
      </div>
    </div>
  );
}
