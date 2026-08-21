import { createPortal } from "react-dom";

/* ═══════════════════════ WelcomeOverlay ═══════════════════════
   🌸 رسالة ترحيب احترافية بالاسم — كتبان عند الدخول للـ CRM
   وكتختافي وحدها من بعد 3 تواني (بلا ما تعيق الخدمة)
   ═══════════════════════════════════════════════════════════════ */

export default function WelcomeOverlay({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "صباح الخير ☀️" : h < 18 ? "نهارك سعيد 🌤️" : "مساء الخير 🌙";
  const sub = isAdmin
    ? "كلشي تحت السيطرة — يوم مليح للقيادة 🛡️"
    : "بالتوفيق اليوم فـ الطلبيات — عاونك الله 💪";
  const initial = (name || "?").charAt(0).toUpperCase();

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] grid place-items-center p-4">
      <div
        dir="rtl"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl"
        style={{ animation: "welcomeIn 0.45s cubic-bezier(0.22,1,0.36,1) forwards, welcomeOut 0.4s ease-in 2.7s forwards" }}
      >
        {/* توهج علوي */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-indigo-100/70 to-transparent" />

        {/* الأفاتار */}
        <div
          className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-3xl font-black text-white shadow-lg"
          style={{ animation: "welcomeGlow 1.6s ease-in-out 2" }}
        >
          {initial}
          <span className="absolute -bottom-1 -left-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-emerald-500 text-xs shadow">✓</span>
        </div>

        {/* الترحيب */}
        <p className="mt-4 text-sm font-bold text-slate-500">{greeting}</p>
        <h2 className="mt-1 bg-gradient-to-l from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-3xl font-black tracking-tight text-transparent">
          {name}
        </h2>
        <p className="mt-2 text-xs font-semibold text-slate-500">{sub}</p>

        {/* شريط الـ 3 تواني */}
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-slate-200/80">
          <div className="h-full rounded-full bg-gradient-to-l from-indigo-500 to-violet-500" style={{ animation: "welcomeBar 3s linear forwards" }} />
        </div>

        {/* شعار صغير */}
        <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Paraveda · CRM</p>
      </div>
    </div>,
    document.body,
  );
}
