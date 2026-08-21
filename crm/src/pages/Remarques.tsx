import { useMemo, useState } from "react";
import { useRemarques, addRemarque, updRemarque, delRemarque, remTime } from "../data/remarques";
import Btn from "../components/Btn";

/* ═══════════════════════ Remarques ═══════════════════════
   📝 ملاحظات البنت — كتبتي بسهولة، شفتيها، عالجتيها
   (كل بنت كاتشوف غير الملاحظات ديالها)
   ═══════════════════════════════════════════════════════════ */

export default function Remarques({ agent }: { agent: string }) {
  const all = useRemarques();
  const list = useMemo(
    () => all.filter((r) => r.agent.toLowerCase() === agent.toLowerCase()).sort((a, b) => b.at.localeCompare(a.at)),
    [all, agent],
  );
  const pending = list.filter((r) => !r.done).length;

  const [text, setText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    addRemarque(agent, text.trim());
    setText("");
  };

  const saveEdit = () => {
    if (editId !== null && editText.trim()) updRemarque(editId, { text: editText.trim() });
    setEditId(null);
    setEditText("");
  };

  return (
    <div dir="rtl" className="h-full overflow-auto bg-slate-50 p-3 sm:p-4">
      <div className="mx-auto max-w-2xl">

        {/* ── الرأس ── */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-white p-3 shadow-sm">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-base text-white shadow-sm">📝</span>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800">ملاحظات {agent}</h2>
            <p className="text-[10px] text-slate-400">تذكيرات ديالك على الزبناء والطلبيات — كتب هنا شنو مهم</p>
          </div>
          <span className="ms-auto rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">{list.length} ملاحظة</span>
          {pending > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600">{pending} فالانتظار</span>}
        </div>

        {/* ── إضافة ملاحظة ── */}
        <form onSubmit={add} className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 shadow-sm">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="اكتبي الملاحظة ديالك... مثال: هاد الزبون لي فالسطر 2150 خاص نصوني ليه معا 2 — نفكروا بلي الليفرور كايدوز عندو"
            className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-xs leading-6 text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] font-semibold text-amber-600">💡 الملاحظة كتحفظ فوراً عند الإضافة</span>
            <Btn icon="＋" color="amber" onClick={add as unknown as () => void} className="ms-auto">إضافة الملاحظة</Btn>
          </div>
        </form>

        {/* ── اللائحة ── */}
        <div className="space-y-2">
          {list.map((r) => (
            <div key={r.id}
              className={`rounded-2xl border p-3 shadow-sm transition ${r.done ? "border-slate-200 bg-slate-100/80" : "border-amber-100 bg-white"}`}
              style={{ borderRightWidth: r.done ? undefined : 4, borderRightColor: "#fbbf24" }}>
              {editId === r.id ? (
                <div>
                  <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs leading-6 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                  <div className="mt-2 flex gap-2">
                    <Btn icon="✓" color="emerald" onClick={saveEdit}>حفظ</Btn>
                    <Btn icon="✕" color="slate" variant="ghost" onClick={() => { setEditId(null); setEditText(""); }}>إلغاء</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <p className={`whitespace-pre-wrap text-xs leading-6 ${r.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{r.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">🕐 {remTime(r.at)}</span>
                    <button onClick={() => updRemarque(r.id, { done: !r.done })}
                      title={r.done ? "رجّعيها فالانتظار" : "علّميها كمعالجة"}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold transition ${r.done ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                      {r.done ? "✓ معالجة" : "○ فالانتظار"}
                    </button>
                    <button onClick={() => { setEditId(r.id); setEditText(r.text); }} title="تعديل"
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600">✏️</button>
                    <button onClick={() => confirm("مسح الملاحظة؟") && delRemarque(r.id)} title="مسح"
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600">🗑️</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── حالة الفراغ ── */}
        {!list.length && (
          <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-8 text-center">
            <div className="mb-2 text-4xl">📝</div>
            <p className="text-sm font-bold text-slate-600">ما عندك حتى ملاحظة دابا</p>
            <p className="mt-1 text-[11px] text-slate-400">كتبي أول واحدة من الفورم لي فوق — مثلا تذكير على شي زبون خاص</p>
          </div>
        )}
        <div className="h-4" />
      </div>
    </div>
  );
}
