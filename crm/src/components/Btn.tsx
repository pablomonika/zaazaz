/* ═══════════════════════ Btn — زر احترافي موحد ═══════════════════════
   جوج أنماط: solid (أساسي ممتلئ) و ghost (ثانوي بحدود)
   + أيقونة + hover/active ناعم — نفس الهوية فـ كل الصفحات
   ═══════════════════════════════════════════════════════════════════════ */

type BtnColor = "blue" | "emerald" | "teal" | "red" | "slate" | "violet" | "amber" | "indigo";

const S: Record<BtnColor, { solid: string; ghost: string }> = {
  blue: {
    solid: "border-blue-600 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-md shadow-blue-200 hover:from-blue-600 hover:to-blue-700 hover:shadow-blue-300",
    ghost: "border-slate-200 bg-white text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm",
  },
  emerald: {
    solid: "border-emerald-600 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-200 hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-300",
    ghost: "border-slate-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-sm",
  },
  teal: {
    solid: "border-teal-600 bg-gradient-to-b from-teal-500 to-teal-600 text-white shadow-md shadow-teal-200 hover:from-teal-600 hover:to-teal-700",
    ghost: "border-slate-200 bg-white text-teal-700 hover:border-teal-300 hover:bg-teal-50 hover:shadow-sm",
  },
  red: {
    solid: "border-red-600 bg-gradient-to-b from-red-500 to-red-600 text-white shadow-md shadow-red-200 hover:from-red-600 hover:to-red-700 hover:shadow-red-300",
    ghost: "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100 hover:shadow-sm",
  },
  slate: {
    solid: "border-slate-600 bg-gradient-to-b from-slate-500 to-slate-600 text-white shadow-md hover:from-slate-600 hover:to-slate-700",
    ghost: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:shadow-sm",
  },
  violet: {
    solid: "border-violet-600 bg-gradient-to-b from-violet-500 to-violet-600 text-white shadow-md shadow-violet-200 hover:from-violet-600 hover:to-violet-700",
    ghost: "border-slate-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50 hover:shadow-sm",
  },
  amber: {
    solid: "border-amber-500 bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200 hover:from-amber-500 hover:to-amber-600",
    ghost: "border-slate-200 bg-white text-amber-700 hover:border-amber-300 hover:bg-amber-50 hover:shadow-sm",
  },
  indigo: {
    solid: "border-indigo-600 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-200 hover:from-indigo-600 hover:to-indigo-700 hover:shadow-indigo-300",
    ghost: "border-slate-200 bg-white text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm",
  },
};

export default function Btn({
  icon, children, color = "slate", variant = "solid", onClick, title, className = "", disabled, pulse,
}: {
  icon?: string;
  children: React.ReactNode;
  color?: BtnColor;
  variant?: "solid" | "ghost";
  onClick?: () => void;
  title?: string;
  className?: string;
  disabled?: boolean;
  pulse?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-[7px] text-xs font-bold transition-all duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ${S[color][variant]} ${pulse ? "animate-pulse" : ""} ${className}`}
    >
      {icon && <span className="text-sm leading-none">{icon}</span>}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}
