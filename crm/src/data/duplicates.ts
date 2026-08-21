import type { Order } from "./orders";

/* ═══════════════════════ Duplicate Detection ═══════════════════════
   🚨 كشف الطلبيات المكررة فـ الوقت الحقيقي :
   • نفس رقم الهاتف (آخر 9 أرقام — كايفهم 06 / +212 / 7 ...)
   • نفس العنوان + نفس سمية الكليان
   الهدف: ما يتعاودش الاتصال ولا الشحن جوج مرات لنفس الشخص
   ═════════════════════════════════════════════════════════════════════ */

/** توحيد رقم الهاتف → آخر 9 أرقام */
export const normPhone = (p: string): string => {
  const d = String(p ?? "").replace(/\D/g, "");
  if (!d) return "";
  return d.length > 9 ? d.slice(-9) : d;
};

/** توحيد النص (عنوان/سمية) */
const normText = (s: string): string =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ").trim();

export type DupIndex = {
  phone: Map<string, Order[]>;        // رقم → الطلبيات
  addr: Map<string, Order[]>;         // عنوان|سمية → الطلبيات
  dupOrders: Set<number>;             // ids ديال كل الطلبيات المتورطة فـ تكرار
};

/** بناء الفهرس مرة وحدة (سريع حتى مع آلاف الطلبيات) */
export function buildDupIndex(allOrders: Order[]): DupIndex {
  const orders = Array.isArray(allOrders) ? allOrders : [];
  const phone = new Map<string, Order[]>();
  const addr = new Map<string, Order[]>();
  orders.forEach((o) => {
    const p = normPhone(o.telephone);
    if (p.length >= 9) {
      if (!phone.has(p)) phone.set(p, []);
      phone.get(p)!.push(o);
    }
    const a = normText(o.adresse);
    const n = normText(o.nom);
    if (a.length >= 10 && n.length >= 3) {
      const k = `${a}|${n}`;
      if (!addr.has(k)) addr.set(k, []);
      addr.get(k)!.push(o);
    }
  });
  const dupOrders = new Set<number>();
  phone.forEach((list) => { if (list.length > 1) list.forEach((o) => dupOrders.add(o.id)); });
  addr.forEach((list) => { if (list.length > 1) list.forEach((o) => dupOrders.add(o.id)); });
  return { phone, addr, dupOrders };
}

/** معلومات التكرار ديال طلبية معينة */
export function dupInfoFor(o: Order, idx: DupIndex) {
  const p = normPhone(o.telephone);
  const byPhone = p.length >= 9 ? (idx.phone.get(p) || []).filter((x) => x.id !== o.id) : [];
  const k = `${normText(o.adresse)}|${normText(o.nom)}`;
  const a = normText(o.adresse);
  const byAddr = a.length >= 10 ? (idx.addr.get(k) || []).filter((x) => x.id !== o.id) : [];
  const others = [...byPhone, ...byAddr].filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i);
  return {
    count: others.length,
    byPhone: byPhone.length > 0,
    byAddr: byAddr.length > 0,
    others,
  };
}

/** مجموعات التكرار حسب الرقم (للتقرير) */
export function dupGroups(idx: DupIndex): { phone: string; orders: Order[] }[] {
  return [...idx.phone.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([phone, list]) => ({ phone, orders: [...list].sort((a, b) => b.dateCreation.localeCompare(a.dateCreation)) }))
    .sort((a, b) => b.orders.length - a.orders.length);
}
