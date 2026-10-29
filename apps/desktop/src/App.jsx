import PdfWorkspace from "./components/PdfWorkspace";
import QuickAccess from "./components/QuickAccess";
import ResourcePage from "./pages/ResourcePage";
import InvoiceWorkspace from "./pages/InvoiceWorkspace";
import Reports from "./pages/Reports";
import Admin from "./pages/Admin";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Receipt,
  ChartNoAxesCombined,
  Database,
  History,
  UserCog,
  HandCoins,
  Bell,
  ArrowLeft,
} from "lucide-react";
import Login from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import StudentsPage from "./pages/Students";
import Brand from "./components/Brand";
import StudentWorkspace from "./components/StudentWorkspace";
import { useEffect, useState } from "react";
import { LayoutDashboard, Users, LogOut, Moon, Sun } from "lucide-react";
import { api, setToken } from "./services/api";
const roleLabel = {
  ADMIN: "Administrator",
  FINANCE: "Financat",
  INSTRUCTOR: "Instruktor",
};
export default function App() {
  const [user, setUser] = useState(null),
    [routes, setRoutes] = useState([{ page: "dashboard" }]),
    [dark, setDark] = useState(localStorage.getItem("theme") === "dark"),
    [message, setMessage] = useState(""),
    [reminders, setReminders] = useState(null),
    [paymentReminders, setPaymentReminders] = useState(null);
  useEffect(() => {
    setRoutes([{ page: "dashboard" }]);
  }, [user]);
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
  useEffect(() => {
    if (!user || user.role === "INSTRUCTOR") {
      setReminders(null);
      setPaymentReminders(null);
      return;
    }
    const controller = new AbortController();
    const load = () =>
      Promise.allSettled([
        api("/invoice-review/reminders", { signal: controller.signal })
          .then((r) => {
            if (!controller.signal.aborted) setReminders(r);
          })
          .catch(() => {}),
        api("/dashboard/payment-reminders", { signal: controller.signal })
          .then((r) => {
            if (!controller.signal.aborted) setPaymentReminders(r);
          })
          .catch(() => {}),
      ]);
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("billing-updated", load);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("billing-updated", load);
      window.removeEventListener("focus", load);
    };
  }, [user]);
  const route = routes.at(-1);
  const page = route.page;
  function navigate(nextPage, options = {}) {
    setRoutes((previous) => [...previous, { page: nextPage, ...options }]);
  }
  function openReview(period) {
    navigate("invoices", { view: "review", period });
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setToken(null);
      setUser(null);
    } catch (e) {
      setMessage(e.message);
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
    <PdfWorkspace>
      <StudentWorkspace user={user}>
        <div className="app-shell">
          <aside className="sidebar">
            <Brand />
            <div className="workspace">HAPËSIRA E SHKOLLËS</div>
            <nav>
              {(() => {
                const daily =
                  user.role === "INSTRUCTOR"
                    ? [
                        "dashboard",
                        "students",
                        "courses",
                        "groups",
                        "enrollments",
                      ]
                    : ["dashboard", "students", "invoices", "financial"];
                const button = (item) => (
                  <button
                    key={item.id}
                    className={page === item.id ? "selected" : ""}
                    onClick={() => {
                      navigate(item.id);
                    }}
                  >
                    <item.icon size={20} />
                    {item.label}
                  </button>
                );
                return (
                  <>
                    {navigation
                      .filter((item) => daily.includes(item.id))
                      .map(button)}
                    {user.role !== "INSTRUCTOR" && (
                      <details
                        className="nav-group"
                        open={
                          [
                            "courses",
                            "groups",
                            "enrollments",
                            "debts",
                          ].includes(page) || undefined
                        }
                      >
                        <summary>Organizimi</summary>
                        {navigation
                          .filter((item) =>
                            [
                              "courses",
                              "groups",
                              "enrollments",
                              "debts",
                            ].includes(item.id),
                          )
                          .map(button)}
                      </details>
                    )}
                    {user.role === "ADMIN" && (
                      <details
                        className="nav-group"
                        open={
                          ["users", "audit", "backups"].includes(page) ||
                          undefined
                        }
                      >
                        <summary>Administrimi</summary>
                        {navigation
                          .filter((item) =>
                            ["users", "audit", "backups"].includes(item.id),
                          )
                          .map(button)}
                      </details>
                    )}
                  </>
                );
              })()}
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
                {user.role !== "INSTRUCTOR" &&
                  paymentReminders &&
                  paymentReminders.upcoming.total +
                    paymentReminders.overdue.total >
                    0 && (
                    <button
                      className="billing-alert"
                      onClick={() => {
                        navigate("dashboard", { focusPayments: true });
                      }}
                      title={`${paymentReminders.upcoming.total} me afat sot ose brenda 7 ditëve, ${paymentReminders.overdue.total} me vonesë`}
                      aria-label={`Njoftimet e pagesave: ${paymentReminders.upcoming.total} afër afatit, ${paymentReminders.overdue.total} me vonesë`}
                    >
                      <Bell size={18} />
                      Pagesat (
                      {paymentReminders.upcoming.total +
                        paymentReminders.overdue.total}
                      )
                    </button>
                  )}
                {user.role !== "INSTRUCTOR" && reminders && (
                  <button
                    className="billing-alert"
                    onClick={() =>
                      openReview(
                        reminders.current.count
                          ? reminders.current.period
                          : reminders.next.period,
                      )
                    }
                    title={`${reminders.current.count} këtë muaj, ${reminders.next.count} muajin e ardhshëm`}
                  >
                    <Bell size={18} />
                    {reminders.total} fatura për të përgatitur
                  </button>
                )}
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
            <div className="work-shortcuts">
              <button
                className="secondary back-button"
                disabled={routes.length < 2}
                onClick={() => setRoutes((previous) => previous.slice(0, -1))}
              >
                <ArrowLeft size={16} />
                Kthehu
              </button>
              <QuickAccess user={user} navigate={navigate} />
            </div>
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
                  openStudents={() => navigate("students")}
                  navigate={navigate}
                  focusPayments={route.focusPayments}
                />
              ) : page === "students" ? (
                <StudentsPage
                  key={routes.length}
                  user={user}
                  initialStatus={route.status}
                  initialSearch={route.search}
                />
              ) : ["courses", "groups", "enrollments", "users"].includes(
                  page,
                ) ? (
                <ResourcePage
                  key={`${page}:${routes.length}`}
                  kind={page}
                  user={user}
                  navigate={navigate}
                  context={route.context}
                  initialStatus={route.status}
                />
              ) : page === "invoices" ? (
                <InvoiceWorkspace
                  key={routes.length}
                  user={user}
                  initialView={route.view ?? "list"}
                  initialPeriod={route.period}
                />
              ) : page === "debts" || page === "financial" ? (
                <Reports
                  key={`${page}:${routes.length}`}
                  kind={page}
                  initialPreset={route.preset}
                />
              ) : (
                <Admin key={page} kind={page} />
              )}
            </main>
            <footer>
              Shkolla Digjitale Prizren{" "}
              <span>Platforma e menaxhimit · ERP</span>
            </footer>
          </div>
        </div>
      </StudentWorkspace>
    </PdfWorkspace>
  );
}
