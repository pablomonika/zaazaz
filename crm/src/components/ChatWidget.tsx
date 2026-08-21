import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth";
import { useChat, sendChatMessage, markChatRead, chatTime, type ChatMsg } from "../data/chat";

/* ═══════════════════════ ChatWidget ═══════════════════════
   💬 Bulle de chat flottante (bas-gauche) — comme les grands sites
   👩 Fille : une conversation privée avec l'Admin
   🛡️ Admin : liste de toutes les conversations + réponse
   ═════════════════════════════════════════════════════════════ */

const AV = ["from-indigo-500 to-violet-600", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-600", "from-amber-500 to-orange-600", "from-rose-500 to-pink-600", "from-slate-500 to-slate-700"];
const avColor = (n: string) => AV[[...(n || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

type Thread = { girl: string; girlName: string; msgs: ChatMsg[]; unread: number; last: ChatMsg };

export default function ChatWidget() {
  const { currentUser } = useAuth();
  const msgs = useChat();
  const isAdmin = currentUser?.role === "admin";
  const me = currentUser?.username || "";
  const myName = isAdmin ? "Admin" : (currentUser?.agent || currentUser?.username || "?");

  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<string | null>(null); // admin uniquement
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  /* ── Messages de MA conversation (fille) ── */
  const myThread = useMemo(() =>
    msgs
      .filter((m) => m.from === me || m.to === me)
      .sort((a, b) => a.at.localeCompare(b.at)),
    [msgs, me]);

  /* ── Toutes les conversations (admin) ── */
  const threads = useMemo<Thread[]>(() => {
    const m = new Map<string, ChatMsg[]>();
    msgs.forEach((msg) => {
      const girl = msg.fromRole === "user" ? msg.from : (msg.to !== "admin" ? msg.to : null);
      if (!girl) return;
      if (!m.has(girl)) m.set(girl, []);
      m.get(girl)!.push(msg);
    });
    return [...m.entries()].map(([girl, list]) => {
      const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
      return {
        girl,
        girlName: sorted.find((x) => x.fromRole === "user")?.fromName || girl,
        msgs: sorted,
        unread: sorted.filter((x) => x.to === "admin" && !x.read).length,
        last: sorted[sorted.length - 1],
      };
    }).sort((a, b) => b.last.at.localeCompare(a.last.at));
  }, [msgs]);

  const unread = useMemo(() =>
    isAdmin
      ? msgs.filter((m) => m.to === "admin" && !m.read).length
      : msgs.filter((m) => m.to === me && !m.read).length,
    [msgs, isAdmin, me]);

  /* marquer lu à l'ouverture */
  useEffect(() => {
    if (!open) return;
    if (isAdmin) { if (thread) markChatRead("admin", thread); }
    else markChatRead(me);
  }, [open, thread, msgs, isAdmin, me]);

  /* scroll auto vers le bas */
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [myThread.length, threads, thread, open]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (isAdmin && thread) sendChatMessage(me, "Admin", "admin", thread, t);
    else if (!isAdmin) sendChatMessage(me, myName, "user", "admin", t);
    setText("");
  };

  const shown = isAdmin ? (threads.find((x) => x.girl === thread)?.msgs || []) : myThread;
  const otherName = isAdmin ? (threads.find((x) => x.girl === thread)?.girlName || "") : "فريق الإدارة";

  /* Portal → body : ما كايتأثرش بأي عنصر أب (fixed مضبوط ديما) */
  return createPortal(
    <>
      {/* ══ Bulle flottante ══ */}
      <button
        onClick={() => { setOpen((v) => !v); if (!open && isAdmin) setThread(null); }}
        title={isAdmin ? "محادثات الفريق" : "تواصلي مع الإدارة"}
        className={`fixed bottom-5 left-5 z-[70] grid h-14 w-14 place-items-center rounded-full text-2xl text-white shadow-xl transition-all hover:scale-105 active:scale-95 ${
          unread > 0
            ? "animate-pulse bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-300"
            : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-200"
        }`}
      >
        {open ? "✕" : "💬"}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-red-600 px-1 text-[11px] font-extrabold text-white shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* ══ Panneau ══ */}
      {open && (
        <div dir="rtl" className="fixed bottom-[84px] left-3 right-3 z-[70] flex h-[480px] w-auto max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.30)] sm:left-5 sm:right-auto sm:w-[350px]">

          {/* ── En-tête ── */}
          <div className="flex shrink-0 items-center gap-2.5 bg-gradient-to-l from-indigo-600 to-violet-600 px-3.5 py-3 text-white">
            {isAdmin && thread ? (
              <button onClick={() => setThread(null)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/20 transition hover:bg-white/30" title="رجوع">→</button>
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-base">{isAdmin ? "🛡️" : "👩‍💼"}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-extrabold">
                {isAdmin ? (thread ? otherName : "محادثات الفريق") : "فريق الإدارة"}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-indigo-100">
                <i className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> {isAdmin ? (thread ? "في المحادثة" : `${threads.length} محادثة`) : "موجود دابا"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 transition hover:bg-white/25">✕</button>
          </div>

          {/* ── Corps ── */}
          {isAdmin && !thread ? (
            /* liste des conversations (admin) */
            <div className="flex-1 overflow-auto">
              {threads.map((t) => (
                <button key={t.girl} onClick={() => setThread(t.girl)}
                  className={`flex w-full items-center gap-2.5 border-b border-slate-50 px-3 py-2.5 text-start transition hover:bg-indigo-50/60 ${t.unread ? "bg-indigo-50/40" : ""}`}>
                  <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-extrabold text-white ${avColor(t.girl)}`}>
                    {t.girlName.charAt(0).toUpperCase()}
                    {t.unread > 0 && <i className="absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">{t.unread}</i>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <b className="truncate text-xs font-extrabold text-slate-800">{t.girlName}</b>
                      <span className="ms-auto shrink-0 text-[9px] font-medium text-slate-400">{chatTime(t.last.at)}</span>
                    </span>
                    <span className={`block truncate text-[11px] ${t.unread ? "font-bold text-slate-700" : "text-slate-500"}`}>
                      {t.last.fromRole === "user" ? t.last.text : `أنت: ${t.last.text}`}
                    </span>
                  </span>
                </button>
              ))}
              {!threads.length && (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <div className="mb-2 text-4xl">📭</div>
                    <p className="text-xs font-bold text-slate-500">ما كاين حتى محادثة</p>
                    <p className="mt-1 text-[10px] text-slate-400">ملي شي بنت ترسل ميساج، كايبان هنا</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* messages */
            <>
              <div ref={listRef} className="flex-1 space-y-2 overflow-auto bg-slate-50 p-3">
                {shown.map((m) => {
                  const mine = m.from === me;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${mine ? "rounded-bl-sm bg-indigo-600 text-white" : "rounded-br-sm border border-slate-200 bg-white text-slate-800"}`}>
                        {!mine && <div className="mb-0.5 text-[9px] font-extrabold text-indigo-600">{m.fromRole === "admin" ? "🛡️ الإدارة" : m.fromName}</div>}
                        <div className="text-xs leading-5 break-words">{m.text}</div>
                        <div className={`mt-0.5 text-[8px] ${mine ? "text-indigo-200" : "text-slate-400"}`}>{chatTime(m.at)} {m.read ? "✓✓" : "✓"}</div>
                      </div>
                    </div>
                  );
                })}
                {!shown.length && (
                  <div className="grid h-full place-items-center p-6 text-center">
                    <div>
                      <div className="mb-2 text-4xl">👋</div>
                      <p className="text-xs font-bold text-slate-500">{isAdmin ? "بدا المحادثة بسلام 👋" : "عندك شي سؤال؟ صيفطي ميساج للأدمين"}</p>
                      <p className="mt-1 text-[10px] text-slate-400">الرسائل خاصة — ما كايشوفها حتى حد آخر</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Zone de saisie ── */}
              <form onSubmit={send} className="flex shrink-0 items-center gap-1.5 border-t border-slate-200 bg-white p-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={isAdmin && !thread ? "اختر محادثة أولاً..." : "اكتب الرسالة..."}
                  disabled={isAdmin && !thread}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                />
                <button type="submit" disabled={(!text.trim()) || (isAdmin && !thread)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md transition hover:scale-105 active:scale-95 disabled:opacity-40"
                  title="إرسال">➤</button>
              </form>
            </>
          )}
        </div>
      )}
    </>,
    document.body,
  );
}
