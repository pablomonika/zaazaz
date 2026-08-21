import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useVilles, normalizeCity, priceForCity, type Ville } from "../data/villes";

/* ═══════════════════════ CityInput (pro v3) ═══════════════════════
   ✍️ إكمال أوتوماتيكي: تكتب "mar" → كتكمل "Marrakech" بوحدها
      (الجزء المكمول مظلل — كمّل الكتابة بدلو ولا Enter للتثبيت)
   🔍 القايمة: جميع المدن (كتبدا بالحروف أولاً ثم كايحتاوهم)
      — مرسومة عبر PORTAL باش ما يقدر يخبيها حتى فلتر/سطر
   ✅ المدينة الصحيحة = من LES VILLES + الثمن أوتوماتيك
   🔴 الغالطة / العربية = حمرا + ⚠️
   ════════════════════════════════════════════════════════════════════ */

const DROP_H = 340;

export default function CityInput({ value, onChange, className, style }: {
  value: string;
  onChange: (city: string, prix: number | null) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const villes = useVilles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0, above: false });
  const [hi, setHi] = useState(0);
  const [selRange, setSelRange] = useState<[number, number] | null>(null);

  const typed = value.trim();

  /* تطبيق التحديد (الجزء المكمول) بعد تحديث القيمة */
  useEffect(() => {
    if (selRange && inputRef.current) {
      inputRef.current.setSelectionRange(selRange[0], selRange[1]);
      setSelRange(null);
    }
  }, [value, selRange]);

  /* المدينة صحيحة؟ */
  const valid = useMemo(() => {
    if (!typed) return true;
    if (/[\u0600-\u06FF]/.test(value)) return false;
    const norm = normalizeCity(value);
    return villes.some((v) => normalizeCity(v.nom) === norm);
  }, [value, typed, villes]);

  /* الجزئين: كتبدا بالحروف / كايحتاو الحروف */
  const { starts, contains, all } = useMemo(() => {
    if (!typed) return { starts: villes.slice(0, 10), contains: [] as Ville[], all: villes.slice(0, 10) };
    const norm = normalizeCity(typed);
    const starts = villes.filter((v) => normalizeCity(v.nom).startsWith(norm));
    const contains = villes.filter((v) => !starts.includes(v) && normalizeCity(v.nom).includes(norm));
    return { starts, contains, all: [...starts, ...contains] };
  }, [typed, villes]);

  const openMenu = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom >= DROP_H + 20;
    setPos({
      x: Math.max(8, Math.min(r.left, window.innerWidth - 336)),
      y: below ? r.bottom + 4 : Math.max(8, r.top - DROP_H - 4),
      above: !below,
    });
    setOpen(true);
    setHi(0);
  };

  const pick = (v: Ville) => {
    onChange(v.nom, v.prix);
    setOpen(false);
  };

  /* ✍️ الكتابة + الإكمال الأوتوماتيكي (جميع المدن — حتى اللي فيهم حركات) */
  const handleChange = (raw: string) => {
    let final = raw;
    if (raw && !/[\u0600-\u06FF]/.test(raw)) {
      const norm = normalizeCity(raw);
      // أول مدينة كتبدا بهاد الحروف (بلا حساسية للحروف الكبيرة/الصغيرة والحركات)
      const hit = villes.find((v) => normalizeCity(v.nom).startsWith(norm));
      if (hit && normalizeCity(hit.nom) !== norm) {
        final = hit.nom;                      // كمل المدينة
        setSelRange([raw.length, final.length]); // و ظلل الجزء المكمول
      }
    }
    onChange(final, priceForCity(final, villes));
    if (!open && inputRef.current) openMenu(inputRef.current);
    else setHi(0);
  };

  /* تظليل الحروف المكتوبين */
  const Name = ({ nom }: { nom: string }) => {
    if (!typed) return <>{nom}</>;
    const i = nom.toLowerCase().indexOf(typed.toLowerCase());
    if (i < 0) return <>{nom}</>;
    return (
      <>
        {nom.slice(0, i)}
        <b className="text-indigo-700">{nom.slice(i, i + typed.length)}</b>
        {nom.slice(i + typed.length)}
      </>
    );
  };

  const Row = ({ v, i }: { v: Ville; i: number }) => (
    <div
      key={v.nom}
      onMouseDown={(e) => { e.preventDefault(); pick(v); }}
      onMouseEnter={() => setHi(i)}
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-[6px] text-[11.5px] transition-colors ${
        i === hi ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"
      }`}
    >
      <span className="min-w-0 flex-1 text-start font-semibold leading-snug text-slate-700"><Name nom={v.nom} /></span>
      <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">{v.prix} DH</span>
    </div>
  );

  const Section = ({ text }: { text: string }) => (
    <div className="px-2.5 pb-0.5 pt-2 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{text}</div>
  );

  return (
    <>
      <div className="relative flex h-full w-full items-center">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={(e) => { openMenu(e.currentTarget); e.currentTarget.select(); }}
          onClick={(e) => { e.currentTarget.select(); if (!open) openMenu(e.currentTarget); }}
          onBlur={() => setTimeout(() => setOpen(false), 250)}
          onKeyDown={(e) => {
            if (!open || !all.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % all.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + all.length) % all.length); }
            else if (e.key === "Enter") { e.preventDefault(); pick(all[hi]); }
            else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          className={className}
          style={{
            ...style,
            color: !valid ? "#dc2626" : (style?.color ?? undefined),
            fontWeight: valid ? style?.fontWeight : 700,
            background: !valid ? "rgba(220,38,38,0.10)" : style?.background,
          }}
          title={valid ? "اكتب أول حروف المدينة — كتكمل وحدها ولا اختر من القايمة" : "⚠️ مدينة غير صحيحة — اختر من لائحة LES VILLES"}
        />
        {!valid && (
          <span className="pointer-events-none absolute end-1 text-[10px]" title="مدينة خاطئة — لازم تصلحها">⚠️</span>
        )}
      </div>

      {/* ══ القايمة — PORTAL (مباشرة فـ body) باش ما يخبيها حتى شيء ══ */}
      {open && all.length > 0 && createPortal(
        <div
          dir="ltr"
          onMouseDown={(e) => e.preventDefault()}
          className="fixed z-[9999] w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.20)]"
          style={{
            left: pos.x,
            top: pos.above ? undefined : pos.y,
            bottom: pos.above ? Math.max(0, window.innerHeight - pos.y) : undefined,
            maxHeight: DROP_H,
          }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white px-3 py-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[11px]">🏙️</span>
            {typed ? (
              <>
                <span className="text-[11px] font-extrabold text-slate-700">{all.length} مدينة</span>
                <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{typed}</span>
              </>
            ) : (
              <span className="text-[11px] font-extrabold text-slate-700">أشهر المدن</span>
            )}
            <span className="ms-auto shrink-0 text-[9px] font-semibold text-slate-400">↑↓ · Enter ✓</span>
          </div>

          <div className="overflow-auto py-1" style={{ maxHeight: DROP_H - 80 }}>
            {typed ? (
              <>
                {starts.length > 0 && <Section text={`كتبدا بـ "${typed}"`} />}
                {starts.map((v, i) => <Row key={v.nom} v={v} i={i} />)}
                {contains.length > 0 && <Section text={`كايحتاو "${typed}"`} />}
                {contains.map((v, i) => <Row key={v.nom} v={v} i={starts.length + i} />)}
              </>
            ) : (
              starts.map((v, i) => <Row key={v.nom} v={v} i={i} />)
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[9px] font-semibold text-slate-400">
            💰 الثمن كايتحسب أوتوماتيك فـ commision · 🔴 حمرا = مدينة غالطة
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
