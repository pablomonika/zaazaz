import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PeriodKey = "today" | "yesterday" | "week" | "month" | "all" | "custom";

const KEY = "afrizon_period_v1";
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function rangeOf(key: PeriodKey, from?: string, to?: string): { from: string; to: string } | null {
  const now = new Date();
  const d = (n = 0) => { const x = new Date(now); x.setDate(now.getDate() + n); return iso(x); };

  switch (key) {
    case "today": return { from: d(0), to: d(0) };
    case "yesterday": return { from: d(-1), to: d(-1) };
    case "week": {
      const day = (now.getDay() + 6) % 7; // lundi = 0
      return { from: d(-day), to: d(0) };
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(first), to: d(0) };
    }
    case "custom": return from && to ? { from, to } : null;
    default: return null; // all
  }
}

type Ctx = {
  period: PeriodKey;
  from: string;
  to: string;
  range: { from: string; to: string } | null;
  label: string;
  setPeriod: (p: PeriodKey) => void;
  setCustom: (from: string, to: string) => void;
  /** true si la date est dans la période sélectionnée */
  inRange: (date: string) => boolean;
};

const C = createContext<Ctx>(null as unknown as Ctx);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
  })();

  const [period, setPeriodState] = useState<PeriodKey>(saved.period || "all");
  const [from, setFrom] = useState<string>(saved.from || iso(new Date()));
  const [to, setTo] = useState<string>(saved.to || iso(new Date()));

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ period, from, to }));
  }, [period, from, to]);

  const value = useMemo<Ctx>(() => {
    const range = rangeOf(period, from, to);
    const labels: Record<PeriodKey, string> = {
      today: "اليوم", yesterday: "أمس", week: "هذا الأسبوع",
      month: "هذا الشهر", all: "كل الفترات", custom: `${from} → ${to}`,
    };
    return {
      period, from, to, range, label: labels[period],
      setPeriod: (p) => setPeriodState(p),
      setCustom: (f, t) => { setFrom(f); setTo(t); setPeriodState("custom"); },
      inRange: (date: string) => {
        if (!range) return true;
        if (!date) return false;
        const day = date.slice(0, 10);
        return day >= range.from && day <= range.to;
      },
    };
  }, [period, from, to]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const usePeriod = () => useContext(C);

/** Barre de filtre temporel réutilisable */
export function PeriodBar({ compact = false }: { compact?: boolean }) {
  const { period, from, to, setPeriod, setCustom, label } = usePeriod();
  const [open, setOpen] = useState(false);

  const items: { k: PeriodKey; l: string }[] = [
    { k: "today", l: "اليوم" },
    { k: "yesterday", l: "أمس" },
    { k: "week", l: "هذا الأسبوع" },
    { k: "month", l: "هذا الشهر" },
    { k: "all", l: "الكل" },
  ];

  return (
    <div dir="rtl" className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.map((it) => (
          <button key={it.k} onClick={() => { setPeriod(it.k); setOpen(false); }}
            className={`px-3 py-1.5 text-xs font-bold transition ${
              period === it.k ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            {it.l}
          </button>
        ))}
        <button onClick={() => setOpen(!open)}
          className={`flex items-center gap-1 border-r border-slate-200 px-3 py-1.5 text-xs font-bold transition ${
            period === "custom" ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
          📅 Custom
        </button>
      </div>

      {open && (
        <div className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5">
          <input type="date" defaultValue={from} id="pf" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <span className="text-xs text-slate-500">→</span>
          <input type="date" defaultValue={to} id="pt" className="rounded border border-slate-300 px-2 py-1 text-xs" />
          <button onClick={() => {
            const f = (document.getElementById("pf") as HTMLInputElement)?.value;
            const t = (document.getElementById("pt") as HTMLInputElement)?.value;
            if (f && t) { setCustom(f > t ? t : f, f > t ? f : t); setOpen(false); }
          }} className="rounded-lg bg-orange-500 px-3 py-1 text-xs font-bold text-white hover:bg-orange-600">تطبيق</button>
        </div>
      )}

      {!compact && (
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">📊 {label}</span>
      )}
    </div>
  );
}
