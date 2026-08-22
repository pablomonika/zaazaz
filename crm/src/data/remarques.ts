import { useSyncExternalStore } from "react";
import { cloudPush, registerRefresh } from "./cloud";

/* ═══════════════════════ Remarques ═══════════════════════
   📝 ملاحظات البنات — كل بنت عندها ملاحظاتها الخاصة
   ═══════════════════════════════════════════════════════════ */

export type Remarque = {
  id: number;
  agent: string;   // اسم البنت
  text: string;
  at: string;      // ISO
  done: boolean;   // معالجة ✓
};

const KEY = "afrizon_remarques_v1";

let cache: Remarque[] | null = null;
const listeners = new Set<() => void>();

function load(): Remarque[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const p = JSON.parse(s) as Remarque[];
      if (Array.isArray(p)) return p;
    }
  } catch { /* ignore */ }
  return [];
}

function persist(list: Remarque[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
  cloudPush(KEY);
}
registerRefresh(KEY, () => { cache = null; listeners.forEach((l) => l()); });

export function addRemarque(agent: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const list = cache ?? load();
  const r: Remarque = { id: Math.max(0, ...list.map((x) => x.id)) + 1, agent, text: t, at: new Date().toISOString(), done: false };
  persist([r, ...list]);
}

export function updRemarque(id: number, patch: Partial<Remarque>) {
  const list = cache ?? load();
  persist(list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
}

export function delRemarque(id: number) {
  const list = cache ?? load();
  persist(list.filter((r) => r.id !== id));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useRemarques(): Remarque[] {
  return useSyncExternalStore(subscribe, () => (cache ??= load()), () => []);
}

export const remTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toISOString().slice(0, 10);
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return iso.slice(0, 10) === today
    ? `اليوم ${hm}`
    : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
};
