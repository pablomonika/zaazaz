import { useMemo, useState } from "react";
import { useStore, exportCSV } from "../store";
import { formatDate, type LogEntry } from "../history";
import Btn from "../components/Btn";

/* ═══════════════════════ Historique ═══════════════════════
   Journal des modifications — ajout / edit / delete
   ═══════════════════════════════════════════════════════════ */

const ACTIONS = {
  add:    { label: "Ajout",        icon: "＋",    cls: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  edit:   { label: "Modification", icon: "✏️",   cls: "bg-blue-100 text-blue-800",       dot: "bg-blue-500" },
  delete: { label: "Suppression",  icon: "🗑️", cls: "bg-red-100 text-red-800",          dot: "bg-red-500" },
} as const;

/* Couleur d'avatar stable par utilisateur */
const AVATAR_COLORS = [
  "from-indigo-500 to-violet-600", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-slate-500 to-slate-700",
];
const avatarColor = (name: string) =>
  AVATAR_COLORS[[...(name || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

function Kpi({ icon, label, value, color, bg, on, active, onClick }: {
  icon: string; label: string; value: number; color: string; bg: string; on?: boolean; active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-start transition-all ${
        active
          ? "border-indigo-300 bg-indigo-50 shadow-md"
          : `border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${onClick ? "hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md" : "cursor-default"}`
      }`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: on ? undefined : bg, color }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xl font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{label}</div>
      </div>
    </button>
  );
}

export default function Historique({ agent }: { agent?: string }) {
  const { logs, agentNames, clearLogs } = useStore();
  const [q, setQ] = useState("");
  const [who, setWho] = useState("all");
  const [act, setAct] = useState<"all" | "add" | "edit" | "delete">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return logs.filter((l: LogEntry) => {
      if (agent && l.agent.toLowerCase() !== agent.toLowerCase()) return false;
      if (who !== "all" && l.user !== who) return false;
      if (act !== "all" && l.action !== act) return false;
      const day = l.at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (s && ![l.user, l.agent, l.client, l.field, l.before, l.after, l.snapshot].join(" ").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [logs, agent, who, act, from, to, q]);

  const users = useMemo(() => [...new Set(logs.map((l) => l.user))], [logs]);
  const counts = useMemo(() => ({
    add: rows.filter((l) => l.action === "add").length,
    edit: rows.filter((l) => l.action === "edit").length,
    delete: rows.filter((l) => l.action === "delete").length,
  }), [rows]);

  const sel = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div dir="ltr" className="h-full overflow-auto bg-slate-50 text-sm">
      <div className="mx-auto max-w-7xl p-5">

        {/* ── En-tête ── */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-xl text-white shadow-lg shadow-slate-300">🕘</div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800">
              Historique {agent ? <span className="text-indigo-600">— {agent}</span> : "des modifications"}
            </h1>
            <p className="text-xs text-slate-500">كل ما تزاد ولا تبدل ولا تمسح فـ الطلبيات — مسجل بالتاريخ والوقت والمستخدم</p>
          </div>

          <div className="ms-auto flex gap-2">
            <Btn
              icon="📥" color="teal"
              onClick={() => exportCSV(rows.map((l) => ({
                Date: formatDate(l.at), Utilisateur: l.user, Page: l.agent, Action: ACTIONS[l.action].label,
                Client: l.client, Champ: l.field || "", Avant: l.before || "", Après: l.after || "", Détail: l.snapshot || "",
              })), `historique${agent ? "-" + agent : ""}`)}
              title="تصدير السجل CSV">Exporter CSV</Btn>
            {!agent && (
              <Btn icon="🗑️" color="red" variant="ghost" onClick={() => confirm("Effacer tout l'historique ?") && clearLogs()} title="مسح كل السجل">Vider</Btn>
            )}
          </div>
        </div>

        {/* ── KPI cliquables (= filtre action) ── */}
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon="⚡" label="مجموع العمليات" value={rows.length} color="#1e293b" bg="#f1f5f9"
            active={act === "all"} onClick={() => setAct("all")} />
          <Kpi icon="＋" label="Ajout" value={counts.add} color="#059669" bg="#d1fae5"
            active={act === "add"} onClick={() => setAct(act === "add" ? "all" : "add")} />
          <Kpi icon="✏️" label="Modification" value={counts.edit} color="#2563eb" bg="#dbeafe"
            active={act === "edit"} onClick={() => setAct(act === "edit" ? "all" : "edit")} />
          <Kpi icon="🗑️" label="Suppression" value={counts.delete} color="#dc2626" bg="#fee2e2"
            active={act === "delete"} onClick={() => setAct(act === "delete" ? "all" : "delete")} />
        </div>

        {/* ── Filtres ── */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <span className="pointer-events-none absolute inset-y-0 start-2.5 grid place-items-center text-slate-400">🔎</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher (client, champ, valeur…)" className={sel + " w-full ps-8"} />
            </div>
            <select value={who} onChange={(e) => setWho(e.target.value)} className={sel + " cursor-pointer"}>
              <option value="all">👤 Tous les utilisateurs</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <i className="h-2 w-2 rounded-full bg-indigo-400" /> Du
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={sel} />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <i className="h-2 w-2 rounded-full bg-violet-400" /> Au
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={sel} />
            </label>
            {(q || who !== "all" || act !== "all" || from || to) && (
              <Btn icon="✕" color="slate" variant="ghost" onClick={() => { setQ(""); setWho("all"); setAct("all"); setFrom(""); setTo(""); }}>Réinitialiser</Btn>
            )}
          </div>
        </div>

        {/* ── Tableau ── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-slate-100 bg-slate-50/90 backdrop-blur text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5 text-start">Date & heure</th>
                  <th className="px-3 py-2.5 text-start">Utilisateur</th>
                  <th className="px-3 py-2.5 text-start">Page</th>
                  <th className="px-3 py-2.5 text-start">Action</th>
                  <th className="px-3 py-2.5 text-start">Client</th>
                  <th className="px-3 py-2.5 text-start">Champ</th>
                  <th className="px-3 py-2.5 text-start">Avant → Après</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const a = ACTIONS[l.action];
                  const [day, time] = formatDate(l.at).split(" ");
                  return (
                    <tr key={l.id} className="group border-b border-slate-50 transition hover:bg-indigo-50/40">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <div className="text-xs font-semibold text-slate-700">{day}</div>
                        <div className="text-[10px] text-slate-400">🕐 {time.slice(0, 5)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-sm ${avatarColor(l.user)}`}>
                            {(l.user || "?").charAt(0).toUpperCase()}
                          </span>
                          <span className="max-w-[130px] truncate text-xs font-bold text-slate-800" title={l.user}>{l.user}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {l.agent
                          ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{l.agent}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${a.cls}`}>
                          <i className={`h-1.5 w-1.5 rounded-full ${a.dot}`} /> {a.label}
                        </span>
                      </td>
                      <td className="max-w-[150px] truncate px-3 py-2.5 text-xs font-semibold text-slate-700" title={l.client}>
                        {l.client || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {l.field
                          ? <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">{l.field}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {l.action === "edit" && (l.before || l.after) ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {l.before && <span className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 line-through decoration-red-300">{l.before}</span>}
                            {l.before && l.after && <span className="text-slate-400">→</span>}
                            {l.after && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">{l.after}</span>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">{l.snapshot || "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!rows.length && (
              <div className="p-14 text-center">
                <div className="mb-3 text-4xl">🗂️</div>
                <p className="text-sm font-semibold text-slate-500">Aucune action enregistrée</p>
                <p className="mt-1 text-xs text-slate-400">العمليات غادي تبان هنا ملي يبداو الخدمة فـ الطلبيات</p>
              </div>
            )}
          </div>
        </div>

        {!agent && agentNames.length > 0 && (
          <p className="mt-3 text-center text-[10px] text-slate-400">
            💡 كل تعديل كايتسجل تلقائياً — من عند شكون، فـ أية صفحة، وفـ أشمن خنة — بصيغة قبل → بعد
          </p>
        )}
      </div>
    </div>
  );
}
