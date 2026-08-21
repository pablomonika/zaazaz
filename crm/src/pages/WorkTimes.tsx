import { useMemo, useState } from "react";
import { useStore } from "../store";
import { useAuth } from "../auth";
import { useSessions, type Session } from "../data/worktimes";

/* ═══════════════════════ WORK TIMES ═══════════════════════
   ⏱ Suivi RÉEL des entrées / sorties — Lundi → Dimanche
   Visible uniquement par l'Admin.
   100% lié aux comptes : chaque fille connectée est enregistrée.
   ═══════════════════════════════════════════════════════════ */

const WD = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const dayKey = (iso: string) => iso.slice(0, 10);
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const minutesOf = (s: Session) =>
  Math.max(0, (new Date(s.end || s.lastSeen).getTime() - new Date(s.start).getTime()) / 60000);
const fmtDur = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
const frDate = (key: string) => {
  const d = new Date(key + "T12:00:00");
  return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const AVATAR_COLORS = [
  "from-indigo-500 to-violet-600", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-slate-500 to-slate-700",
];
const avatarColor = (n: string) => AVATAR_COLORS[[...(n || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

type DayRow = {
  user: string; agent: string; day: string; entry: string; exit: string | null; live: boolean;
  minutes: number; sessions: number; actions: number;
};

export default function WorkTimes() {
  const { logs } = useStore();
  const { currentUser, users } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const sessions = useSessions();

  const todayKey = new Date().toISOString().slice(0, 10);
  const weekStart = (() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.toISOString().slice(0, 10); })();

  const [who, setWho] = useState("all");
  const [from, setFrom] = useState(weekStart);
  const [to, setTo] = useState(todayKey);

  /* comptes réels : username → rôle / page de la fille */
  const adminNames = useMemo(() => new Set(users.filter((u) => u.role === "admin").map((u) => u.username)), [users]);
  const agentOf = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u) => { if (u.role === "user") m.set(u.username, u.agent); });
    return m;
  }, [users]);

  /* ── Fusion sessions par (fille, jour) — comptes réels uniquement ── */
  const allRows = useMemo<DayRow[]>(() => {
    const map = new Map<string, DayRow>();
    sessions.forEach((s) => {
      if (adminNames.has(s.user)) return; // l'admin lui-même n'est pas compté
      const k = `${s.user}|${dayKey(s.start)}`;
      const live = !s.end;
      const e = map.get(k);
      if (!e) {
        map.set(k, {
          user: s.user, agent: s.agent || agentOf.get(s.user) || "", day: dayKey(s.start),
          entry: s.start, exit: s.end || (live ? null : s.lastSeen),
          live, minutes: minutesOf(s), sessions: 1, actions: 0,
        });
      } else {
        if (s.start < e.entry) e.entry = s.start;
        if (!e.exit || (s.end && s.end > e.exit)) e.exit = s.end;
        if (live) { e.live = true; e.exit = null; }
        e.minutes += minutesOf(s);
        e.sessions += 1;
      }
    });
    const rows = [...map.values()];
    logs.forEach((l) => {
      const r = rows.find((x) => x.user === l.user && x.day === dayKey(l.at));
      if (r) r.actions += 1;
    });
    return rows;
  }, [sessions, logs, adminNames, agentOf]);

  const filtered = useMemo(() => allRows
    .filter((r) => (who === "all" || r.user === who))
    .filter((r) => (!from || r.day >= from) && (!to || r.day <= to))
    .sort((a, b) => (a.day === b.day ? a.entry.localeCompare(b.entry) : b.day.localeCompare(a.day))),
    [allRows, who, from, to]);

  const girls = useMemo(() => [...new Set(allRows.map((r) => r.user))].sort(), [allRows]);

  /* ── KPI ── */
  const stats = useMemo(() => {
    const totalMin = filtered.reduce((s, r) => s + r.minutes, 0);
    const per = new Map<string, number>();
    filtered.forEach((r) => per.set(r.user, (per.get(r.user) || 0) + r.minutes));
    const rank = [...per.entries()].sort((a, b) => b[1] - a[1]);
    const liveNow = allRows.filter((r) => r.live && r.day === todayKey).length;
    return {
      totalMin, rank,
      top: rank[0] ? { name: rank[0][0], min: rank[0][1], pct: totalMin ? Math.round((rank[0][1] / totalMin) * 100) : 0 } : null,
      least: rank.length > 1 ? { name: rank[rank.length - 1][0], min: rank[rank.length - 1][1], pct: totalMin ? Math.round((rank[rank.length - 1][1] / totalMin) * 100) : 0 } : null,
      liveNow,
    };
  }, [filtered, allRows, todayKey]);

  /* ── Jours groupés ── */
  const byDay = useMemo(() => {
    const m = new Map<string, DayRow[]>();
    filtered.forEach((r) => {
      if (!m.has(r.day)) m.set(r.day, []);
      m.get(r.day)!.push(r);
    });
    return [...m.entries()];
  }, [filtered]);

  /* ── Grille hebdo (7 derniers jours avec données) ── */
  const weekDays = useMemo(() => {
    const days = [...new Set(allRows.map((r) => r.day))].sort().slice(-7);
    return days;
  }, [allRows]);
  const maxCell = Math.max(60, ...allRows.filter((r) => weekDays.includes(r.day)).map((r) => r.minutes));
  const cellOf = (girl: string, day: string) => {
    const r = allRows.find((x) => x.user === girl && x.day === day);
    return r ? r.minutes : 0;
  };

  if (!isAdmin) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <div className="mb-3 text-4xl">🔒</div>
          <p className="font-bold text-slate-600">Work Times — صفحة الأدمين فقط</p>
          <p className="mt-1 text-xs text-slate-400">مسموحة غير للمسؤول العام</p>
        </div>
      </div>
    );
  }

  const Kpi = ({ icon, label, value, sub, color, bg }: { icon: string; label: string; value: string; sub?: string; color: string; bg: string }) => (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: bg, color }}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-lg font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{label}</div>
        {sub && <div className="truncate text-[10px] text-slate-400">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="bg-slate-50 p-5 text-sm text-slate-800">
      {/* ── En-tête ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-xl text-white shadow-lg shadow-rose-200">⏰</div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">Work Times <span className="text-slate-400">·</span> <span className="text-rose-600">أوقات الفريق</span></h1>
          <p className="text-xs text-slate-500">وقت الدخول والخروج من الشيت — حقيقي 100% ومربوط بحسابات البنات · خاص بالأدمين 🔒</p>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon="⏱" label="مجموع ساعات الفريق (الفترة)" value={fmtDur(stats.totalMin)} color="#1e293b" bg="#f1f5f9" />
        <Kpi icon="🟢" label="داخلات للشيت دابا (LIVE)" value={`${stats.liveNow}`} sub="جلسة مفتوحة دابا" color="#059669" bg="#d1fae5" />
        <Kpi icon="🥇" label="الأكثر دخولاً" value={stats.top?.name || "—"} sub={stats.top ? `${fmtDur(stats.top.min)} · ${stats.top.pct}%` : undefined} color="#b45309" bg="#fef3c7" />
        <Kpi icon="💤" label="الأقل دخولاً" value={stats.least?.name || "—"} sub={stats.least ? `${fmtDur(stats.least.min)} · ${stats.least.pct}%` : undefined} color="#dc2626" bg="#fee2e2" />
      </div>

      {/* ── Filtres ── */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["today", "اليوم"],
            ["week", "هاد الأسبوع"],
            ["last7", "آخر 7 أيام"],
            ["all", "الكل"],
          ] as const).map(([k, label]) => {
            const active = (k === "today" && from === todayKey && to === todayKey)
              || (k === "week" && from === weekStart && to === todayKey)
              || (k === "all" && !from && !to)
              || (k === "last7" && from === new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10) && to === todayKey);
            return (
              <button key={k} onClick={() => {
                if (k === "today") { setFrom(todayKey); setTo(todayKey); }
                else if (k === "week") { setFrom(weekStart); setTo(todayKey); }
                else if (k === "last7") { setFrom(new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)); setTo(todayKey); }
                else { setFrom(""); setTo(""); }
              }}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition ${active ? "bg-rose-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {label}
              </button>
            );
          })}
          <span className="h-6 w-px bg-slate-200" />
          <select value={who} onChange={(e) => setWho(e.target.value)}
            className="cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100">
            <option value="all">👩 كل البنات</option>
            {girls.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-rose-400" /> من
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-400" />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <i className="h-2 w-2 rounded-full bg-orange-400" /> إلى
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-rose-400" />
          </label>
          <span className="ms-auto rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-500">{filtered.length} سطر · {byDay.length} أيام</span>
        </div>
      </div>

      {/* ── Structure : entrées / sorties par jour ── */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-50 text-base text-rose-600">🗂️</span>
          <h3 className="text-sm font-bold text-slate-800">La structure — الدخول والخروج بالوقت</h3>
        </div>
        <div className="max-h-[46vh] overflow-auto">
          {byDay.map(([day, rows]) => {
            const dayTotal = rows.reduce((s, r) => s + r.minutes, 0);
            const isToday = day === todayKey;
            return (
              <div key={day}>
                <div dir="ltr" className={`sticky top-0 z-10 flex items-center gap-2 border-y border-slate-100 px-4 py-2 text-[11px] font-bold backdrop-blur ${isToday ? "bg-rose-50/90 text-rose-700" : "bg-slate-50/90 text-slate-600"}`}>
                  <span>{frDate(day)}</span>
                  {isToday && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] text-white">اليوم</span>}
                  <span className="ms-auto font-semibold text-slate-400">{rows.length} بنات · {fmtDur(dayTotal)}</span>
                </div>
                {rows.map((r) => (
                  <div key={r.user} className="grid min-w-[560px] grid-cols-[1.4fr_1fr_1fr_1fr_0.7fr] items-center gap-2 border-b border-slate-50 px-4 py-2.5 transition hover:bg-rose-50/30" dir="ltr">
                    {/* fille */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${avatarColor(r.user)}`}>
                        {r.user.charAt(0).toUpperCase()}
                        {r.live && <i className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-white bg-emerald-500" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-slate-800">{r.user}</span>
                          {r.agent && <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold text-slate-500">{r.agent}</span>}
                        </div>
                        <div className="text-[9px] text-slate-400">{r.sessions > 1 ? `${r.sessions} جلسات` : "جلسة واحدة"}{r.actions ? ` · ⚡ ${r.actions} عمليات` : ""}</div>
                      </div>
                    </div>
                    {/* entrée */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <i className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-bold text-emerald-700">{hhmm(r.entry)}</span>
                      <span className="text-[9px] text-slate-400">دخلت</span>
                    </div>
                    {/* sortie */}
                    {r.live ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> مازالة داخلة
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs">
                        <i className="h-2 w-2 rounded-full bg-red-400" />
                        <span className="font-bold text-red-600">{r.exit ? hhmm(r.exit) : "—"}</span>
                        <span className="text-[9px] text-slate-400">خرجات</span>
                      </div>
                    )}
                    {/* durée */}
                    <span className="w-fit rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">⏱ {fmtDur(r.minutes)}</span>
                    {/* part du jour */}
                    <span className="text-center text-[11px] font-bold text-slate-500">
                      {dayTotal ? Math.round((r.minutes / dayTotal) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
          {!byDay.length && (
            <div className="p-12 text-center">
              <div className="mb-3 text-4xl">⏳</div>
              <p className="text-sm font-bold text-slate-600">ما كاين حتى دخول مسجل دابا — هادي عادية!</p>
              <div className="mx-auto mt-4 max-w-md rounded-2xl border border-slate-200 bg-slate-50 p-4 text-start text-xs leading-6 text-slate-600">
                <p className="mb-2 font-bold text-slate-700">كيفاش كايخدم التسجيل (أوتوماتيك):</p>
                <p>1️⃣ صايب حساب لكل بنت من صفحة <b>🔐 Users</b> (سمية + كلمة سر + الصفحة ديالها)</p>
                <p>2️⃣ البنت كتدخل بحسابها فـ صفحة <b>Login</b> → كايتسجل وقت الدخول 🟢</p>
                <p>3️⃣ ملي تخرج (Logout ولا تسد المتصفح) → كايتسجل وقت الخروج 🔴</p>
                <p>4️⃣ الساعات كتحسب وحدها وكيبانو كلشي هنا</p>
              </div>
              <p className="mt-3 text-[11px] text-slate-400">ما كاين حتى داتا عشوائية — غير الجلسات الحقيقية ديال البنات</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Grille hebdomadaire ── */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-base text-orange-600">🗓️</span>
          <h3 className="text-sm font-bold text-slate-800">الأسبوع فـ نظرة — ساعات كل بنت كل نهار</h3>
          <span className="ms-auto hidden text-[10px] text-slate-400 sm:block">اللون الغامق = ساعات أكثر</span>
        </div>
        <div className="overflow-x-auto" dir="ltr">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2 text-start">Fille</th>
                {weekDays.map((d) => (
                  <th key={d} className={`px-2 py-2 text-center ${d === todayKey ? "text-rose-600" : ""}`}>
                    {frDate(d).split(" ")[0].slice(0, 3)}<span className="text-slate-400"> {d.slice(8)}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-center text-slate-700">Total</th>
              </tr>
            </thead>
            <tbody>
              {girls.map((g) => {
                const total = weekDays.reduce((s, d) => s + cellOf(g, d), 0);
                return (
                  <tr key={g} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br text-[9px] font-bold text-white ${avatarColor(g)}`}>{g.charAt(0).toUpperCase()}</span>
                        <span className="text-xs font-bold text-slate-700">{g}</span>
                      </div>
                    </td>
                    {weekDays.map((d) => {
                      const m = cellOf(g, d);
                      const intensity = m / maxCell;
                      const bg = !m ? "bg-slate-50 text-slate-300"
                        : intensity > 0.75 ? "bg-orange-500 text-white"
                        : intensity > 0.5 ? "bg-orange-300 text-orange-950"
                        : intensity > 0.25 ? "bg-orange-200 text-orange-900"
                        : "bg-orange-100 text-orange-800";
                      return (
                        <td key={d} className="p-1 text-center">
                          <div className={`rounded-lg px-1.5 py-1.5 text-[10px] font-bold ${bg}`} title={`${frDate(d)} — ${g}`}>
                            {m ? fmtDur(m).replace(" ", "") : "—"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-1 text-center">
                      <span className="rounded-lg bg-slate-800 px-2 py-1.5 text-[10px] font-bold text-white">{fmtDur(total).replace(" ", "")}</span>
                    </td>
                  </tr>
                );
              })}
              {!girls.length && (
                <tr><td colSpan={9} className="p-8 text-center text-xs text-slate-400">ما كاين حتى داتا دابا</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Classement : plus / moins de présence ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-base text-amber-600">🏆</span>
          <h3 className="text-sm font-bold text-slate-800">أكثر البنات دخولاً للشيت — بالنسبة المئوية</h3>
        </div>
        <div className="space-y-2.5">
          {stats.rank.map(([name, min], i) => {
            const pct = stats.totalMin ? Math.round((min / stats.totalMin) * 100) : 0;
            const medal = ["🥇", "🥈", "🥉"][i];
            const isLeast = i === stats.rank.length - 1 && stats.rank.length > 1;
            return (
              <div key={name} className="flex items-center gap-3">
                <span className="w-7 shrink-0 text-center text-sm">{medal || <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>}</span>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white ${avatarColor(name)}`}>{name.charAt(0).toUpperCase()}</span>
                <span className="w-20 shrink-0 truncate text-xs font-bold text-slate-700" title={name}>{name}</span>
                <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={`flex h-full items-center justify-end rounded-full pe-2 text-[9px] font-bold text-white transition-all ${isLeast ? "bg-gradient-to-l from-red-400 to-red-500" : i === 0 ? "bg-gradient-to-l from-amber-400 to-amber-500" : "bg-gradient-to-l from-indigo-400 to-indigo-500"}`}
                    style={{ width: `${Math.max(pct, 8)}%` }}>
                    {pct}%
                  </div>
                </div>
                <span className="w-16 shrink-0 text-end text-[11px] font-bold text-slate-600">{fmtDur(min)}</span>
                {isLeast && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-600">💤 الأقل</span>}
                {i === 0 && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">👑 الأكثر</span>}
              </div>
            );
          })}
          {!stats.rank.length && <p className="py-6 text-center text-xs text-slate-400">ما كاين حتى داتا فهاد الفترة</p>}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-400">
          💡 النسبة المئوية = حصة كل بنت من مجموع ساعات الفريق كامل فـ الفترة المختارة
        </p>
      </div>
    </div>
  );
}
