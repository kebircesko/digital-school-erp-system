import { t, tm, getLocale } from "../services/i18n.js";
import { useState, useEffect } from "react";
import {
  RefreshCw,
  Users,
  UserCheck,
  UserMinus,
  ArrowUpRight,
  GraduationCap,
} from "lucide-react";
import { api } from "../services/api";
import { date } from "../services/format";
import Badge from "../components/Badge";
import StudentLink from "../components/StudentLink";
import PaymentReminders from "../components/PaymentReminders";
export default function DashboardPage({
  user,
  openStudents,
  navigate,
  focusPayments,
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (focusPayments && data)
      document.getElementById("payment-reminders")?.scrollIntoView({
        behavior: "smooth",
      });
  }, [focusPayments, Boolean(data)]);
  function load() {
    setError("");
    api("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    window.addEventListener("billing-updated", load);
    window.addEventListener("student-updated", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
      window.removeEventListener("billing-updated", load);
      window.removeEventListener("student-updated", load);
    };
  }, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("PAMJA E PËRGJITHSHME")}</span>
          <h1>
            {t("Mirë se erdhe, ")}
            {user.name.split(" ")[0]}.
          </h1>
          <p>
            {t("Gjithçka që duhet të dini për nxënësit tuaj, në një vend.")}
          </p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={16} />
          {t("Rifresko")}
        </button>
      </div>
      {error ? (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      ) : !data ? (
        <div className="empty">{t("Duke ngarkuar statistikat…")}</div>
      ) : (
        <>
          <div className="stats">
            <Stat
              label={t("Nxënës gjithsej")}
              onClick={() => navigate("students")}
              value={data.total}
              icon={<Users />}
              text={t("Të gjithë nxënësit e regjistruar")}
            />
            <Stat
              label={t("Nxënës aktivë")}
              onClick={() =>
                navigate("students", {
                  status: "ACTIVE",
                })
              }
              value={data.active}
              icon={<UserCheck />}
              text={t("Pjesë aktive e shkollës")}
              green
            />
            <Stat
              label={t("Nxënës joaktivë")}
              onClick={() =>
                navigate("students", {
                  status: "INACTIVE",
                })
              }
              value={data.inactive}
              icon={<UserMinus />}
              text={t("Regjistrime me status joaktiv")}
            />
          </div>

          <div className="stats">
            <Stat
              label={t("Kurset")}
              onClick={() => navigate("courses")}
              value={data.courses}
              icon={<GraduationCap />}
              text={t("Kurse të regjistruara")}
            />
            <Stat
              label={t("Grupet")}
              onClick={() =>
                navigate("groups", {
                  status: "",
                })
              }
              value={data.groups}
              icon={<Users />}
              text={t("Grupe të shkollës")}
            />
            {data.financial && (
              <Stat
                label={t("Fatura të papaguara")}
                onClick={() => navigate("debts")}
                value={data.financial.unpaid}
                icon={<UserMinus />}
                text={t("{0} fatura të paguara", [data.financial.paid])}
              />
            )}
          </div>
          {data.financial && (
            <>
              {data.financial.reminders && (
                <PaymentReminders
                  reminders={data.financial.reminders}
                  refresh={load}
                />
              )}
              <section className="finance-summary">
                {[
                  [t("Arkëtimet sot"), data.financial.daily, "day"],
                  [t("Arkëtimet këtë muaj"), data.financial.monthly, "month"],
                  [t("Arkëtimet këtë vit"), data.financial.yearly, "year"],
                  [t("Borxhi total"), data.financial.outstanding, "debts"],
                ].map(([label, value, preset]) => (
                  <button
                    className="card actionable-card"
                    key={label}
                    onClick={() =>
                      navigate(preset === "debts" ? "debts" : "financial", {
                        preset,
                      })
                    }
                  >
                    <span>{label}</span>
                    <strong>{value} €</strong>
                  </button>
                ))}
              </section>
              <section className="card income-chart">
                <h2>{t("Arkëtimet mujore")}</h2>
                <div className="chart-bars">
                  {data.financial.chart.map((item) => (
                    <div
                      key={item.month}
                      title={`${item.month}: ${item.amount} €`}
                    >
                      <small>{item.amount} €</small>
                      <div
                        style={{
                          height: Math.max(
                            2,
                            (140 * Number(item.amount)) /
                              Math.max(
                                1,
                                ...data.financial.chart.map((c) =>
                                  Number(c.amount),
                                ),
                              ),
                          ),
                        }}
                      />
                      <span>{item.month.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          <div className="dashboard-grid">
            <section className="card">
              <div className="card-heading">
                <div>
                  <h2>{t("Regjistrimet e fundit")}</h2>
                  <p>{t("Nxënësit e shtuar së fundmi në shkollë")}</p>
                </div>
                <button className="text-button" onClick={openStudents}>
                  {t("Shiko të gjithë ")}
                  <ArrowUpRight size={16} />
                </button>
              </div>
              {data.recent.length ? (
                <div className="recent-list">
                  {data.recent.map((s) => (
                    <div className="recent-row" key={s.id}>
                      <div className="student-avatar">
                        {s.firstName[0]}
                        {s.lastName[0]}
                      </div>
                      <div>
                        <StudentLink id={s.id}>
                          <strong>
                            {s.firstName} {s.lastName}
                          </strong>
                        </StudentLink>
                        <small>
                          {t("Regjistruar më ")}
                          {date(s.createdAt)}
                        </small>
                      </div>
                      <Badge status={s.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <Users size={35} />
                  <h3>{t("Shkolla juaj fillon këtu")}</h3>
                  <p>{t("Shtoni nxënësin e parë për të parë regjistrimet.")}</p>
                  <button className="primary" onClick={openStudents}>
                    {t("Hap menaxhimin e nxënësve")}
                  </button>
                </div>
              )}
            </section>
            <section className="card activity">
              <span className="eyebrow">{t("PJESËMARRJA")}</span>
              <h2>{t("Statusi i nxënësve")}</h2>
              <div
                className="ring"
                style={{
                  background: `conic-gradient(#00004e ${(data.total ? data.active / data.total : 0) * 100}%, var(--border) 0)`,
                }}
              >
                <div>
                  <strong>
                    {data.total
                      ? Math.round((data.active / data.total) * 100)
                      : 0}
                    %
                  </strong>
                  <span>{t("aktivë")}</span>
                </div>
              </div>
              <div className="legend">
                <span>
                  <i />
                  {t("Aktivë")}
                </span>
                <strong>{data.active}</strong>
              </div>
              <div className="legend">
                <span>
                  <i className="muted-dot" />
                  {t("Joaktivë")}
                </span>
                <strong>{data.inactive}</strong>
              </div>
            </section>
          </div>
          <section className="welcome-strip">
            <div className="strip-icon">
              <GraduationCap size={30} />
            </div>
            <div>
              <h2>{t("Administrim i qartë. Shkollë e organizuar.")}</h2>
              <p>
                {t(
                  "Regjistroni nxënës, përditësoni kontaktet dhe mbani të dhënat të sakta.",
                )}
              </p>
            </div>
            <button className="secondary" onClick={openStudents}>
              {t("Menaxho nxënësit ")}
              <ArrowUpRight size={17} />
            </button>
          </section>
        </>
      )}
    </>
  );
}
function Stat({ label, value, icon, text, green = false, onClick }) {
  return (
    <button
      className="stat card actionable-card"
      onClick={onClick}
      aria-label={t("{0}: {1}. Hap listën", [label, value])}
    >
      <div>
        <span>{label}</span>
        <div className={green ? "stat-icon green" : "stat-icon"}>{icon}</div>
      </div>
      <strong>{value.toLocaleString(getLocale())}</strong>
      <p>
        {text} <ArrowUpRight size={13} />
      </p>
    </button>
  );
}
