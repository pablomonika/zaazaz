import { useSyncExternalStore } from "react";
import { cloudPush, registerRefresh } from "./cloud";

/* ═══════════════════════ Avances — تسبيقات السالير ═══════════════════════
   💰 البنت كتطلب تسبيق (Avance) على السالير ديالها → كايتسجل هنا
   وكايتخصم أوتوماتيك من السالير فـ صفحة Salaire (Net à payer)
   ═══════════════════════════════════════════════════════════════════════════ */

export type Avance = {
  id: number;
  agent: string;    // البنت
  amount: number;   // المبلغ (DH)
  note: string;     // ملاحظة (اختياري)
  at: string;       // ISO
};

const KEY = "afrizon_avances_v1";

let cache: Avance[] | null = null;
const listeners = new Set<() => void>();

function load(): Avance[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const p = JSON.parse(s) as Avance[];
      if (Array.isArray(p)) return p;
    }
  } catch { /* ignore */ }
  return [];
}

function persist(list: Avance[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
  cloudPush(KEY);
}
registerRefresh(KEY, () => { cache = null; listeners.forEach((l) => l()); });

export function addAvance(agent: string, amount: number, note = "") {
  const list = cache ?? load();
  const a: Avance = {
    id: Math.max(0, ...list.map((x) => x.id)) + 1,
    agent: agent.trim(),
    amount: Number(amount) || 0,
    note: note.trim(),
    at: new Date().toISOString(),
  };
  persist([a, ...list]);
}

export function delAvance(id: number) {
  const list = cache ?? load();
  persist(list.filter((a) => a.id !== id));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useAvances(): Avance[] {
  return useSyncExternalStore(subscribe, () => (cache ??= load()), () => []);
}

export const avanceDate = (iso: string) => iso.slice(0, 10);
