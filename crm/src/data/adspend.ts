import { useSyncExternalStore } from "react";

/* ═══════════════════════ Ad Spend — تكاليف الإعلانات ═══════════════════════
   💸 حنا كندخلو المصروف (مثلا 200 درهم لمريم فـ نظارة القراءة من Leader)
   والسيستم كايحسب أوتوماتيك: الكوست لكل طلبية = المصروف ÷ عدد الطلبيات
   ═════════════════════════════════════════════════════════════════════════════ */

export type AdSpend = {
  id: number;
  date: string;       // YYYY-MM-DD
  agent: string;      // البنت
  produit: string;    // المنتوج
  source: string;     // Leader / Facebook / TikTok / Google ...
  amount: number;     // المصروف (DH)
};

const KEY = "afrizon_adspend_v1";

let cache: AdSpend[] | null = null;
const listeners = new Set<() => void>();

function load(): AdSpend[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const p = JSON.parse(s) as AdSpend[];
      if (Array.isArray(p)) return p;
    }
  } catch { /* ignore */ }
  return [];
}

function persist(list: AdSpend[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function addSpend(date: string, agent: string, produit: string, source: string, amount: number) {
  const list = cache ?? load();
  const s: AdSpend = {
    id: Math.max(0, ...list.map((x) => x.id)) + 1,
    date, agent: agent.trim(), produit: produit.trim(), source, amount: Number(amount) || 0,
  };
  persist([s, ...list]);
}

export function delSpend(id: number) {
  const list = cache ?? load();
  persist(list.filter((s) => s.id !== id));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useSpends(): AdSpend[] {
  return useSyncExternalStore(subscribe, () => (cache ??= load()), () => []);
}
