import { useSyncExternalStore } from "react";
import { cloudPush, registerRefresh } from "./cloud";

/* ═══════════════════════ CHAT INTERNE ═══════════════════════
   💬 Chat Admin ⇄ Filles uniquement (jamais fille ⇄ fille)
   Chaque fille a sa conversation privée avec l'admin.
   ═════════════════════════════════════════════════════════════ */

export type ChatMsg = {
  id: number;
  from: string;        // username de l'expéditeur ("admin" pour l'admin)
  fromName: string;    // nom affiché (nom de la fille / "Admin")
  fromRole: "admin" | "user";
  to: string;          // username du destinataire ("admin" ou username de la fille)
  text: string;
  at: string;          // ISO
  read: boolean;
};

const KEY = "afrizon_chat_v1";

let cache: ChatMsg[] | null = null;
const listeners = new Set<() => void>();

function load(): ChatMsg[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const p = JSON.parse(s) as ChatMsg[];
      if (Array.isArray(p)) return p;
    }
  } catch { /* ignore */ }
  return [];
}

function persist(list: ChatMsg[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
  cloudPush(KEY);
}
registerRefresh(KEY, () => { cache = null; listeners.forEach((l) => l()); });

function nextId(list: ChatMsg[]) {
  return list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

/** Envoyer un message */
export function sendChatMessage(from: string, fromName: string, fromRole: "admin" | "user", to: string, text: string) {
  const t = text.trim();
  if (!t) return;
  const list = cache ?? load();
  persist([...list, { id: nextId(list), from, fromName, fromRole, to, text: t, at: new Date().toISOString(), read: false }]);
}

/** Marquer comme lu — messages destinés à `who` (optionnellement d'un seul expéditeur) */
export function markChatRead(who: string, from?: string) {
  const list = cache ?? load();
  let changed = false;
  const updated = list.map((m) => {
    if (m.to === who && !m.read && (!from || m.from === from)) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });
  if (changed) persist(updated);
}

export function getChat(): ChatMsg[] {
  return (cache ??= load());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/* 🔁 مزامنة حية بين التابات (نفس المتصفح) — كاتشعل النغمة عند المستلم */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        cache = JSON.parse(e.newValue) as ChatMsg[];
        listeners.forEach((l) => l());
      } catch { /* ignore */ }
    }
  });
}

export function useChat(): ChatMsg[] {
  return useSyncExternalStore(subscribe, () => (cache ??= load()), () => []);
}

export const chatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
