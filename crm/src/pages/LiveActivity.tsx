import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { usePeriod } from "../period";
import type { LogEntry } from "../history";
import type { Order } from "../data/orders";

const nf = (n: number) => n.toLocaleString("fr-FR");
const PHOTOS_KEY = "afrizon_team_photos_v1";

function initials(name: string) {
  const p = (name || "?").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

/** "منذ 3 دقائق" */
function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m === 1) return "منذ دقيقة";
  if (m < 60) return `منذ ${m} دقائق`;
  const h = Math.floor(m / 60);
  if (h === 1) return "منذ ساعة";
  if (h < 24) return `منذ ${h} ساعات`;
  const d = Math.floor(h / 24);
  return d === 1 ? "منذ يوم" : `منذ ${d} أيام`;
}

type Kind = "confirm" | "cancel" | "deliver" | "return" | "ship" | "new" | "delete" | "edit" | "call" | "stock";

const KINDS: Record<Kind, { icon: string; bg: string; fg: string; chipBg: string; chipFg: string; label: string }> = {
  confirm: { icon: "✓", bg: "#dcfce7", fg: "#16a34a", chipBg: "#dcfce7", chipFg: "#15803d", label: "تأكيد جديد" },
  new:     { icon: "📦", bg: "#dbeafe", fg: "#2563eb", chipBg: "#dbeafe", chipFg: "#1d4ed8", label: "طلب جديد" },
  call:    { icon: "📞", bg: "#ffedd5", fg: "#ea580c", chipBg: "#ffedd5", chipFg: "#c2410c", label: "مكالمة" },
  deliver: { icon: "🚚", bg: "#d1fae5", fg: "#059669", chipBg: "#d1fae5", chipFg: "#047857", label: "تم التسليم" },
  ship:    { icon: "🚚", bg: "#fef3c7", fg: "#d97706", chipBg: "#fef3c7", chipFg: "#b45309", label: "تم الشحن" },
  return:  { icon: "↩️", bg: "#fee2e2", fg: "#dc2626", chipBg: "#fee2e2", chipFg: "#b91c1c", label: "إرجاع" },
  cancel:  { icon: "⊗", bg: "#fee2e2", fg: "#dc2626", chipBg: "#fee2e2", chipFg: "#b91c1c", label: "إلغاء طلب" },
  stock:   { icon: "📦", bg: "#cffafe", fg: "#0891b2", chipBg: "#cffafe", chipFg: "#0e7490", label: "نفاد المخزون" },
  delete:  { icon: "🗑️", bg: "#fee2e2", fg: "#dc2626", chipBg: "#fee2e2", chipFg: "#b91c1c", label: "حذف طلب" },
  edit:    { icon: "✏️", bg: "#fef9c3", fg: "#ca8a04", chipBg: "#fef9c3", chipFg: "#a16207", label: "تعديل معلومات" },
};

function classify(l: LogEntry): { kind: Kind; text: string } {
  const who = l.client || "زبون";
  if (l.action === "add") return { kind: "new", text: `أضافت طلب جديد للزبون «${who}»` };
  if (l.action === "delete") return { kind: "delete", text: `حذفت الطلب الخاص بـ «${who}»` };

  const f = l.field || "";
  const after = l.after || "";
  if (f === "Statut") {
    if (after === "Confirmé") return { kind: "confirm", text: `تم تأكيد طلب جديد للزبونة «${who}»` };
    if (after === "Annulé") return { kind: "cancel", text: `تم إلغاء الطلب الخاص بـ «${who}»` };
    if (after.startsWith("Appel")) return { kind: "call", text: `مكالمة (${after}) مع «${who}»` };
    if (after === "Whatssap") return { kind: "call", text: `رسالة واتساب مع «${who}»` };
    return { kind: "edit", text: `تم تحديث حالة «${who}» إلى «${after || "—"}»` };
  }
  if (f === "Livraison") {
    if (after === "Livrée") return { kind: "deliver", text: `تم تسليم طلب «${who}»` };
    if (after === "Retour") return { kind: "return", text: `تم إرجاع طلب «${who}»` };
    if (after.startsWith("Expédier")) return { kind: "ship", text: `تم تحديث حالة طلب «${who}» إلى «تم الشحن»` };
    if (after === "Out Of Stock") return { kind: "stock", text: `طلب «${who}» غير متوفر في المخزون` };
    return { kind: "edit", text: `تم تحديث التوصيل لـ «${who}»` };
  }
  if (f === "Produit") return { kind: "new", text: `تم تغيير المنتج لـ «${who}» إلى «${after}»` };
  if (f === "Prix") return { kind: "edit", text: `تم تعديل ثمن طلب «${who}» إلى ${after} DH` };
  return { kind: "edit", text: `تم تعديل ${f || "معلومات"} للزبونة «${who}»` };
}

const FILTERS: { key: "all" | Kind; label: string }[] = [
  { key: "all", label: "جميع الأنشطة" },
  { key: "confirm", label: "تأكيدات" },
  { key: "new", label: "طلبات جديدة" },
  { key: "deliver", label: "تسليم" },
  { key: "return", label: "إرجاع" },
  { key: "cancel", label: "إلغاء" },
  { key: "call", label: "مكالمات" },
  { key: "edit", label: "تعديلات" },
  { key: "delete", label: "حذف" },
];

