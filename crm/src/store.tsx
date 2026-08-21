import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSeedOrders, AGENTS_SUMMARY, GLOBAL_STATS, type Order } from "./data/orders";
import { useAuth } from "./auth";
import { loadLogs, saveLogs, orderSummary, FIELD_LABELS, type LogEntry, type LogAction } from "./history";

const KEY = "afrizon_orders_v5";
const AGENTS_KEY = "afrizon_agent_names_v1";
const BACKUP_KEY = "afrizon_backup_v1";      // snapshot enregistré (Save CMD)
const BACKUP_AT_KEY = "afrizon_backup_at_v1"; // date du snapshot
const DEFAULT_AGENT_NAMES = ["Meryam", "imane", "AYA", "Sanae", "RACHIDA", "HIBA", "WIAM", "AFRIZON"];

type Ctx = {
  orders: Order[];
  agents: typeof AGENTS_SUMMARY;
  agentNames: string[];
  gs: typeof GLOBAL_STATS;
  logs: LogEntry[];
  clearLogs: () => void;
  add: (o: Omit<Order, "id">) => void;
  upd: (id: number, p: Partial<Order>) => void;
  del: (id: number) => void;
  addAgent: (name: string) => boolean;
  renameAgent: (oldName: string, newName: string) => boolean;
  removeAgent: (name: string) => void;
  saveCheckpoint: () => number;   // enregistre l'état actuel, renvoie le nb de commandes
  importOrders: (list: Omit<Order, "id">[]) => number; // import Excel en masse (1 seule entrée de log)
  savedAt: string | null;         // date du dernier enregistrement
  savedCount: number;             // nb de commandes enregistrées
  reset: () => void;              // revient au dernier enregistrement (ou données d'origine)
};

const C = createContext<Ctx>(null as unknown as Ctx);

/* 🛡️ تعقيم الطلبيات: أي حقل ناقص/بشكل غالب من نسخ قديمة كايتصلح هنا
   (يمنع "الصفحة البيضاء" مع الداتا القديمة) */
