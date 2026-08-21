import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useStore } from "../store";
import { useVilles, priceForCity } from "../data/villes";
import type { Order } from "../data/orders";

/* ═════════════════════ IMPORT EXCEL ═══════════════════════
   رفع الطلبيات من ملف Excel/CSV → كيتزادو بحال طلبيات جديدة
   (البنات كيشوفوهم فـ صفحاتهم حسب الاسم ديال البنت)
   ═══════════════════════════════════════════════════════════ */

type Map = Record<string, string>; // champ cible → colonne du fichier

const TARGETS: { key: string; label: string; hint: RegExp }[] = [
  { key: "agent", label: "👩 البنت (Agent)", hint: /agent|fille|team|بنت|وكيل|مسؤول/i },
  { key: "nom", label: "👤 اسم الزبون (Nom)", hint: /nom|name|client|customer|زبون|اسم|الاسم/i },
  { key: "telephone", label: "📞 الهاتف (Téléphone)", hint: /tel|phone|gsm|whats|رقم|هاتف/i },
  { key: "ville", label: "🏙️ المدينة (Ville)", hint: /ville|city|مدينة/i },
  { key: "produit", label: "📦 المنتوج (Produit)", hint: /produit|product|article|item|منتوج|منتج/i },
  { key: "prix", label: "💰 الثمن (Prix)", hint: /prix|price|total|amount|ثمن/i },
  { key: "qte", label: "🔢 الكمية (Qte)", hint: /qte|qt[éy]|quant|كمية/i },
  { key: "adresse", label: "📍 العنوان (Adresse)", hint: /adress|adresse|address|عنوان/i },
  { key: "remarques", label: "📝 ملاحظات (Remarques)", hint: /remarque|note|remark|ملاحظ/i },
];

