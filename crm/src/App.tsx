import { useState, useEffect, useRef } from "react";
import { StoreProvider, useStore } from "./store";
import { AuthProvider, useAuth } from "./auth";
import Sheet from "./pages/Sheet";
import Grid from "./pages/Grid";
import { Produits, BlankSheet } from "./pages/Tabs";
import { SuiviConfirmationView } from "./pages/Dashboards";
import AgentOrders from "./pages/AgentOrders";
import Login from "./pages/Login";
import UsersAdmin from "./pages/UsersAdmin";
import Historique from "./pages/Historique";
import WorkTeam from "./pages/WorkTeam";
import Ranking from "./pages/Ranking";
import LiveActivity from "./pages/LiveActivity";
import Heatmap from "./pages/Heatmap";
import Villes from "./pages/Villes";
import WorkTimes from "./pages/WorkTimes";
import ChatWidget from "./components/ChatWidget";
import CrmAds from "./pages/CrmAds";
import Salaire from "./pages/Salaire";
import PerfSources from "./pages/PerfSources";
import Statistique from "./pages/Statistique";
import WelcomeOverlay from "./components/WelcomeOverlay";
import LogoutIcon from "./components/LogoutIcon";
import { cloudPush } from "./data/cloud";
import { PeriodProvider, PeriodBar } from "./period";
import { SHEETS, type SheetData } from "./data/sheets";
import { touchSession } from "./data/worktimes";

const CUSTOM_VIEWS = ["suivi confirmation"];

const DEFAULT_TABS = [
  "COMONDES", "Dashboard performance", "LES RENV", "PRODUITS", "LES OBJECTIFS",
  "suivi confirmation", "pièce", "RECLAMATION",
  "statistique", "suivi rentabilité", "Sheet129", "Les villes", "Work Times",
];
const LOCKED = ["Dashboard performance", "LES RENV", "LES OBJECTIFS", "suivi confirmation", "RECLAMATION", "suivi rentabilité", "Work Times"];
const FIXED = ["COMONDES", "PRODUITS", "Work Team", "Les villes", "Work Times"]; // pages avec composant spécial (non supprimables)

/* Icône de chaque onglet */
const TAB_ICONS: Record<string, string> = {
  "COMONDES": "📋",
  "Dashboard performance": "📊",
  "LES RENV": "📈",
  "PRODUITS": "📦",
  "LES OBJECTIFS": "🎯",
  "suivi confirmation": "✅",
  "pièce": "🧩",
  "RECLAMATION": "📣",
  "statistique": "📉",
  "suivi rentabilité": "💰",
  "Sheet129": "📄",
  "Les villes": "🏙️",
  "Work Times": "⏰",
};

/* لون كل تبويب (نفس عائلة ألوان الشريط السفلي) */
const TAB_COLORS: Record<string, string> = {
  "COMONDES": "blue", "Dashboard performance": "indigo", "LES RENV": "violet",
  "PRODUITS": "teal", "LES OBJECTIFS": "amber", "suivi confirmation": "emerald",
  "pièce": "slate", "RECLAMATION": "red", "statistique": "orange",
  "suivi rentabilité": "blue", "Sheet129": "slate", "Les villes": "teal", "Work Times": "amber",
};

const TABS_KEY = "tabs_list_v1";
const CUSTOM_KEY = "custom_sheets_v1";

