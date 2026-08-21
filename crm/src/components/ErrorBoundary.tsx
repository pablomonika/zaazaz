import { Component, type ReactNode } from "react";

/* ═══════════════════════ ErrorBoundary — درع الصفحة البيضاء ═══════════════════════
   إلا وقع أي خطأ فـ التطبيق، بدل صفحة بيضاء كتبان هاد الرسالة الواضحة
   مع زر إعادة التشغيل وزر إصلاح (يمسح غير البيانات التقنية بلا الطلبيات)
   ═══════════════════════════════════════════════════════════════════════════════════ */

const TECH_KEYS = [
  "afrizon_chat_v1",
  "afrizon_worktimes_v1",
  "afrizon_remarques_v1",
  "afrizon_villes_v1",
  "afrizon_villes_v2",
  "afrizon_history_v1",
];

export default class ErrorBoundary extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { err: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error("CRM Error:", e);
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xl">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-3xl">⚠️</div>
          <h1 className="text-lg font-extrabold text-slate-800">وقع شي مشكل فـ التحميل</h1>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            ما وقعتش خسارة فـ البيانات. جرب زر <b>الإصلاح</b> ولا <b>إعادة التشغيل</b>.
            إلا بقى المشكل، صيفط هاد الرسالة للمطور:
          </p>
          <pre dir="ltr" className="mt-3 max-h-32 overflow-auto rounded-xl bg-slate-100 p-2.5 text-left text-[10px] leading-4 text-red-700">
            {this.state.err}
          </pre>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => { TECH_KEYS.forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } }); window.location.reload(); }}
              className="rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:from-amber-500 hover:to-amber-600 active:scale-[0.97]">
              🛠️ الإصلاح (مسح الكاش التقني)
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 active:scale-[0.97]">
              ↺ إعادة التشغيل
            </button>
          </div>
        </div>
      </div>
    );
  }
}