const sanitizeOrders = (list: unknown): Order[] => {
  if (!Array.isArray(list)) return [];
  return list.map((raw, i) => {
    const o = (raw ?? {}) as Partial<Order>;
    return {
      id: Number(o.id) || i + 1,
      dateCreation: String(o.dateCreation ?? "").slice(0, 10),
      dateConfirmation: String(o.dateConfirmation ?? "").slice(0, 10),
      statut: String(o.statut ?? ""),
      remarques: String(o.remarques ?? ""),
      idCmd: String(o.idCmd ?? ""),
      nom: String(o.nom ?? ""),
      telephone: String(o.telephone ?? ""),
      ville: String(o.ville ?? ""),
      adresse: String(o.adresse ?? ""),
      qte: Number(o.qte) || 1,
      prix: Number(o.prix) || 0,
      produit: String(o.produit ?? ""),
      livraison: String(o.livraison ?? ""),
      upsell: Number(o.upsell) || 0,
      carousell: String(o.carousell ?? ""),
      agent: String(o.agent ?? ""),
      link: String(o.link ?? ""),
      carosellFlag: String(o.carosellFlag ?? ""),
      originLead: String(o.originLead ?? ""),
      commission: Number(o.commission) || 0,
      fees: String(o.fees ?? ""),
    };
  });
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed) && parsed.length) return sanitizeOrders(parsed);
      }
    } catch { /* */ }
    return getSeedOrders();
  });

  const [agentNames, setAgentNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(AGENTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) return parsed;
      }
    } catch { /* */ }
    return DEFAULT_AGENT_NAMES;
  });

  const [logs, setLogs] = useState<LogEntry[]>(() => loadLogs());

  // Snapshot enregistré manuellement via "Save CMD"
  const [savedAt, setSavedAt] = useState<string | null>(() => localStorage.getItem(BACKUP_AT_KEY));
  const [savedCount, setSavedCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (raw) return (JSON.parse(raw) as Order[]).length;
    } catch { /* */ }
    return 0;
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem(AGENTS_KEY, JSON.stringify(agentNames)); }, [agentNames]);
  useEffect(() => { saveLogs(logs); }, [logs]);

  const record = (entries: Omit<LogEntry, "id" | "at" | "user">[]) => {
    if (!entries.length) return;
    const user = currentUser?.username || "inconnu";
    const at = new Date().toISOString();
    setLogs((prev) => {
      let nextId = Math.max(0, ...prev.map((l) => l.id)) + 1;
      const added = entries.map((e) => ({ ...e, id: nextId++, at, user }));
      return [...added.reverse(), ...prev];
    });
  };

  const log = (action: LogAction, o: Partial<Order> & { id: number }, extra: Partial<LogEntry> = {}) =>
    record([{ action, orderId: o.id, agent: o.agent || "", client: o.nom || "", ...extra }]);

  const v = useMemo<Ctx>(() => ({
    orders,
    agents: AGENTS_SUMMARY,
    agentNames,
    gs: GLOBAL_STATS,
    logs,
    clearLogs: () => setLogs([]),

    add: (o) => {
      const id = Math.max(0, ...orders.map((x) => x.id)) + 1;
      setOrders((p) => [{ ...o, id }, ...p]);
      log("add", { ...o, id }, { snapshot: orderSummary(o) });
    },

    importOrders: (list) => {
      if (!list.length) return 0;
      const start = Math.max(0, ...orders.map((x) => x.id));
      const withIds = list.map((o, i) => ({ ...o, id: start + i + 1 }));
      setOrders((p) => [...withIds.reverse(), ...p]);
      record([{
        action: "add",
        orderId: withIds[0]?.id || 0,
        agent: "",
        client: `📥 استيراد Excel — ${list.length} طلبية`,
        snapshot: `تم رفع ${list.length} طلبية من ملف Excel`,
      }]);
      return list.length;
    },

    upd: (id, patch) => {
      const before = orders.find((x) => x.id === id);
      setOrders((p) => p.map((x) => x.id === id ? { ...x, ...patch } : x));
      if (!before) return;
      const changes = (Object.keys(patch) as (keyof Order)[])
        .filter((k) => String(before[k] ?? "") !== String(patch[k] ?? ""))
        .map((k) => ({
          action: "edit" as LogAction,
          orderId: id,
          agent: (patch.agent as string) ?? before.agent ?? "",
          client: (patch.nom as string) ?? before.nom ?? "",
          field: FIELD_LABELS[k] || String(k),
          before: String(before[k] ?? "") || "(vide)",
          after: String(patch[k] ?? "") || "(vide)",
        }));
      record(changes);
    },

    del: (id) => {
      const gone = orders.find((x) => x.id === id);
      setOrders((p) => p.filter((x) => x.id !== id));
      if (gone) log("delete", gone, { snapshot: orderSummary(gone) });
    },

    addAgent: (name) => {
      const clean = name.trim();
      if (!clean || agentNames.some((a) => a.toLowerCase() === clean.toLowerCase())) return false;
      setAgentNames((p) => [...p, clean]);
      return true;
    },
    renameAgent: (oldName, newName) => {
      const clean = newName.trim();
      if (!clean || agentNames.some((a) => a.toLowerCase() === clean.toLowerCase() && a !== oldName)) return false;
      setAgentNames((p) => p.map((a) => a === oldName ? clean : a));
      setOrders((p) => p.map((o) => o.agent.toLowerCase() === oldName.toLowerCase() ? { ...o, agent: clean } : o));
      return true;
    },
    removeAgent: (name) => {
      setAgentNames((p) => p.filter((a) => a !== name));
      setOrders((p) => p.map((o) => o.agent.toLowerCase() === name.toLowerCase() ? { ...o, agent: "" } : o));
    },
    savedAt,
    savedCount,

    // Enregistre l'état actuel comme point de restauration
    saveCheckpoint: () => {
      const at = new Date().toISOString();
      localStorage.setItem(BACKUP_KEY, JSON.stringify(orders));
      localStorage.setItem(BACKUP_AT_KEY, at);
      localStorage.setItem(BACKUP_KEY + "_agents", JSON.stringify(agentNames));
      setSavedAt(at);
      setSavedCount(orders.length);
      return orders.length;
    },

    // Revient au dernier enregistrement ; si aucun, revient aux données d'origine
    reset: () => {
      try {
        const raw = localStorage.getItem(BACKUP_KEY);
        if (raw) {
          const backup = JSON.parse(raw) as Order[];
          if (Array.isArray(backup)) {
            setOrders(backup);
            const ag = localStorage.getItem(BACKUP_KEY + "_agents");
            if (ag) setAgentNames(JSON.parse(ag));
            return;
          }
        }
      } catch { /* */ }
      setOrders(getSeedOrders());
      setAgentNames(DEFAULT_AGENT_NAMES);
    },
  }), [orders, agentNames, logs, currentUser, savedAt, savedCount]);

  return <C.Provider value={v}>{children}</C.Provider>;
}

export const useStore = () => useContext(C);

export function exportCSV(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return;
  const h = Object.keys(rows[0]);
  const csv = [h.join(","), ...rows.map((r) => h.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `${name}.csv`; a.click();
}
