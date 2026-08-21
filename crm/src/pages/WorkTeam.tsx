import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { usePeriod } from "../period";
import { useSessions, STALE_MS } from "../data/worktimes";
import type { Order } from "../data/orders";

const nf = (n: number) => n.toLocaleString("fr-FR");
const PHOTOS_KEY = "afrizon_team_photos_v1";

/* آخر ظهور مقروء */
const fmtSeen = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date().toISOString().slice(0, 10);
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return iso.slice(0, 10) === today ? `اليوم ${hm}` : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${hm}`;
};

/** Redimensionne l'image en carré 320px et renvoie un dataURL léger. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read error"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image error"));
      img.onload = () => {
        const S = 320;
        const canvas = document.createElement("canvas");
        canvas.width = S; canvas.height = S;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas error"));
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/* Palette pastel par carte (comme le design) */
const THEMES = [
  { ring: "#a78bfa", soft: "#ede9fe", chip: "#ddd6fe", chipText: "#6d28d9", blob: "#c4b5fd" },
  { ring: "#34d399", soft: "#d1fae5", chip: "#a7f3d0", chipText: "#047857", blob: "#6ee7b7" },
  { ring: "#60a5fa", soft: "#dbeafe", chip: "#bfdbfe", chipText: "#1d4ed8", blob: "#93c5fd" },
  { ring: "#f472b6", soft: "#fce7f3", chip: "#fbcfe8", chipText: "#be185d", blob: "#f9a8d4" },
  { ring: "#fb923c", soft: "#ffedd5", chip: "#fed7aa", chipText: "#c2410c", blob: "#fdba74" },
  { ring: "#22d3ee", soft: "#cffafe", chip: "#a5f3fc", chipText: "#0e7490", blob: "#67e8f9" },
  { ring: "#c084fc", soft: "#f3e8ff", chip: "#e9d5ff", chipText: "#7e22ce", blob: "#d8b4fe" },
  { ring: "#facc15", soft: "#fef9c3", chip: "#fef08a", chipText: "#a16207", blob: "#fde047" },
];

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || name.slice(0, 2).toUpperCase();
}

export default function WorkTeam({ onOpen, onRanking, onLive }: { onOpen: (agent: string) => void; onRanking?: () => void; onLive?: () => void }) {
  const { orders, agentNames, addAgent, renameAgent, removeAgent } = useStore();
  const { inRange, label } = usePeriod();
  const sessions = useSessions();
  const [q, setQ] = useState("");

  // Photos de profil (stockées localement)
  const [photos, setPhotos] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(PHOTOS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return {};
  });
  useEffect(() => {
    try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)); }
    catch { alert("Espace de stockage plein — impossible d'enregistrer la photo."); }
  }, [photos]);

  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string>("");

  const pickPhoto = (name: string) => { targetRef.current = name; fileRef.current?.click(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Choisissez une image.");
    try {
      const dataUrl = await compressImage(file);
      setPhotos((p) => ({ ...p, [targetRef.current]: dataUrl }));
    } catch { alert("Impossible de charger cette image."); }
  };

  const removePhoto = (name: string) => setPhotos((p) => { const c = { ...p }; delete c[name]; return c; });

  const team = useMemo(() => agentNames.map((name, i) => {
    const list = orders.filter((o: Order) => o.agent.toLowerCase() === name.toLowerCase() && inRange(o.dateCreation));
    const confirmations = list.filter((o) => o.statut === "Confirmé").length;
    const livree = list.filter((o) => o.livraison === "Livrée").length;
    const retour = list.filter((o) => o.livraison === "Retour").length;
    const ca = list.filter((o) => o.livraison === "Livrée").reduce((s, o) => s + o.prix, 0);
    const reussite = livree + retour > 0 ? Math.round((livree / (livree + retour)) * 100) : 0;
    // ✅ حضور حقيقي: جلسة مفتوحة + آخر ظهور (من Work Times)
    const low = name.toLowerCase();
    const mySess = sessions.filter((s) => s.agent.toLowerCase() === low || s.user.toLowerCase() === low);
    const lastSeen = mySess.reduce((m, s) => (s.lastSeen > m ? s.lastSeen : m), "");
    const online = mySess.some((s) => !s.end && Date.now() - new Date(s.lastSeen).getTime() < STALE_MS);
    return { name, theme: THEMES[i % THEMES.length], total: list.length, confirmations, livree, retour, ca, reussite, online, lastSeen };
  }), [orders, agentNames, inRange, sessions]);

  const shown = team.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  const totals = useMemo(() => ({
    members: team.length,
    confirmations: team.reduce((s, m) => s + m.confirmations, 0),
    moyenne: team.length ? Math.round(team.reduce((s, m) => s + m.reussite, 0) / team.length) : 0,
    online: team.filter((m) => m.online).length,
    offline: team.filter((m) => !m.online).length,
    ca: team.reduce((s, m) => s + m.ca, 0),
  }), [team]);

  const addGirl = () => {
    const name = prompt("اسم البنت الجديدة:");
    if (!name) return;
    if (!addAgent(name)) alert("الاسم موجود أو غير صالح");
  };

  return (
    <div dir="ltr" className="flex h-full flex-col bg-slate-50">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-2xl">👥</div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Notre équipe</h1>
            <p className="text-sm text-slate-500">Gérez votre équipe · <span className="font-bold text-orange-600">⏱ {label}</span></p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-slate-400">🔎</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher..." className="w-40 bg-transparent text-sm outline-none" />
            </div>
            {onLive && (
              <button onClick={onLive} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-200 transition hover:bg-red-600 active:scale-[0.98]">
                <i className="h-2 w-2 animate-pulse rounded-full bg-white" /> Live Activity
              </button>
            )}
            {onRanking && (
              <button onClick={onRanking} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600 active:scale-[0.98]">
                🏆 Ranking
              </button>
            )}
            <button onClick={addGirl} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98]">
              <span className="text-lg leading-none">＋</span> Ajouter une fille
            </button>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((m) => (
            <div key={m.name}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              {/* status — حضور حقيقي */}
              <span className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium shadow-sm backdrop-blur"
                title={m.online ? "داخلة فـ CRM دابا" : (m.lastSeen ? `آخر ظهور: ${fmtSeen(m.lastSeen)}` : "ما دخلات حتى مرة")}>
                <i className={`h-2 w-2 rounded-full ${m.online ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
                <span className={m.online ? "font-bold text-emerald-700" : "text-slate-500"}>{m.online ? "En ligne" : "Hors ligne"}</span>
              </span>

              {/* avatar area */}
              <div onClick={() => onOpen(m.name)} className="relative cursor-pointer px-6 pb-4 pt-8" style={{ background: `linear-gradient(180deg, ${m.theme.soft} 0%, #ffffff 100%)` }}>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60"
                  style={{ background: `radial-gradient(120px 60px at 30% 20%, ${m.theme.blob}, transparent 70%)` }} />
                <div className="group/av relative mx-auto h-24 w-24">
                  <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full text-2xl font-extrabold text-white shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${m.theme.ring}, ${m.theme.blob})`, boxShadow: `0 0 0 4px #fff, 0 0 0 7px ${m.theme.soft}` }}>
                    {photos[m.name]
                      ? <img src={photos[m.name]} alt={m.name} className="h-full w-full object-cover" draggable={false} />
                      : initials(m.name)}
                  </div>
                  {/* overlay photo */}
                  <div onClick={(e) => { e.stopPropagation(); pickPhoto(m.name); }}
                    className="absolute inset-0 grid cursor-pointer place-items-center rounded-full bg-black/45 text-white opacity-0 transition group-hover/av:opacity-100"
                    title="Changer la photo">
                    <span className="text-xl">📷</span>
                  </div>
                  {photos[m.name] && (
                    <button onClick={(e) => { e.stopPropagation(); removePhoto(m.name); }} title="Supprimer la photo"
                      className="absolute -right-1 -top-1 hidden h-6 w-6 place-items-center rounded-full bg-white text-xs text-red-600 shadow ring-1 ring-slate-200 group-hover/av:grid">✕</button>
                  )}
                </div>
                <h3 className="mt-4 text-center text-lg font-extrabold text-slate-900 transition group-hover:text-indigo-700">{m.name}</h3>
                <div className="mt-1.5 flex justify-center">
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: m.theme.chip, color: m.theme.chipText }}>Confirmatrice</span>
                </div>
              </div>

              {/* stats */}
              <div onClick={() => onOpen(m.name)} className="grid cursor-pointer grid-cols-2 border-y border-slate-100">
                <div className="border-r border-slate-100 py-3 text-center">
                  <div className="text-lg font-extrabold text-slate-900">{nf(m.confirmations)}</div>
                  <div className="text-[11px] text-slate-500">Confirmations</div>
                </div>
                <div className="py-3 text-center">
                  <div className="text-lg font-extrabold text-slate-900">{m.reussite}%</div>
                  <div className="text-[11px] text-slate-500">Réussite</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-slate-100 text-center text-[11px]">
                <div className="bg-white py-2"><b className="block text-emerald-600">{nf(m.livree)}</b><span className="text-slate-400">Livrées</span></div>
                <div className="bg-white py-2"><b className="block text-red-500">{nf(m.retour)}</b><span className="text-slate-400">Retour</span></div>
                <div className="bg-white py-2"><b className="block text-teal-600">{nf(m.ca)}</b><span className="text-slate-400">CA DH</span></div>
              </div>

              {/* actions */}
              <div className="flex gap-2 p-3">
                <button onClick={() => onOpen(m.name)} title="Ouvrir ses commandes"
                  className="flex-1 rounded-xl py-2 text-sm font-bold transition hover:brightness-95"
                  style={{ background: m.theme.chip, color: m.theme.chipText }}>Commandes</button>
                <button onClick={() => pickPhoto(m.name)} title="Photo de profil"
                  className="grid w-11 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200">📷</button>
                <button onClick={() => {
                  const n = prompt("Nouveau nom:", m.name);
                  if (!n || n === m.name) return;
                  if (!renameAgent(m.name, n)) return alert("Nom déjà utilisé");
                  setPhotos((p) => { if (!p[m.name]) return p; const c = { ...p }; c[n.trim()] = c[m.name]; delete c[m.name]; return c; });
                }} title="Renommer" className="grid w-11 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200">✏️</button>
                <button onClick={() => { if (!confirm(`Supprimer ${m.name} ? Ses commandes seront conservées sans agent.`)) return; removeAgent(m.name); removePhoto(m.name); }}
                  title="Supprimer" className="grid w-11 place-items-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100">🗑️</button>
              </div>
            </div>
          ))}

          {/* Add card */}
          <button onClick={addGirl}
            className="grid min-h-[300px] place-items-center rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
            <div>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-2xl text-indigo-600">＋</div>
              <p className="mt-3 text-sm font-semibold text-indigo-700">Ajouter<br />une nouvelle fille</p>
            </div>
          </button>
        </div>

        {!shown.length && q && <p className="py-10 text-center text-slate-400">Aucun membre trouvé</p>}
      </div>

      {/* Footer summary */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <span className="flex items-center gap-2"><span className="text-indigo-500">👥</span><b className="text-slate-900">{totals.members}</b><span className="text-slate-500">Membres</span></span>
          <span className="flex items-center gap-2"><span className="text-blue-500">📋</span><b className="text-slate-900">{nf(totals.confirmations)}</b><span className="text-slate-500">Total confirmations</span></span>
          <span className="flex items-center gap-2"><span className="text-emerald-500">📈</span><b className="text-slate-900">{totals.moyenne}%</b><span className="text-slate-500">Taux moyen</span></span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-500" /><b className="text-slate-900">{totals.online}</b><span className="text-slate-500">En ligne</span></span>
          <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-amber-500" /><b className="text-slate-900">{totals.offline}</b><span className="text-slate-500">Absente</span></span>
          <span className="ml-auto flex items-center gap-2"><span className="text-teal-500">💰</span><b className="text-slate-900">{nf(totals.ca)} DH</b><span className="text-slate-500">CA total</span></span>
        </div>
      </div>
    </div>
  );
}
