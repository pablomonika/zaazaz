import { useState } from "react";
import { useAuth } from "../auth";
import { useVilles, saveVilles, resetVilles, DEFAULT_VILLES, type Ville } from "../data/villes";
import Btn from "../components/Btn";

/* ═══════════════════════ LES VILLES ═══════════════════════
   Ville + Frais de livraison (Digylock).
   Dès qu'une ville est choisie dans une commande, le prix est
   injecté automatiquement dans la colonne « commision ».
   ═══════════════════════════════════════════════════════════ */

export default function Villes() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const villes = useVilles();
  const [q, setQ] = useState("");
  const [newNom, setNewNom] = useState("");
  const [newPrix, setNewPrix] = useState("");

  /* Édition directe dans le tableau */
  const setVille = (i: number, patch: Partial<Ville>) => {
    saveVilles(villes.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  };
  const delVille = (i: number) => {
    if (!confirm(`مسح المدينة "${villes[i].nom}"؟`)) return;
    saveVilles(villes.filter((_, j) => j !== i));
  };
  const addVille = () => {
    const nom = newNom.trim();
    const prix = Number(newPrix) || 0;
    if (!nom) return alert("اسم المدينة مطلوب");
    if (villes.some((v) => v.nom.trim().toLowerCase() === nom.toLowerCase())) return alert("هاد المدينة موجودة بالفعل");
    saveVilles([...villes, { nom, prix }]);
    setNewNom(""); setNewPrix("");
  };
  const resetAll = () => {
    if (!confirm(`ترجيع اللائحة الأصلية (${DEFAULT_VILLES.length} مدينة)؟ التعديلات ديالك غادي يتمسحو`)) return;
    resetVilles();
  };

  const shown = villes
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !q.trim() || v.nom.toLowerCase().includes(q.trim().toLowerCase()));

  const th = "border border-slate-400 px-2 py-1 text-[11px] font-bold text-white whitespace-nowrap";
  const c = "border border-slate-300 px-2 py-1 text-xs";

  return (
    <div dir="ltr" className="p-4 text-xs text-slate-800">
      {/* ── En-tête ── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">🏙️ LES VILLES</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{villes.length} villes</span>
        {isAdmin
          ? <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">✏️ Admin</span>
          : <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">🔒 قراءة فقط</span>}
      </div>

      {/* ── Bandeau explicatif ── */}
      <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] leading-5" dir="rtl">
        ⚡ ملي الوكيلة كاتختار المدينة فـ الطلبية، <b>ثمن التوصيل كايتحط أوتوماتيكياً</b> فـ خانة <b>commision</b> وكايتحسب مع الحسابات.
      </div>

      {/* ── Barre d'outils ── */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔎 بحث عن مدينة..."
          className="w-52 rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-blue-500" />
        <Btn icon="↺" color="slate" variant="ghost" className="!text-[11px]" onClick={resetAll} title="ترجيع اللائحة الأصلية">اللائحة الأصلية</Btn>
      </div>

      {/* ── Ajout d'une ville ── */}
      {isAdmin && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
          <b className="text-sm text-blue-900">➕ مدينة جديدة</b>
          <label className="text-[11px] font-medium text-slate-600">Ville
            <input value={newNom} onChange={(e) => setNewNom(e.target.value)}
              className="mt-0.5 block w-44 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
          </label>
          <label className="text-[11px] font-medium text-slate-600">Frais de livraison (DH)
            <input type="number" value={newPrix} onChange={(e) => setNewPrix(e.target.value)}
              className="mt-0.5 block w-36 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
          </label>
          <Btn icon="＋" color="blue" onClick={addVille}>إضافة</Btn>
        </div>
      )}

      {/* ── Tableau : 2 colonnes ── */}
      <div className="overflow-auto rounded-xl border border-slate-200 bg-white" style={{ maxHeight: "70vh" }}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={th + " bg-slate-500"} style={{ width: 44 }}>#</th>
              <th className={th + " bg-[#4a86c8]"}>Ville</th>
              <th className={th + " bg-[#6aa84f]"} style={{ width: 180 }}>Frais de livraison (DH)</th>
              {isAdmin && <th className={th + " bg-slate-700"} style={{ width: 60 }}></th>}
            </tr>
          </thead>
          <tbody>
            {shown.map(({ v, i }, idx) => (
              <tr key={i} className="odd:bg-white even:bg-[#f8f9fa]">
                <td className={c + " text-center text-slate-400"}>{idx + 1}</td>
                <td className="border border-slate-300 p-0">
                  <input value={v.nom} readOnly={!isAdmin}
                    onChange={(e) => setVille(i, { nom: e.target.value })}
                    className="h-full w-full border-0 bg-transparent px-2 py-1.5 text-xs font-medium outline-none focus:bg-blue-50" />
                </td>
                <td className="border border-slate-300 p-0">
                  <input type="number" value={v.prix} readOnly={!isAdmin}
                    onChange={(e) => setVille(i, { prix: Number(e.target.value) || 0 })}
                    className="h-full w-full border-0 bg-transparent px-2 py-1.5 text-center text-xs font-bold text-emerald-700 outline-none focus:bg-emerald-50" />
                </td>
                {isAdmin && (
                  <td className={c + " bg-slate-50 text-center"}>
                    <button onClick={() => delVille(i)} title="مسح" className="px-1 text-red-600 hover:text-red-800">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <div className="p-8 text-center text-slate-400">لا توجد مدن</div>}
      </div>

      <p className="mt-2 text-[10px] text-slate-400" dir="rtl">
        💡 كتكتب فوق الاسم ولا الثمن باش تبدل، وكيتسجل أوتوماتيكياً.
      </p>
    </div>
  );
}
