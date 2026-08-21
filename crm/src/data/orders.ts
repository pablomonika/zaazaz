import { ORDERS_DATA, AGENTS_DATA, GLOBAL_DATA } from "./csv";

export type Order = {
  id: number;
  dateCreation: string;
  dateConfirmation: string;
  statut: string;
  remarques: string;
  idCmd: string;
  nom: string;
  telephone: string;
  ville: string;
  adresse: string;
  qte: number;
  prix: number;
  produit: string;
  livraison: string;
  upsell: number;
  carousell: string;
  agent: string;
  link: string;
  carosellFlag: string;
  originLead: string;
  commission: number;
  fees: string;
};

export const ORIGIN_OPTIONS = ["", "Facebook", "TikTok", "whatssap", "Appel", "Leader", "Google"];

export type AgentSummary = typeof AGENTS_DATA[number];

export function getSeedOrders(): Order[] {
  return ORDERS_DATA.map((r, i) => ({
    id: i + 1,
    dateCreation: r[0] || "",
    dateConfirmation: r[1] || "",
    statut: r[2] || "",
    remarques: r[3] || "",
    idCmd: r[4] || "",
    nom: r[5] || "",
    telephone: r[6] || "",
    ville: r[7] || "",
    adresse: r[8] || "",
    qte: parseInt(r[9]) || 1,
    prix: parseFloat(r[10]) || 0,
    produit: r[11] || "",
    livraison: r[12] || "",
    upsell: parseInt(r[13]) || 0,
    carousell: r[14] || "",
    agent: r[15] || "",
    link: r[16] || "",
    carosellFlag: r[17] || "",
    originLead: r[18] || "",
    commission: parseFloat(r[19]) || 0,
    fees: r[20] || "",
  }));
}

export const AGENTS_SUMMARY = AGENTS_DATA;
export const GLOBAL_STATS = GLOBAL_DATA;
