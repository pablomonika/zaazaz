import { useSyncExternalStore } from "react";

/* ═══════════════════════════════════════════════════════════════
   WORK TIMES — suivi RÉEL des sessions dans le CRM
   ⏱ Entrée = login (ou retour d'activité) · Sortie = logout / 5 min d'absence
   Le heartbeat (60s) maintient la session vivante tant que la fille
   est dans le sheet. 100% lié aux comptes utilisateurs réels.
   ═══════════════════════════════════════════════════════════════ */

export type Session = {
  id: number;
  user: string;        // username réel (compte de la fille)
  agent: string;       // page de la fille
  start: string;       // ISO — entrée
  end: string | null;  // ISO — sortie (null = session ouverte)
  lastSeen: string;    // ISO — dernier signal
};

const KEY = "afrizon_worktimes_v1";
export const STALE_MS = 5 * 60 * 1000; // au-delà de 5 min sans signal → sortie

let cache: Session[] | null = null;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

function load(): Session[] {
  try {
    const s = localStorage.getItem(KEY);
    if (s) {
      const parsed = JSON.parse(s) as Session[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function persist(list: Session[]) {
  cache = list;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
  emit();
}

function nextId(list: Session[]) {
  return list.reduce((m, s) => Math.max(m, s.id), 0) + 1;
}

/* ── Fermer les sessions fantômes (pas de signal depuis > 5 min) ── */
export function cleanupStaleSessions() {
  const list = cache ??= load();
  const now = Date.now();
  let changed = false;
  const cleaned = list.map((s) => {
    if (s.end) return s;
    if (now - new Date(s.lastSeen).getTime() > STALE_MS) {
      changed = true;
      return { ...s, end: s.lastSeen }; // sortie = dernier signal
    }
    return s;
  });
  if (changed) persist(cleaned);
}

/* ── Entrée : login ── */
export function startSession(user: string, agent: string) {
  cleanupStaleSessions();
  const list = cache ?? load();
  const now = new Date().toISOString();
  const open = list.find((s) => s.user === user && !s.end);
  if (open) {
    persist(list.map((s) => (s.id === open.id ? { ...s, lastSeen: now } : s)));
    return open;
  }
  const s: Session = { id: nextId(list), user, agent, start: now, end: null, lastSeen: now };
  persist([...list, s]);
  return s;
}

/* ── Heartbeat : je suis dans le sheet (toutes les 60s) ──
   Si la fille est encore connectée mais sans session ouverte (retour
   après une absence), une nouvelle session démarre automatiquement. */
export function touchSession(user: string) {
  const list = cache ?? load();
  const now = new Date().toISOString();
  const nowMs = Date.now();
  let changed = false;
  let hasOpen = false;
  const updated = list.map((s) => {
    if (!s.end && nowMs - new Date(s.lastSeen).getTime() > STALE_MS) {
      changed = true;
      return { ...s, end: s.lastSeen };
    }
    if (s.user === user && !s.end) {
      hasOpen = true;
      if (s.lastSeen !== now) { changed = true; return { ...s, lastSeen: now }; }
    }
    return s;
  });
  if (!hasOpen) {
    // toujours connectée mais plus de session → elle est revenue : nouvelle entrée
    const agent = list.filter((s) => s.user === user).slice(-1)[0]?.agent || "";
    updated.push({ id: nextId(updated), user, agent, start: now, end: null, lastSeen: now });
    changed = true;
  }
  if (changed) persist(updated);
}

/* ── Sortie : logout ── */
export function closeSession(user: string) {
  const list = cache ?? load();
  const now = new Date().toISOString();
  persist(list.map((s) => (s.user === user && !s.end ? { ...s, end: now, lastSeen: now } : s)));
}

/* ── Hook React ── */
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useSessions(): Session[] {
  return useSyncExternalStore(subscribe, () => (cache ??= load()), () => []);
}

export function getSessions(): Session[] {
  return (cache ??= load());
}
