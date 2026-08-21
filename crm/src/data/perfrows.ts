import { useSyncExternalStore } from "react";

/* ═══════════════════════ Perf Rows — جداول Dashboard performance ═══════════════════════
   📊 حنا كانحطو غير: المنتوج + التاريخ + تمن البيع
   والباقي (طلبيات/كونفيرماسيون/CA/شحن/ربح) كايتحسب أوتوماتيك من طلبيات CRM
   ═════════════════════════════════════════════════════════════════════════════════════════ */

export type PerfRow = {
  id: number;
  source: string;   // Leader / whatssap / Facebook / TikTok / Google
  produit: string;
  date: string;     // YYYY-MM-DD
  prix: number;     // تمن البيع
};

const KEY = "afrizon_perfrows_v1";

let cache: PerfRow[] | null = null;
const listeners = new Set<() => void>();

function load(): PerfRow[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const p = JSON.parse(s) as PerfRow[];
      if (Array.isArray(p)) return p;
    }
  } catch { /* ignore */ }
  return [];
}

function persist(list: PerfRow[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function addPerfRow(source: string, produit: string, date: string, prix: number) {
  const list = cache ?? load();
  const r: PerfRow = {
    id: Math.max(0, ...list.map((x) => x.id)) + 1,
    source, produit: produit.trim(), date, prix: Number(prix) || 0,
  };
  persist([r, ...list]);
}

export function updPerfRow(id: number, patch: Partial<PerfRow>) {
  const list = cache ?? load();
  persist(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function delPerfRow(id: number) {
  const list = cache ?? load();
  persist(list.filter((r) => r.id !== id));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function usePerfRows(): PerfRow[] {
  return useSyncExternalStore(subscribe, () => (cache ??= load()), () => []);
}

export const PERF_SOURCES = [
  { key: "Leader", label: "Leader", icon: "🎯" },
  { key: "whatssap", label: "WhatsApp", icon: "💬" },
  { key: "Facebook", label: "Facebook", icon: "📘" },
  { key: "TikTok", label: "TikTok", icon: "🎵" },
  { key: "Google", label: "Google", icon: "🔍" },
];
