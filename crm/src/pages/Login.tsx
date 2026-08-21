import { useState } from "react";
import { useAuth } from "../auth";

function Logo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="42" height="42" rx="4" stroke="#0f2a5c" strokeWidth="3" fill="#fff" />
      <rect x="11" y="24" width="6" height="14" rx="1" fill="#2ecc71" />
      <rect x="21" y="17" width="6" height="21" rx="1" fill="#e74c3c" />
      <rect x="31" y="11" width="6" height="27" rx="1" fill="#3b82f6" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(!login(username, password));
  };

  return (
    <div dir="rtl" className="relative min-h-screen w-full overflow-hidden bg-white font-sans lg:flex">
      {/* ── Left: marketing panel ── */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-8 py-12 lg:w-1/2 lg:py-0">
        <Logo size={78} />
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-[#0f2a5c] lg:text-5xl">Paraveda</h1>
        <p className="mt-4 text-lg font-bold text-[#0f2a5c]">منصة إدارة الطلبات والمخزون</p>
        <p className="mt-3 max-w-md text-center text-sm leading-7 text-slate-500">
          حل متكامل لمتابعة مبيعاتك، إدارة المخزون، وتحليل أداء أعمالك بسهولة واحترافية.
        </p>
        {/* 🖥️ Mockup مدمج (SVG) — بلا ملفات خارجية */}
        <svg viewBox="0 0 560 340" className="mt-8 w-full max-w-xl select-none" role="img" aria-label="Paraveda CRM">
          <defs>
            <linearGradient id="gBar" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#818cf8" /><stop offset="1" stopColor="#c084fc" />
            </linearGradient>
            <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          {/* لابتوب */}
          <rect x="70" y="30" width="330" height="220" rx="12" fill="#fff" stroke="#e2e8f0" strokeWidth="3" />
          <rect x="70" y="30" width="330" height="34" rx="12" fill="#f1f5f9" />
          <circle cx="90" cy="47" r="5" fill="#f87171" /><circle cx="108" cy="47" r="5" fill="#fbbf24" /><circle cx="126" cy="47" r="5" fill="#34d399" />
          <rect x="55" y="248" width="360" height="12" rx="6" fill="#e2e8f0" />
          {/* شارت الأعمدة */}
          <rect x="100" y="150" width="26" height="70" rx="4" fill="url(#gBar)" />
          <rect x="138" y="120" width="26" height="100" rx="4" fill="url(#gBar)" />
          <rect x="176" y="165" width="26" height="55" rx="4" fill="url(#gBar)" />
          <rect x="214" y="100" width="26" height="120" rx="4" fill="url(#gBar)" />
          <rect x="252" y="135" width="26" height="85" rx="4" fill="url(#gBar)" />
          {/* الخط */}
          <polyline points="100,140 150,100 200,125 250,70 300,95 360,55" fill="none" stroke="url(#gLine)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="360" cy="55" r="5" fill="#a855f7" />
          {/* بطاقات */}
          <rect x="320" y="130" width="60" height="34" rx="6" fill="#ede9fe" />
          <rect x="320" y="174" width="60" height="34" rx="6" fill="#d1fae5" />
          {/* تيليفون */}
          <rect x="420" y="80" width="110" height="190" rx="16" fill="#0f172a" />
          <rect x="428" y="92" width="94" height="166" rx="10" fill="#fff" />
          <rect x="428" y="92" width="94" height="24" rx="10" fill="#6366f1" />
          <rect x="438" y="126" width="74" height="10" rx="5" fill="#e2e8f0" />
          <rect x="438" y="144" width="56" height="10" rx="5" fill="#e2e8f0" />
          <circle cx="455" cy="190" r="12" fill="#34d399" />
          <rect x="474" y="182" width="40" height="8" rx="4" fill="#cbd5e1" />
          <rect x="474" y="196" width="30" height="8" rx="4" fill="#e2e8f0" />
          <circle cx="455" cy="228" r="12" fill="#f87171" />
          <rect x="474" y="220" width="40" height="8" rx="4" fill="#cbd5e1" />
          <rect x="474" y="234" width="30" height="8" rx="4" fill="#e2e8f0" />
          {/* ظل */}
          <ellipse cx="280" cy="322" rx="230" ry="12" fill="#0f172a" opacity="0.06" />
        </svg>
      </div>

      {/* ── Curved navy background (right side) ── */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] lg:block" aria-hidden>
        <svg viewBox="0 0 800 1000" preserveAspectRatio="none" className="h-full w-full">
          <path d="M170 0 C 40 260, 300 620, 120 1000 L800 1000 L800 0 Z" fill="#0f2a5c" />
          <path d="M198 0 C 68 260, 328 620, 148 1000" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="2" fill="none" />
          <path d="M228 0 C 98 260, 358 620, 178 1000" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="2" fill="none" />
        </svg>
        {/* dotted grid decoration */}
        <div className="absolute right-8 top-8 grid grid-cols-8 gap-3 opacity-40">
          {Array.from({ length: 32 }).map((_, i) => (
            <span key={i} className="block h-1.5 w-1.5 rounded-full bg-white/60" />
          ))}
        </div>
      </div>

      {/* ── Right: login card ── */}
      <div className="relative z-10 flex w-full items-center justify-center bg-[#0f2a5c] px-6 py-14 lg:w-1/2 lg:bg-transparent lg:px-10 lg:py-0">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-[26px] bg-white p-8 shadow-[0_25px_70px_-20px_rgba(0,0,0,0.45)] sm:p-10"
        >
          <div className="flex flex-col items-center text-center">
            <Logo size={46} />
            <h2 className="mt-4 text-2xl font-extrabold text-[#0f2a5c]">Paraveda</h2>
            <p className="mt-2 text-lg font-bold text-blue-600">مرحباً بك مجدّدًا</p>
            <p className="mt-1 text-sm text-slate-500">سجل دخولك للوصول إلى حسابك</p>
          </div>

          <div className="mt-8 space-y-4">
            {/* username */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 focus-within:border-blue-500 focus-within:bg-white">
              <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" strokeLinecap="round" />
              </svg>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="اسم المستخدم"
                autoComplete="username"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            {/* password */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 focus-within:border-blue-500 focus-within:bg-white">
              <svg className="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              </svg>
              <input
                required
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                autoComplete="current-password"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400"
              />
              <button type="button" onClick={() => setShow(!show)} className="shrink-0 text-slate-400 hover:text-slate-600" title={show ? "إخفاء" : "إظهار"}>
                {show ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.6 4.4M6.2 6.7A17 17 0 0 0 2 12s3.6 7 10 7c1 0 2-.2 2.9-.5" strokeLinecap="round" /></svg>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                تذكرني
              </label>
              <button type="button" className="font-medium text-blue-600 hover:underline">نسيت كلمة المرور؟</button>
            </div>

            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white transition hover:bg-blue-700 active:scale-[0.99]">
              دخول
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" strokeLinecap="round" />
                <path d="M11 16l-4-4 4-4M7 12h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {error && (
              <p className="rounded-lg bg-red-50 py-2 text-center text-sm font-medium text-red-600">
                اسم المستخدم أو كلمة المرور غير صحيحة
              </p>
            )}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
            </svg>
            بياناتك محمية بالكامل
          </div>
        </form>
      </div>
    </div>
  );
}
