/* ═══════════════════════ Cloud Sync — المزامنة السحابية ═══════════════════════
   🔗 كتربط كل الأجهزة بنفس الداتا (عبر api.php فـ الاستضافة)
   • Boot: كنشدو آخر نسخة من السيرفر قبل ما يبان التطبيق
   • Push: أي تغيير محلي كايتصيفط (debounce 800ms)
   • Poll: كل 12 ثانية كنجبدو الجديد ونحدّثو الواجهة فوراً (شات/بنات...)
   • إلا ما كانش api.php → التطبيق كيخدم 100% محلي (بحال قبل)
   ═════════════════════════════════════════════════════════════════════════════════ */

const SECRET = "paraveda-2026-sync";

export const SHARED_KEYS = [
  "afrizon_users_v1", "afrizon_orders_v5", "afrizon_agent_names_v1",
  "afrizon_chat_v1", "afrizon_worktimes_v1", "afrizon_remarques_v1",
  "afrizon_avances_v1", "afrizon_adspend_v1", "afrizon_perfrows_v1",
  "afrizon_history_v1", "afrizon_villes_v2", "afrizon_catalog_v1",
  "sheet_pièce", "afrizon_team_photos_v1", "tabs_list_v1", "custom_sheets_v1",
];

let enabled = false;
const ctKey = (k: string) => "ct_" + k;

/* تسجيل دوال التحديث الحي (للموديلات ذات listeners) */
const refreshers = new Map<string, () => void>();
export function registerRefresh(key: string, fn: () => void) {
  refreshers.set(key, fn);
}

type Entry = { t: number; d: unknown };

function applyServer(data: Record<string, Entry>): string[] {
  const changed: string[] = [];
  SHARED_KEYS.forEach((k) => {
    const e = data[k];
    if (e && typeof e.t === "number") {
      const localT = Number(localStorage.getItem(ctKey(k)) || 0);
      if (e.t > localT) {
        try {
          localStorage.setItem(k, JSON.stringify(e.d));
          localStorage.setItem(ctKey(k), String(e.t));
          changed.push(k);
        } catch { /* quota */ }
      }
    }
  });
  return changed;
}

/** BOOT: شد آخر نسخة من السيرAndViewر قبل تحميل التطبيق */
export async function initCloudSync(): Promise<void> {
  try {
    const r = await fetch("api.php", { cache: "no-store", headers: { "X-Sync-Token": SECRET } });
    if (!r.ok) throw new Error("http " + r.status);
    const txt = await r.text();
    let data: Record<string, Entry>;
    try {
      data = JSON.parse(txt) as Record<string, Entry>;
    } catch {
      throw new Error("parse: " + txt.slice(0, 50));
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("shape");
    const changed = applyServer(data);
    enabled = true;
    startPolling();
    console.log("[cloud] sync enabled, keys changed:", changed.length);
  } catch (e) {
    enabled = false;
    console.log("[cloud] sync disabled:", e instanceof Error ? e.message : e);
  }
}

/* PUSH: أي تغيير محلي — فوري + إعادة محاولة */
let pushing = new Set<string>();
export function cloudPush(key: string) {
  if (!enabled || !SHARED_KEYS.includes(key)) return;
  // إلا كاين إرسال جاري لنفس المفتاح، سجلو وغايتصيفط من بعد
  if (pushing.has(key)) {
    setTimeout(() => cloudPush(key), 1200);
    return;
  }
  pushing.add(key);
  const doPush = () => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) { pushing.delete(key); return; }
      const t = Date.now();
      localStorage.setItem(ctKey(key), String(t));
      fetch("api.php", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Sync-Token": SECRET },
        body: JSON.stringify({ key, t, d: JSON.parse(raw) }),
      }).then((r) => {
        pushing.delete(key);
        if (!r.ok) {
          // إعادة محاولة بعد 2 ثواني
          setTimeout(() => cloudPush(key), 2000);
        }
      }).catch(() => {
        pushing.delete(key);
        // إعادة محاولة بعد 2 ثواني
        setTimeout(() => cloudPush(key), 2000);
      });
    } catch {
      pushing.delete(key);
    }
  };
  // تأخير صغير 200ms باش نجمعو تغييرات سريعة
  setTimeout(doPush, 200);
}

/* POLL: كل 12 ثانية — حدّث الواجهة الحية (شات، أوقات، ملاحظات...) */
let polling = false;
function startPolling() {
  if (polling) return;
  polling = true;
  setInterval(async () => {
    if (!enabled) return;
    try {
      const r = await fetch("api.php", { cache: "no-store", headers: { "X-Sync-Token": SECRET } });
      if (!r.ok) return;
      const data = (await r.json()) as Record<string, Entry>;
      const changed = applyServer(data);
      // الموديلات الحية (شات/أوقات/ملاحظات/تسبيقات/مصروفات...) كايتحدثو فوراً
      changed.forEach((k) => refreshers.get(k)?.());
      // الباقي (طلبيات/يوزرات...) كايتطبق فـ الذاكرة — كايبان مع تحديث الصفحة
    } catch { /* أوفلاين */ }
  }, 12000);
}