export default function LiveActivity() {
  const { logs: allLogs, orders, agentNames } = useStore();
  const { inRange, label } = usePeriod();
  const logs = useMemo(() => allLogs.filter((l) => inRange(l.at.slice(0, 10))), [allLogs, inRange]);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [agent, setAgent] = useState("all");
  const [, setTick] = useState(0);

  // rafraîchit les "منذ X دقائق" toutes les 30s
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const photos: Record<string, string> = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || "{}"); } catch { return {}; }
  }, []);

  const items = useMemo(() => logs.map((l) => ({ log: l, ...classify(l) })), [logs]);
  const shown = items.filter((it) =>
    (filter === "all" || it.kind === filter) &&
    (agent === "all" || it.log.agent === agent)
  ).slice(0, 200);

  // KPIs du jour
  const kpi = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const hourAgo = Date.now() - 3600000;
    const todayLogs = logs.filter((l) => l.at.slice(0, 10) === today);
    const lastHour = (fn: (l: LogEntry) => boolean) => logs.filter((l) => new Date(l.at).getTime() >= hourAgo && fn(l)).length;

    const cmdToday = orders.filter((o: Order) => o.dateCreation === today).length;
    const confToday = todayLogs.filter((l) => l.field === "Statut" && l.after === "Confirmé").length;
    const callsToday = todayLogs.filter((l) => l.field === "Statut" && (l.after?.startsWith("Appel") || l.after === "Whatssap")).length;
    const editsToday = todayLogs.filter((l) => l.action === "edit").length;

    return [
      { label: "الطلبات اليوم", value: cmdToday, delta: lastHour((l) => l.action === "add"), icon: "🛒", bg: "#ede9fe", fg: "#7c3aed" },
      { label: "تأكيدات جديدة", value: confToday, delta: lastHour((l) => l.field === "Statut" && l.after === "Confirmé"), icon: "✅", bg: "#dcfce7", fg: "#16a34a" },
      { label: "مكالمات", value: callsToday, delta: lastHour((l) => l.field === "Statut" && !!l.after?.startsWith("Appel")), icon: "📞", bg: "#dbeafe", fg: "#2563eb" },
      { label: "تعديلات", value: editsToday, delta: lastHour((l) => l.action === "edit"), icon: "✏️", bg: "#fee2e2", fg: "#dc2626" },
    ];
  }, [logs, orders]);

  return (
    <div dir="rtl" className="flex h-full flex-col bg-slate-50">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-red-50 text-xl">📡</div>
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
              Live Activity
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                <i className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> مباشر
              </span>
            </h1>
            <p className="text-sm text-slate-500">راقب نشاط الفريق لحظة بلحظة · <span className="font-bold text-orange-600">⏱ {label}</span></p>
          </div>
          <select value={agent} onChange={(e) => setAgent(e.target.value)}
            className="mr-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium outline-none">
            <option value="all">كل البنات</option>
            {agentNames.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpi.map((k) => (
            <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl" style={{ background: k.bg }}>{k.icon}</div>
              <div className="min-w-0">
                <p className="truncate text-xs text-slate-500">{k.label}</p>
                <p className="text-2xl font-extrabold text-slate-900">{nf(k.value)}</p>
                <p className="text-[11px]">
                  <span className="font-bold" style={{ color: k.delta > 0 ? "#16a34a" : "#94a3b8" }}>
                    {k.delta > 0 ? `+${k.delta}` : "0"}
                  </span>
                  <span className="text-slate-400"> · منذ الساعة الأخيرة</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-700">تصفية:</span>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {f.label}
            </button>
          ))}
          <span className="mr-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{shown.length} نشاط</span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {shown.map((it, i) => {
            const k = KINDS[it.kind];
            const photo = photos[it.log.agent];
            return (
              <div key={it.log.id} className={`flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 ${i ? "border-t border-slate-100" : ""}`}>
                {/* icon */}
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg" style={{ background: k.bg, color: k.fg }}>{k.icon}</div>

                {/* avatar */}
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-xs font-bold text-white">
                  {photo ? <img src={photo} alt={it.log.agent} className="h-full w-full object-cover" /> : initials(it.log.agent || it.log.user)}
                </div>

                {/* text */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{it.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: k.chipBg, color: k.chipFg }}>{k.label}</span>
                    {it.log.agent && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">👤 {it.log.agent}</span>}
                    {it.log.before && it.log.after && (
                      <span className="text-[11px] text-slate-400">
                        <span className="text-red-500 line-through">{it.log.before}</span> ← <span className="font-medium text-emerald-600">{it.log.after}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* time */}
                <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{timeAgo(it.log.at)}</span>
              </div>
            );
          })}

          {!shown.length && (
            <div className="py-20 text-center">
              <div className="text-4xl">📭</div>
              <p className="mt-3 text-slate-400">لا يوجد نشاط بعد — أي تعديل أو إضافة غادي يبان هنا مباشرة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
