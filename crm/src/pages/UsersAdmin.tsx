import { useState } from "react";
import { useAuth } from "../auth";
import { useStore } from "../store";
import Btn from "../components/Btn";

/* ═══════════════════════ إدارة المستخدمين ═══════════════════════
   Page Admin : comptes d'accès au CRM (ajout, modification, sécurité)
   ═══════════════════════════════════════════════════════════════ */

function Kpi({ icon, label, value, color, bg }: { icon: string; label: string; value: number | string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg" style={{ background: bg, color }}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xl font-extrabold leading-none" style={{ color }}>{value}</div>
        <div className="mt-1 truncate text-[11px] font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export default function UsersAdmin() {
  const { users, addUser, updateUser, removeUser, changeAdminPassword, currentUser } = useAuth();
  const { agentNames } = useStore();

  /* ── Formulaire d'ajout ── */
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agent, setAgent] = useState(agentNames[0] || "");
  const [newRole, setNewRole] = useState<"admin" | "user">("user");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Sécurité admin ── */
  const [np, setNp] = useState("");
  const [np2, setNp2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  /* ── Affichage des mots de passe ── */
  const [showPw, setShowPw] = useState<Record<number, boolean>>({});

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    agents: users.filter((u) => u.role === "user").length,
    noPage: users.filter((u) => u.role === "user" && !u.agent).length,
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUser(username, password, agent, newRole)) {
      setAddMsg({ ok: false, text: "⚠️ تأكد من المعلومات — أو اسم المستخدم موجود بالفعل" });
      return;
    }
    setUsername(""); setPassword("");
    setAddMsg({ ok: true, text: newRole === "admin" ? `✅ تزاد الأدمين "${username}" — عندو كل الصلاحيات 🛡️` : `✅ تزاد المستخدم "${username}" — كايدخل من صفحة Login بـ ${agent}` });
  };

  /* حمايات الرتبة */
  const adminsCount = users.filter((u) => u.role === "admin").length;
  const canToggleRole = (uid: number) => {
    const u = users.find((x) => x.id === uid);
    if (!u) return false;
    if (u.role === "admin" && (u.id === currentUser?.id || adminsCount <= 1)) return false;
    return true;
  };
  const setRole = (uid: number, role: "admin" | "user") => {
    if (!canToggleRole(uid)) return alert("ما يمكنش تبدل رتبة راسك ولا رتبة آخر أدمين 🛡️");
    const u = users.find((x) => x.id === uid);
    if (!u) return;
    if (role === "user" && !u.agent && agentNames.length) updateUser(uid, { role, agent: agentNames[0] });
    else updateUser(uid, { role });
  };
  const canDelete = (uid: number) => {
    const u = users.find((x) => x.id === uid);
    if (!u) return false;
    if (u.role === "user") return true;
    return u.id !== currentUser?.id && adminsCount > 1;
  };

  const submitAdminPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (np.length < 6) return setPwMsg({ ok: false, text: "⚠️ كلمة المرور قصيرة — 6 أحرف على الأقل" });
    if (np !== np2) return setPwMsg({ ok: false, text: "⚠️ الكلمتين ماشي بحال بحال — عاود كتب" });
    if (!changeAdminPassword(np)) return setPwMsg({ ok: false, text: "⚠️ ما قدرناش نبدلو — عاود المحاولة" });
    setNp(""); setNp2("");
    setPwMsg({ ok: true, text: "✅ تبدلت كلمة مرور الأدمين بنجاح" });
  };

  const inputCls = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
  const labelCls = "block text-[11px] font-semibold text-slate-600";

  return (
    <div dir="rtl" className="h-full overflow-auto bg-slate-50 p-5 text-sm text-slate-800">

      {/* ── En-tête ── */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-xl text-white shadow-lg shadow-violet-200">🔐</div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800">إدارة المستخدمين</h1>
          <p className="text-xs text-slate-500">Gestion des accès au CRM — الحسابات، الصلاحيات وكلمات المرور</p>
        </div>
      </div>

      {/* ── Statistiques ── */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon="👥" label="مجموع المستخدمين" value={stats.total} color="#1e293b" bg="#f1f5f9" />
        <Kpi icon="🛡️" label="الأدمين (كل الصلاحيات)" value={stats.admins} color="#7c3aed" bg="#ede9fe" />
        <Kpi icon="👤" label="الوكيلات (صفحة واحدة)" value={stats.agents} color="#2563eb" bg="#dbeafe" />
        <Kpi icon="⚠️" label="بلا صفحة مربوطة" value={stats.noPage} color={stats.noPage ? "#dc2626" : "#059669"} bg={stats.noPage ? "#fee2e2" : "#d1fae5"} />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-3">

        {/* ── Colonne gauche : ajout + sécurité ── */}
        <div className="space-y-5">

          {/* Ajout d'un utilisateur */}
          <form onSubmit={add} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-base text-blue-600">➕</span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">مستخدم جديد</h3>
                <p className="text-[10px] text-slate-400">User · Agent</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className={labelCls}>اسم المستخدم (Login)
                <input required dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: meryam@paraveda.ma" className={inputCls} />
              </label>
              <label className={labelCls}>كلمة المرور
                <input required dir="ltr" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className={inputCls} />
              </label>
              <label className={labelCls}>الصلاحية (Role)
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([["user", "👤 وكيلة — صفحة وحدة"], ["admin", "🛡️ Admin — كلشي"]] as const).map(([r, label]) => (
                    <button key={r} type="button" onClick={() => setNewRole(r)}
                      className={`rounded-xl border-2 px-2 py-2 text-[11px] font-bold transition ${newRole === r ? "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </label>
              {newRole === "user" && (
                <label className={labelCls}>الصفحة المربوطة (البنت)
                  <select value={agent} onChange={(e) => setAgent(e.target.value)} className={inputCls + " cursor-pointer"}>
                    {agentNames.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
              )}
              <button type="submit"
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] ${newRole === "admin" ? "bg-gradient-to-r from-violet-600 to-purple-600 shadow-violet-200 hover:from-violet-700 hover:to-purple-700" : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-200 hover:from-blue-700 hover:to-indigo-700"}`}>
                {newRole === "admin" ? "🛡️ إضافة أدمين" : "إضافة المستخدم"}
              </button>
              {addMsg && (
                <p className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${addMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{addMsg.text}</p>
              )}
            </div>
          </form>

          {/* Sécurité : mot de passe admin */}
          <form onSubmit={submitAdminPw} className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/70 to-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-base text-amber-600">🛡️</span>
              <div>
                <h3 className="text-sm font-bold text-slate-800">كلمة مرور الأدمين</h3>
                <p className="text-[10px] text-slate-400">Sécurité — Admin</p>
              </div>
            </div>
            <div className="space-y-3">
              <label className={labelCls}>كلمة المرور الجديدة
                <input dir="ltr" type="text" value={np} onChange={(e) => setNp(e.target.value)} placeholder="6 أحرف على الأقل" className={inputCls} />
              </label>
              <label className={labelCls}>تأكيد كلمة المرور
                <input dir="ltr" type="text" value={np2} onChange={(e) => setNp2(e.target.value)} placeholder="عاود كتبها" className={inputCls} />
              </label>
              <Btn icon="🛡️" color="amber" className="w-full !py-2.5 !text-sm" onClick={() => { if (np.length < 6) return setPwMsg({ ok: false, text: "⚠️ كلمة المرور قصيرة — 6 أحرف على الأقل" }); if (np !== np2) return setPwMsg({ ok: false, text: "⚠️ الكلمتين ماشي بحال بحال — عاود كتب" }); if (!changeAdminPassword(np)) return setPwMsg({ ok: false, text: "⚠️ ما قدرناش نبدلو — عاود المحاولة" }); setNp(""); setNp2(""); setPwMsg({ ok: true, text: "✅ تبدلت كلمة مرور الأدمين بنجاح" }); }}>بدّل كلمة المرور</Btn>
              {pwMsg && (
                <p className={`rounded-lg px-3 py-2 text-[11px] font-semibold ${pwMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>{pwMsg.text}</p>
              )}
            </div>
          </form>
        </div>

        {/* ── Colonne droite : tableau des utilisateurs ── */}
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-base text-slate-600">📋</span>
              <h3 className="text-sm font-bold text-slate-800">لائحة المستخدمين</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">{users.length}</span>
              <span className="ms-auto hidden text-[10px] text-slate-400 sm:block">✏️ كتقدر تعدل مباشرة فوق السطور</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold text-slate-500">
                    <th className="px-3 py-2.5 text-start">المستخدم</th>
                    <th className="px-3 py-2.5 text-center">الصفحة</th>
                    <th className="px-3 py-2.5 text-center">Role</th>
                    <th className="px-3 py-2.5 text-start">كلمة المرور</th>
                    <th className="px-3 py-2.5 text-center" style={{ width: 56 }}>مسح</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const visible = !!showPw[u.id];
                    return (
                      <tr key={u.id} className="group border-b border-slate-50 transition hover:bg-indigo-50/40">
                        {/* avatar + username */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-sm ${
                              u.role === "admin" ? "bg-gradient-to-br from-violet-500 to-purple-600" : "bg-gradient-to-br from-blue-500 to-indigo-500"
                            }`}>
                              {(u.username || "?").charAt(0).toUpperCase()}
                            </span>
                            <input dir="ltr" value={u.username} disabled={u.role === "admin"}
                              onChange={(e) => updateUser(u.id, { username: e.target.value })}
                              title={u.role === "admin" ? "حساب الأدمين ما كايتبدلش من هنا" : "تعديل اسم المستخدم"}
                              className={`min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm font-semibold outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-100 ${
                                u.role === "admin" ? "cursor-not-allowed text-slate-700" : "text-slate-800"
                              }`} />
                          </div>
                        </td>
                        {/* page de la fille */}
                        <td className="px-3 py-2.5 text-center">
                          {u.role === "admin"
                            ? <span className="inline-block rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700">🌐 كل الصفحات</span>
                            : (
                              <select value={u.agent} onChange={(e) => updateUser(u.id, { agent: e.target.value })}
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none transition hover:border-indigo-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                                <option value="">— بلا صفحة —</option>
                                {agentNames.map((a) => <option key={a}>{a}</option>)}
                              </select>
                            )}
                        </td>
                        {/* role */}
                        <td className="px-3 py-2.5 text-center">
                          {canToggleRole(u.id) ? (
                            <select value={u.role} onChange={(e) => setRole(u.id, e.target.value as "admin" | "user")}
                              title="تغيير الصلاحية"
                              className={`cursor-pointer rounded-lg border px-2 py-1.5 text-[10px] font-bold outline-none transition ${u.role === "admin" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-blue-200 bg-blue-50 text-blue-600"}`}>
                              <option value="admin">🛡️ Admin</option>
                              <option value="user">👤 وكيلة</option>
                            </select>
                          ) : (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${u.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-blue-50 text-blue-600"}`}>
                              {u.role === "admin" ? "🛡️ Admin" : "👤 وكيلة"} 🔒
                            </span>
                          )}
                        </td>
                        {/* password */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <input dir="ltr" type={visible ? "text" : "password"} value={u.password}
                              onChange={(e) => updateUser(u.id, { password: e.target.value })}
                              className={`min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1.5 font-mono text-xs outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-100 ${
                                visible ? "text-slate-800" : "text-slate-500 tracking-widest"
                              }`} />
                            <button type="button" onClick={() => setShowPw((p) => ({ ...p, [u.id]: !p[u.id] }))}
                              title={visible ? "إخفاء" : "إظهار"}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                              {visible ? "🙈" : "👁️"}
                            </button>
                          </div>
                        </td>
                        {/* delete */}
                        <td className="px-3 py-2.5 text-center">
                          {canDelete(u.id) ? (
                            <button onClick={() => confirm(`مسح المستخدم "${u.username}"؟`) && removeUser(u.id)} title="مسح المستخدم"
                              className="grid h-7 w-7 place-items-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 group-hover:text-red-400">✕</button>
                          ) : (
                            <span className="text-[10px] text-slate-300" title={u.id === currentUser?.id ? "راسك ما يمكنش تمسحو" : "آخر أدمين — ما يمكنش يمسح"}>🔒</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!users.length && (
                <div className="p-10 text-center">
                  <div className="mb-2 text-3xl">👤</div>
                  <p className="text-sm text-slate-400">ما كاين حتى مستخدم — زيد الأول من الفورم</p>
                </div>
              )}
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">
            💡 الوكيلة ملي كتدخل كتشوف غير الصفحة ديالها (الطلبيات ديال البنت المربوطة) · الأدمين كيشوف كلشي
          </p>
        </div>
      </div>
    </div>
  );
}