/* ── Barre d'outils (bas de page) : boutons pro ── */
const TOOL_COLORS: Record<string, { base: string; on: string }> = {
  emerald: {
    base: "border-emerald-500 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-sm shadow-emerald-200/60 hover:from-emerald-500 hover:to-emerald-700 hover:shadow",
    on: "border-emerald-700 bg-gradient-to-b from-emerald-600 to-emerald-800 text-white shadow-md ring-2 ring-emerald-300/70",
  },
  blue: {
    base: "border-blue-500 bg-gradient-to-b from-blue-400 to-blue-600 text-white shadow-sm shadow-blue-200/60 hover:from-blue-500 hover:to-blue-700 hover:shadow",
    on: "border-blue-700 bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-md ring-2 ring-blue-300/70",
  },
  indigo: {
    base: "border-indigo-500 bg-gradient-to-b from-indigo-400 to-indigo-600 text-white shadow-sm shadow-indigo-200/60 hover:from-indigo-500 hover:to-indigo-700 hover:shadow",
    on: "border-indigo-700 bg-gradient-to-b from-indigo-600 to-indigo-800 text-white shadow-md ring-2 ring-indigo-300/70",
  },
  amber: {
    base: "border-amber-500 bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-200/60 hover:from-amber-500 hover:to-amber-600 hover:shadow",
    on: "border-amber-600 bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-md ring-2 ring-amber-300/70",
  },
  red: {
    base: "border-red-500 bg-gradient-to-b from-red-400 to-red-600 text-white shadow-sm shadow-red-200/60 hover:from-red-500 hover:to-red-700 hover:shadow",
    on: "border-red-700 bg-gradient-to-b from-red-600 to-red-800 text-white shadow-md ring-2 ring-red-300/70",
  },
  orange: {
    base: "border-orange-500 bg-gradient-to-b from-orange-400 to-orange-600 text-white shadow-sm shadow-orange-200/60 hover:from-orange-500 hover:to-orange-700 hover:shadow",
    on: "border-orange-700 bg-gradient-to-b from-orange-600 to-orange-800 text-white shadow-md ring-2 ring-orange-300/70",
  },
  violet: {
    base: "border-violet-500 bg-gradient-to-b from-violet-400 to-violet-600 text-white shadow-sm shadow-violet-200/60 hover:from-violet-500 hover:to-violet-700 hover:shadow",
    on: "border-violet-700 bg-gradient-to-b from-violet-600 to-violet-800 text-white shadow-md ring-2 ring-violet-300/70",
  },
  slate: {
    base: "border-slate-400 bg-gradient-to-b from-slate-400 to-slate-600 text-white shadow-sm hover:from-slate-500 hover:to-slate-700 hover:shadow",
    on: "border-slate-700 bg-gradient-to-b from-slate-600 to-slate-800 text-white shadow-md ring-2 ring-slate-300/70",
  },
};

