import ResourcePage from "./pages/ResourcePage";
import Finance from "./pages/Finance";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Receipt,
  Wallet,
  ChartNoAxesCombined,
  Database,
  History,
  UserCog,
  HandCoins,
} from "lucide-react";
import Login from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import StudentsPage from "./pages/Students";
import Brand from "./components/Brand";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
} from "lucide-react";
import type { User } from "@erp/shared";
import { api, setToken } from "./services/api";
const roleLabel = {
  ADMIN: "Administrator",
  FINANCE: "Financat",
  INSTRUCTOR: "Instruktor",
};
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [page, setPage] = useState("dashboard"),
    [dark, setDark] = useState(localStorage.getItem("theme") === "dark"),
    [message, setMessage] = useState("");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const expired = () => {
      setToken(null);
      setUser(null);
      setMessage("Sesioni ka skaduar. Kyçuni përsëri.");
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setToken(null);
      setUser(null);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  if (!user) return <Login message={message} onLogin={setUser} />;
  const navigation = [
    { id: "dashboard", label: "Përmbledhja", icon: LayoutDashboard },
    { id: "students", label: "Nxënësit", icon: Users },
    { id: "courses", label: "Kurset", icon: BookOpen },
    { id: "groups", label: "Grupet", icon: CalendarDays },
    { id: "enrollments", label: "Regjistrimet", icon: ClipboardList },
    ...(user.role !== "INSTRUCTOR"
      ? [
          { id: "invoices", label: "Faturat", icon: Receipt },
          { id: "payments", label: "Pagesat", icon: Wallet },
          { id: "debts", label: "Borxhet", icon: HandCoins },
          { id: "financial", label: "Raportet", icon: ChartNoAxesCombined },
        ]
      : []),
    ...(user.role === "ADMIN"
      ? [
          { id: "users", label: "Përdoruesit", icon: UserCog },
          { id: "audit", label: "Historiku", icon: History },
          { id: "backups", label: "Backup", icon: Database },
        ]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace">HAPËSIRA E SHKOLLËS</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "selected" : ""}
              onClick={() => setPage(item.id)}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="profile">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            <strong>{user.name}</strong>
            <small>{roleLabel[user.role]}</small>
          </div>
          <button title="Çkyçu" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header>
          <div>
            <span className="breadcrumb">
              Shkolla Digjitale <span>/</span> Prizren <span>/</span>
            </span>
            <strong>
              {navigation.find((item) => item.id === page)?.label}
            </strong>
          </div>
          <div className="header-tools">
            <span className="connection">
              <i />
              API qendrore
            </span>
            <button
              className="icon-button"
              aria-label="Ndrysho temën"
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>
        </header>
        <main>
          {message && (
            <div role="alert" className="error">
              {message}
              <button onClick={() => setMessage("")}>×</button>
            </div>
          )}
          {page === "dashboard" ? (
            <DashboardPage
              user={user}
              openStudents={() => setPage("students")}
            />
          ) : page === "students" ? (
            <StudentsPage user={user} />
          ) : ["courses", "groups", "enrollments", "users"].includes(page) ? (
            <ResourcePage key={page} kind={page} user={user} />
          ) : page === "invoices" || page === "payments" ? (
            <Finance key={page} kind={page} user={user} />
          ) : page === "debts" || page === "financial" ? (
            <Reports key={page} kind={page} />
          ) : (
            <Admin key={page} kind={page as "audit" | "backups"} />
          )}
        </main>
        <footer>
          Shkolla Digjitale Prizren <span>Platforma e menaxhimit · ERP</span>
        </footer>
      </div>
    </div>
  );
}
