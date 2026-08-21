import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { startSession, closeSession, cleanupStaleSessions } from "./data/worktimes";

export type AppUser = {
  id: number;
  username: string;
  password: string;
  role: "admin" | "user";
  agent: string;
};

const USERS_KEY = "afrizon_users_v1";
const SESSION_KEY = "afrizon_session_v1";
const DEFAULT_USERS: AppUser[] = [
  { id: 1, username: "admin@paraveda.ma", password: "admin123", role: "admin", agent: "" },
];

type AuthContextValue = {
  users: AppUser[];
  currentUser: AppUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (username: string, password: string, agent: string, role?: "admin" | "user") => boolean;
  updateUser: (id: number, patch: Partial<AppUser>) => boolean;
  removeUser: (id: number) => void;
  changeAdminPassword: (password: string) => boolean;
};

const AuthContext = createContext<AuthContextValue>(null as unknown as AuthContextValue);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppUser[];
        // Keep previously changed passwords while migrating the old admin username.
        return parsed.map((user) => user.role === "admin" && user.username === "admin"
          ? { ...user, username: "admin@paraveda.ma" }
          : user);
      }
    } catch { /* ignore invalid storage */ }
    return DEFAULT_USERS;
  });
  const [sessionId, setSessionId] = useState<number | null>(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? Number(saved) : null;
  });

  useEffect(() => localStorage.setItem(USERS_KEY, JSON.stringify(users)), [users]);
  useEffect(() => {
    if (sessionId === null) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, String(sessionId));
  }, [sessionId]);

  // ⏱ Work Times — fermer les sessions fantômes au démarrage
  useEffect(() => { cleanupStaleSessions(); }, []);

  const currentUser = users.find((u) => u.id === sessionId) || null;

  const value = useMemo<AuthContextValue>(() => ({
    users,
    currentUser,
    login: (username, password) => {
      const entered = username.trim().toLowerCase();
      const user = users.find((u) => {
        const isAdminAlias = u.role === "admin" && (entered === "admin" || entered === "admin@paraveda.ma");
        return (u.username.toLowerCase() === entered || isAdminAlias) && u.password === password;
      });
      if (!user) return false;
      setSessionId(user.id);
      startSession(user.username, user.agent || ""); // ⏱ Work Times — entrée
      return true;
    },
    logout: () => {
      if (currentUser) closeSession(currentUser.username); // ⏱ Work Times — sortie
      setSessionId(null);
    },
    addUser: (username, password, agent, role = "user") => {
      const clean = username.trim();
      if (!clean || !password || (role === "user" && !agent) || users.some((u) => u.username.toLowerCase() === clean.toLowerCase())) return false;
      setUsers((p) => [...p, { id: Math.max(0, ...p.map((u) => u.id)) + 1, username: clean, password, role, agent: role === "admin" ? "" : agent }]);
      return true;
    },
    updateUser: (id, patch) => {
      if (patch.username && users.some((u) => u.id !== id && u.username.toLowerCase() === patch.username!.trim().toLowerCase())) return false;
      setUsers((p) => p.map((u) => u.id === id ? { ...u, ...patch, username: patch.username?.trim() || u.username } : u));
      return true;
    },
    removeUser: (id) => {
      const target = users.find((u) => u.id === id);
      if (!target) return;
      // حمايات الأدمين: ما يمكنش تمسح راسك ولا آخر أدمين
      if (target.role === "admin") {
        if (target.id === sessionId) return;
        if (users.filter((u) => u.role === "admin").length <= 1) return;
      }
      setUsers((p) => p.filter((u) => u.id !== id));
      if (sessionId === id) setSessionId(null);
    },
    changeAdminPassword: (password) => {
      if (password.length < 6 || !currentUser || currentUser.role !== "admin") return false;
      setUsers((p) => p.map((u) => u.id === currentUser.id ? { ...u, password } : u));
      return true;
    },
  }), [users, currentUser, sessionId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);