function ToolBtn({ color, on = false, onClick, title, children }: {
  color: keyof typeof TOOL_COLORS; on?: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  const c = TOOL_COLORS[color] ?? TOOL_COLORS.slate;
  return (
    <button onClick={onClick} title={title}
      className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-[7px] text-[11px] font-bold transition-all duration-150 active:scale-[0.96] ${on ? c.on : c.base}`}>
      {children}
    </button>
  );
}

const Sep = () => <div className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;

function Workspace() {
  const { agentNames, addAgent, renameAgent, removeAgent } = useStore();
  const { currentUser, logout, users, updateUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [tabs, setTabs] = useState<string[]>(() => {
    try { const s = localStorage.getItem(TABS_KEY); if (s) return JSON.parse(s); } catch { /* */ }
    return DEFAULT_TABS;
  });
  // custom (added) sheets data
  const [custom, setCustom] = useState<Record<string, SheetData>>(() => {
    try { const s = localStorage.getItem(CUSTOM_KEY); if (s) return JSON.parse(s); } catch { /* */ }
    return {};
  });
  const [tab, setTab] = useState("COMONDES");

  /* 🌸 رسالة الترحيب عند الدخول */
  const [welcome, setWelcome] = useState<{ name: string; isAdmin: boolean } | null>(null);
  const prevUserRef = useRef<string | null>(null);
  useEffect(() => {
    const cur = currentUser?.username || null;
    if (cur && prevUserRef.current !== cur) {
      setWelcome({
        name: currentUser!.role === "admin" ? (currentUser!.username.split("@")[0] || "Admin") : (currentUser!.agent || currentUser!.username),
        isAdmin: currentUser!.role === "admin",
      });
      const t = setTimeout(() => setWelcome(null), 3400);
      prevUserRef.current = cur;
      return () => clearTimeout(t);
    }
    prevUserRef.current = cur;
  }, [currentUser]);

  useEffect(() => {
    if (!isAdmin && currentUser?.agent) setTab(currentUser.agent);
  }, [isAdmin, currentUser]);

  useEffect(() => { localStorage.setItem(TABS_KEY, JSON.stringify(tabs)); cloudPush(TABS_KEY); }, [tabs]);
  useEffect(() => { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); cloudPush(CUSTOM_KEY); }, [custom]);

  // Les pages des filles et "Work Team" ne s'affichent plus dans la barre du bas
  // (elles restent accessibles via le bouton 👥 Work Team).
  useEffect(() => {
    setTabs((current) => {
      const hidden = new Set(["Imane", "SANAE", "Work Team", ...agentNames]);
      const cleaned = current.filter((t) => !hidden.has(t));
      return cleaned.length === current.length ? current : cleaned;
    });
  }, [agentNames]);

  // Migration : garantir la présence de l'onglet "Les villes" (sauvegardes anciennes)
  useEffect(() => {
    setTabs((current) => (current.includes("Les villes") ? current : [...current, "Les villes"]));
    setTabs((current) => (current.includes("Work Times") ? current : [...current, "Work Times"]));
  }, []);

  // ⏱ Work Times — heartbeat : signal de présence toutes les 60s
  useEffect(() => {
    if (!currentUser) return;
    touchSession(currentUser.username);
    const t = setInterval(() => touchSession(currentUser.username), 60_000);
    return () => clearInterval(t);
  }, [currentUser]);

  const addAgentPage = () => {
    const name = prompt("اسم البنت الجديدة:");
    if (!name) return;
    if (!addAgent(name)) { alert("الاسم موجود أو غير صالح"); return; }
    setTab("Work Team");
  };

  const addTab = () => {
    const name = prompt("اسم الصفحة الجديدة:");
    if (!name || tabs.includes(name)) { if (name) alert("الاسم موجود بالفعل"); return; }
    setTabs((p) => [...p, name]);
    setCustom((p) => ({ ...p, [name]: { headers: ["A", "B", "C", "D", "E", "F"], rows: [Array(6).fill("")] } }));
    setTab(name);
  };

  const delTab = (name: string) => {
    if (FIXED.includes(name)) { alert("هاد الصفحة ما يمكنش تمسح"); return; }
    if (agentNames.includes(name)) {
      if (!confirm(`مسح البنت "${name}" والصفحة ديالها؟ الطلبيات ديالها غاتبقى محفوظة ولكن بلا وكيلة.`)) return;
      users.filter((u) => u.role === "user" && u.agent === name).forEach((u) => updateUser(u.id, { agent: "" }));
      removeAgent(name);
      setTabs((p) => p.filter((t) => t !== name));
      if (tab === name) setTab("COMONDES");
      return;
    }
    if (!confirm(`مسح الصفحة "${name}"؟`)) return;
    setTabs((p) => p.filter((t) => t !== name));
    setCustom((p) => { const c = { ...p }; delete c[name]; return c; });
    localStorage.removeItem(`sheet_${name}`);
    if (tab === name) setTab("COMONDES");
  };

  const renameTab = (name: string) => {
    const nn = prompt("الاسم الجديد:", name);
    if (!nn || nn === name || tabs.includes(nn)) return;
    if (agentNames.includes(name) && !renameAgent(name, nn)) {
      alert("الاسم موجود أو غير صالح");
      return;
    }
    if (agentNames.includes(name)) {
      users.filter((u) => u.role === "user" && u.agent === name).forEach((u) => updateUser(u.id, { agent: nn.trim() }));
    }
    setTabs((p) => p.map((t) => t === name ? nn : t));
    if (custom[name]) setCustom((p) => { const c = { ...p }; c[nn] = c[name]; delete c[name]; return c; });
    if (tab === name) setTab(nn);
  };

  const sheetData = SHEETS[tab] || custom[tab];

  if (!currentUser) return <Login />;

  /* 🌸 الترحيب (Portal — فوق كلشي) */
  const welcomeOverlay = welcome ? <WelcomeOverlay name={welcome.name} isAdmin={welcome.isAdmin} /> : null;

  /* ── Petits composants UI ── */
  const Brand = () => (
    <div className="flex shrink-0 items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-base text-white shadow-md shadow-indigo-200">📊</div>
      <div className="leading-tight">
        <div className="text-sm font-extrabold tracking-tight text-slate-800">Paraveda</div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">CRM · Call Center</div>
      </div>
    </div>
  );

  const UserChip = () => (
    <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pe-1 ps-2 shadow-sm">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">
        {(currentUser.username || "?").charAt(0).toUpperCase()}
      </span>
      <span className="hidden max-w-[140px] truncate text-[11px] font-semibold text-slate-600 sm:block">{currentUser.username}</span>
      {isAdmin && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-600">Admin</span>}
      <button onClick={logout} title="خروج — تسجيل الخروج" className="grid h-6 w-6 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 hover:scale-110">
        <LogoutIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="flex h-dvh flex-col bg-white">
        <div className="shrink-0 border-b border-slate-200 bg-white shadow-sm">
          <div dir="rtl" className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
            <Brand />
            <div className="h-6 w-px bg-slate-200" />
            <b className="text-xs text-slate-700">{currentUser.username} · {currentUser.agent}</b>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:ms-auto sm:flex-nowrap">
              <PeriodBar compact />
              <UserChip />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden"><AgentOrders agent={currentUser.agent} /></div>
        <ChatWidget />
        {welcomeOverlay}
      </div>
    );
  }

  return (
      <div className="flex h-dvh flex-col bg-slate-100">
        {/* ═══ Barre supérieure professionnelle ═══ */}
        <header className="shrink-0 border-b border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <div className="flex items-center gap-3 px-4 pt-2.5">
            {/* Logo + marque */}
            <Brand />

            {/* Séparateur + page courante */}
            <div className="hidden h-6 w-px bg-slate-200 md:block" />
            <div className="hidden min-w-0 items-center gap-1.5 text-[11px] md:flex" dir="ltr">
              <span className="text-slate-300">/</span>
              <span className="truncate font-bold text-slate-700">{TAB_ICONS[tab] || (agentNames.includes(tab) ? "👤" : "📑")} {tab}</span>
            </div>

            {/* Filtre temporel + utilisateur */}
            <div className="ms-auto flex items-center gap-3">
              <div dir="rtl" className="flex shrink-0 items-center gap-2">
                <PeriodBar />
              </div>
              <UserChip />
            </div>
          </div>

          {/* ── Onglets — احترافيين متدرجين ── */}
          <nav dir="ltr" className="relative mt-1">
            <div
              className="flex items-center gap-1 overflow-x-auto px-3 pb-2 pt-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {tabs.map((t) => {
                const on = tab === t;
                const locked = LOCKED.includes(t);
                const icon = TAB_ICONS[t] || (agentNames.includes(t) ? "👤" : "📑");
                const color = (TAB_COLORS[t] || (agentNames.includes(t) ? "violet" : "slate")) as keyof typeof TOOL_COLORS;
                const c = TOOL_COLORS[color] ?? TOOL_COLORS.slate;
                return (
                  <div
                    key={t}
                    onClick={() => setTab(t)}
                    onDoubleClick={() => renameTab(t)}
                    title="نقرة مزدوجة لإعادة التسمية"
                    className={`group relative flex h-8 shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-[11px] font-bold text-white transition-all duration-150 active:scale-[0.96] ${on ? `${c.on}` : `${c.base}`}`}
                  >
                    <span className="text-[12px] leading-none">{icon}</span>
                    <span>{t}</span>
                    {locked && <span className="text-[9px] opacity-80" title="مقفولة">🔒</span>}
                    {!FIXED.includes(t) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); delTab(t); }}
                        className="ml-0.5 hidden h-4 w-4 place-items-center rounded-full bg-black/20 text-[9px] font-bold text-white transition hover:bg-black/40 group-hover:grid"
                        title="مسح"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          </nav>
        </header>

        <div className="flex-1 overflow-hidden">
          {tab === "COMONDES" && <Sheet />}
          {tab === "PRODUITS" && <div className="h-full overflow-auto"><Produits /></div>}
          {tab === "Les villes" && <div className="h-full overflow-auto"><Villes /></div>}
          {tab === "Work Times" && <div className="h-full overflow-auto"><WorkTimes /></div>}
          {tab === "Sheet129" && <div className="h-full overflow-auto"><BlankSheet name="Sheet129" /></div>}
          {tab === "suivi confirmation" && <SuiviConfirmationView />}
          {tab === "Dashboard performance" && <PerfSources />}
          {tab === "statistique" && <Statistique />}
          {tab === "إدارة المستخدمين" && <UsersAdmin />}
          {tab === "CRM Ads" && <div className="h-full overflow-auto"><CrmAds /></div>}
          {tab === "Salaire" && <div className="h-full overflow-auto"><Salaire /></div>}
          {tab === "Historique" && <Historique />}
          {tab === "Work Team" && <WorkTeam onOpen={(name) => setTab(name)} onRanking={() => setTab("Ranking")} onLive={() => setTab("Live Activity")} />}
          {tab === "Ranking" && <Ranking />}
          {tab === "Live Activity" && <LiveActivity />}
          {tab === "Heatmap" && <Heatmap />}
          {agentNames.includes(tab) && (
            <div className="flex h-full flex-col">
              <div dir="ltr" className="flex shrink-0 items-center gap-2 border-b border-indigo-100 bg-indigo-50 px-3 py-1.5">
                <button onClick={() => setTab("Work Team")} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-100">
                  ← 👥 Work Team
                </button>
                <span className="text-xs text-indigo-900/70">Page de <b>{tab}</b></span>
              </div>
              <div className="flex-1 overflow-hidden"><AgentOrders agent={tab} /></div>
            </div>
          )}
          {tab !== "Dashboard performance" && tab !== "statistique" && !CUSTOM_VIEWS.includes(tab) && !agentNames.includes(tab) && sheetData && <Grid name={tab} data={sheetData} />}
        </div>

        {/* ═══ Barre inférieure : barre d'outils professionnelle ═══ */}
        <footer dir="ltr" className="flex shrink-0 items-center gap-1 overflow-x-auto border-t border-slate-200 bg-white px-3 py-2 shadow-[0_-2px_8px_rgba(15,23,42,0.05)]" style={{ scrollbarWidth: "thin" }}>
          {/* ── Création ── */}
          <span className="mr-1 hidden shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:block">Créer</span>
          <ToolBtn color="emerald" onClick={addTab} title="إضافة صفحة">＋ صفحة</ToolBtn>
          <ToolBtn color="blue" onClick={addAgentPage} title="إضافة بنت وصفحتها المربوطة">👤＋ بنت</ToolBtn>

          <Sep />

          {/* ── Équipe ── */}
          <span className="mr-1 hidden shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:block">Équipe</span>
          <ToolBtn color="indigo" on={tab === "Work Team"} onClick={() => setTab("Work Team")} title="Notre équipe">👥 Work Team</ToolBtn>
          <ToolBtn color="amber" on={tab === "Ranking"} onClick={() => setTab("Ranking")} title="Classement des filles (Admin)">🏆 Ranking</ToolBtn>
          <ToolBtn color="red" on={tab === "Live Activity"} onClick={() => setTab("Live Activity")} title="نشاط الفريق مباشر (Admin)">
            <i className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${tab === "Live Activity" ? "bg-white" : "bg-red-500"}`} /> Live Activity
          </ToolBtn>
          <ToolBtn color="orange" on={tab === "Heatmap"} onClick={() => setTab("Heatmap")} title="ساعات العمل والأداء (Admin)">🔥 Heatmap</ToolBtn>

          <Sep />

          {/* ── Gestion ── */}
          <span className="mr-1 hidden shrink-0 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:block">Gestion</span>
          <ToolBtn color="violet" on={tab === "CRM Ads"} onClick={() => setTab("CRM Ads")} title="تكاليف الإعلانات والكوست لكل طلبية">💸 CRM</ToolBtn>
          <ToolBtn color="emerald" on={tab === "Salaire"} onClick={() => setTab("Salaire")} title="سالير البنات — محسوب أوتوماتيك">💵 Salaire</ToolBtn>
          <ToolBtn color="violet" on={tab === "إدارة المستخدمين"} onClick={() => setTab("إدارة المستخدمين")} title="إدارة المستخدمين">🔐 Users</ToolBtn>
          <ToolBtn color="slate" on={tab === "Historique"} onClick={() => setTab("Historique")} title="سجل التعديلات">🕘 Historique</ToolBtn>

          {/* ── Déconnexion ── */}
          <button onClick={logout} title="تسجيل الخروج"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-red-300 bg-white text-red-600 shadow-sm transition-all duration-150 hover:border-red-400 hover:bg-red-50 hover:shadow hover:scale-105 active:scale-[0.94]">
            <LogoutIcon className="h-4.5 w-4.5" />
          </button>
          <span className="shrink-0 px-1 text-[9px] font-bold text-slate-300" title="نسخة التطبيق">v2.0</span>
        </footer>

        {/* 💬 Chat interne Admin ⇄ Filles */}
        <ChatWidget />
        {welcomeOverlay}
      </div>
  );
}

export default function App() {
  return <AuthProvider><StoreProvider><PeriodProvider><Workspace /></PeriodProvider></StoreProvider></AuthProvider>;
}