export default function ImportExcel({ onClose }: { onClose: () => void }) {
  const { importOrders, agentNames } = useStore();
  const villes = useVilles();
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<Map>({});
  const [fileName, setFileName] = useState("");
  const [fallbackAgent, setFallbackAgent] = useState("");
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState("");

  /* ── Lecture du fichier ── */
  const readFile = async (f: File) => {
    setErr(""); setDone(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      if (!data.length) return setErr("⚠️ الملف خاوي — ما لقينا حتى سطر");
      const cols = Object.keys(data[0]);
      setHeaders(cols);
      setRows(data);
      setFileName(f.name);
      // auto-détection des colonnes
      const m: Map = {};
      TARGETS.forEach((t) => {
        const hit = cols.find((c) => t.hint.test(c.trim()));
        if (hit) m[t.key] = hit;
      });
      setMap(m);
    } catch {
      setErr("⚠️ ما قدرناش نقراو الملف — تأكد بلي هو Excel ولا CSV صحيح");
    }
  };

  /* ── Normaliser le nom de la fille ── */
  const normAgent = (raw: string): string => {
    const v = String(raw || "").trim();
    if (!v) return "";
    const hit = agentNames.find((a) => a.toLowerCase() === v.toLowerCase());
    return hit || "";
  };

  /* ── Construire les commandes ── */
  const preview = useMemo(() => {
    if (!rows) return [];
    const get = (r: Record<string, unknown>, k: string) => k && map[k] ? String(r[map[k]] ?? "").trim() : "";
    return rows.map((r) => {
      const ville = get(r, "ville");
      const agent = normAgent(get(r, "agent")) || fallbackAgent;
      const prix = priceForCity(ville, villes);
      const o: Omit<Order, "id"> = {
        dateCreation: new Date().toISOString().slice(0, 10),
        dateConfirmation: new Date().toISOString().slice(0, 10),
        statut: "", remarques: get(r, "remarques"), idCmd: "1",
        nom: get(r, "nom"), telephone: get(r, "telephone"), ville, adresse: get(r, "adresse"),
        qte: Number(get(r, "qte")) || 1, prix: Number(get(r, "prix").replace(",", ".")) || 0,
        produit: get(r, "produit"), livraison: "",
        upsell: 0, carousell: "", agent, link: "", carosellFlag: "",
        originLead: "Importé", commission: prix !== null ? prix : 35, fees: "",
      };
      return o;
    });
  }, [rows, map, fallbackAgent, villes, agentNames]);

  const stats = useMemo(() => ({
    total: preview.length,
    withAgent: preview.filter((o) => o.agent).length,
    noAgent: preview.filter((o) => !o.agent).length,
  }), [preview]);

  const doImport = () => {
    if (!preview.length) return;
    const n = importOrders(preview);
    setDone(n);
  };

  const sel = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div dir="rtl" onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl">

        {/* ── En-tête ── */}
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base text-white shadow-sm">📥</span>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">استيراد الطلبيات من Excel</h3>
            <p className="text-[10px] text-slate-500">الطلبيات كيتزادو بحال جديدة — وكل بنت كتشوف اللي ديالها فـ صفحتها</p>
          </div>
          <button onClick={onClose} className="ms-auto grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        <div className="p-4">
          {done !== null ? (
            /* ── Succès ── */
            <div className="p-6 text-center">
              <div className="mb-3 text-5xl">✅</div>
              <h4 className="text-base font-extrabold text-emerald-700">تزادو {done} طلبية بنجاح!</h4>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                دابا الطلبيات راهم فـ <b>COMONDES</b> وعند كل بنت فـ صفحتها (حسب الاسم ديالها فـ الملف).
                <br />البنات يقدرو يديرو ليهم <b>Statut</b> و <b>Suivie</b> عادي بحال أي طلبية.
                <br />كتميزهم بـ <b className="text-indigo-600">Importé</b> فـ خانة ORIGIN LEAD.
              </p>
              <button onClick={onClose} className="mt-4 rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-emerald-700">تمام ✓</button>
            </div>
          ) : !rows ? (
            /* ── Étape 1 : fichier ── */
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                className="grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-10 transition hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="text-4xl">📄</div>
                <p className="mt-3 text-sm font-bold text-emerald-700">اضغط هنا واختر ملف Excel / CSV</p>
                <p className="mt-1 text-[11px] text-slate-500">.xlsx · .xls · .csv — الخانة الأولى = أسماء الأعمدة</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
              </div>
              {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600">{err}</p>}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] leading-6 text-slate-600">
                <b className="text-slate-700">💡 باش يخدم الاستيراد مزيان، الملف خاصو فيه (على الأقل):</b><br />
                👩 اسم البنت (Agent) · 👤 اسم الزبون · 📞 الهاتف · 🏙️ المدينة · 📦 المنتوج<br />
                والأعمدة الإضافية كايتعرفو أوتوماتيكياً: الثمن · الكمية · العنوان · الملاحظات
              </div>
            </div>
          ) : (
            /* ── Étape 2 : mapping ── */
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">📄 {fileName}</span>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700">{rows.length} سطر</span>
                <button onClick={() => { setRows(null); setMap({}); }} className="ms-auto rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100">↺ بدّل الملف</button>
              </div>

              {/* correspondance des colonnes */}
              <p className="mb-2 text-[11px] font-bold text-slate-700">🔧 ربط الأعمدة — تأكد منهم قبل الاستيراد:</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {TARGETS.map((t) => (
                  <label key={t.key} className="text-[10px] font-semibold text-slate-600">
                    {t.label}
                    <select value={map[t.key] || ""} onChange={(e) => setMap((p) => ({ ...p, [t.key]: e.target.value }))}
                      className={sel + " mt-0.5 w-full cursor-pointer"}>
                      <option value="">— ما كاينش —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </label>
                ))}
              </div>

              {/* fallback agent */}
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-[10px] font-bold text-amber-800">
                  👩 البنات بلا اسم صحيح فـ الملف: {stats.noAgent} من {stats.total} — فـين نحطوهم؟
                </p>
                <select value={fallbackAgent} onChange={(e) => setFallbackAgent(e.target.value)}
                  className={sel + " mt-1.5 w-full cursor-pointer"}>
                  <option value="">— خليهم بلا بنت (كاينين غير فـ COMONDES) —</option>
                  {agentNames.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>

              {/* aperçu */}
              <p className="mb-1.5 mt-3 text-[11px] font-bold text-slate-700">👀 نظرة سريعة (أول 5):</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500">
                      {["البنت", "الزبون", "الهاتف", "المدينة", "المنتوج", "الثمن", "commision"].map((h) => (
                        <th key={h} className="px-2 py-1.5 text-start font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 5).map((o, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 font-bold text-indigo-700">{o.agent || "—"}</td>
                        <td className="px-2 py-1.5 font-semibold text-slate-700">{o.nom || "—"}</td>
                        <td className="px-2 py-1.5" dir="ltr">{o.telephone || "—"}</td>
                        <td className="px-2 py-1.5">{o.ville || "—"}</td>
                        <td className="px-2 py-1.5">{o.produit || "—"}</td>
                        <td className="px-2 py-1.5 font-bold text-emerald-700">{o.prix} DH</td>
                        <td className="px-2 py-1.5 font-bold text-teal-700">{o.commission} DH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-500">✅ {stats.withAgent} مباعين للبنات · {stats.noAgent} بلا بنت</span>
                <button onClick={doImport} disabled={!preview.length}
                  className="ms-auto rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-xs font-extrabold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] disabled:opacity-50">
                  📥 استيراد {stats.total} طلبية
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
