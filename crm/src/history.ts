import type { Order } from "./data/orders";

export type LogAction = "add" | "edit" | "delete";

export type LogEntry = {
  id: number;
  at: string;              // ISO timestamp
  user: string;            // username
  agent: string;           // agent / page concerné
  action: LogAction;
  orderId: number;
  client: string;          // nom du client (repère)
  field?: string;          // champ modifié (edit)
  before?: string;         // ancienne valeur
  after?: string;          // nouvelle valeur
  snapshot?: string;       // résumé pour add / delete
};

export const LOG_KEY = "afrizon_history_v1";
export const LOG_LIMIT = 4000;

export const FIELD_LABELS: Record<string, string> = {
  dateCreation: "DATE", dateConfirmation: "date", statut: "Statut", remarques: "Remarques",
  idCmd: "ID", nom: "Nom & Prénom", telephone: "Téléphone", ville: "Ville", adresse: "Adresse",
  qte: "Qte", prix: "Prix", produit: "Produit", livraison: "Livraison", upsell: "UPSEL",
  carousell: "CAROUSELL", agent: "Agent", link: "LINK", carosellFlag: "CAROSELL",
  originLead: "ORIGIN LEAD", commission: "commision", fees: "FEES",
};

export function loadLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LogEntry[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveLogs(logs: LogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, LOG_LIMIT)));
}

export function orderSummary(o: Partial<Order>) {
  return [o.nom, o.telephone, o.ville, o.produit, o.prix ? `${o.prix} DH` : ""]
    .filter(Boolean).join(" · ") || "(vide)";
}

export function formatDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
