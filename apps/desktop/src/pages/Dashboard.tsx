import { useState, useEffect } from "react";
import {
  RefreshCw,
  Users,
  UserCheck,
  UserMinus,
  ArrowUpRight,
  GraduationCap,
} from "lucide-react";
import type { User, Dashboard } from "@erp/shared";
import { api } from "../services/api";
import { date } from "../services/format";
import Badge from "../components/Badge";
export default function DashboardPage({
  user,
  openStudents,
}: {
  user: User;
  openStudents: () => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState("");
  function load() {
    setError("");
    api<Dashboard>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PAMJA E PËRGJITHSHME</span>
          <h1>Mirë se erdhe, {user.name.split(" ")[0]}.</h1>
          <p>Gjithçka që duhet të dini për nxënësit tuaj, në një vend.</p>
        </div>
        <button className="secondary" onClick={load}>
          <RefreshCw size={16} />
          Rifresko
        </button>
      </div>
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : !data ? (
        <div className="empty">Duke ngarkuar statistikat…</div>
      ) : (
        <>
          <div className="stats">
            <Stat
              label="Nxënës gjithsej"
              value={data.total}
              icon={<Users />}
              text="Të gjithë nxënësit e regjistruar"
            />
            <Stat
              label="Nxënës aktivë"
              value={data.active}
              icon={<UserCheck />}
              text="Pjesë aktive e shkollës"
              green
            />
            <Stat
              label="Nxënës joaktivë"
              value={data.inactive}
              icon={<UserMinus />}
              text="Regjistrime me status joaktiv"
            />
          </div>

          <div className="stats">
            <Stat
              label="Kurset"
              value={data.courses}
              icon={<GraduationCap />}
              text="Kurse të regjistruara"
            />
            <Stat
              label="Grupet"
              value={data.groups}
              icon={<Users />}
              text="Grupe të shkollës"
            />
            {data.financial && (
              <Stat
                label="Fatura të papaguara"
                value={data.financial.unpaid}
                icon={<UserMinus />}
                text={`${data.financial.paid} fatura të paguara`}
              />
            )}
          </div>
          {data.financial && (
            <>
              <section className="finance-summary">
                {[
                  ["Arkëtimet sot", data.financial.daily],
                  ["Arkëtimet këtë muaj", data.financial.monthly],
                  ["Arkëtimet këtë vit", data.financial.yearly],
                  ["Borxhi total", data.financial.outstanding],
                ].map(([label, value]) => (
                  <div className="card" key={label}>
                    <span>{label}</span>
                    <strong>{value} €</strong>
                  </div>
                ))}
              </section>
              <section className="card income-chart">
                <h2>Arkëtimet mujore</h2>
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
                                ...data.financial!.chart.map((c) =>
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
                  <h2>Regjistrimet e fundit</h2>
                  <p>Nxënësit e shtuar së fundmi në shkollë</p>
                </div>
                <button className="text-button" onClick={openStudents}>
                  Shiko të gjithë <ArrowUpRight size={16} />
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
                        <strong>
                          {s.firstName} {s.lastName}
                        </strong>
                        <small>Regjistruar më {date(s.createdAt)}</small>
                      </div>
                      <Badge status={s.status} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <Users size={35} />
                  <h3>Shkolla juaj fillon këtu</h3>
                  <p>Shtoni nxënësin e parë për të parë regjistrimet.</p>
                  <button className="primary" onClick={openStudents}>
                    Hap menaxhimin e nxënësve
                  </button>
                </div>
              )}
            </section>
            <section className="card activity">
              <span className="eyebrow">PJESËMARRJA</span>
              <h2>Statusi i nxënësve</h2>
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
                  <span>aktivë</span>
                </div>
              </div>
              <div className="legend">
                <span>
                  <i />
                  Aktivë
                </span>
                <strong>{data.active}</strong>
              </div>
              <div className="legend">
                <span>
                  <i className="muted-dot" />
                  Joaktivë
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
              <h2>Administrim i qartë. Shkollë e organizuar.</h2>
              <p>
                Regjistroni nxënës, përditësoni kontaktet dhe mbani të dhënat të
                sakta.
              </p>
            </div>
            <button className="secondary" onClick={openStudents}>
              Menaxho nxënësit <ArrowUpRight size={17} />
            </button>
          </section>
        </>
      )}
    </>
  );
}
function Stat({
  label,
  value,
  icon,
  text,
  green = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  text: string;
  green?: boolean;
}) {
  return (
    <section className="stat card">
      <div>
        <span>{label}</span>
        <div className={green ? "stat-icon green" : "stat-icon"}>{icon}</div>
      </div>
      <strong>{value.toLocaleString("sq-AL")}</strong>
      <p>{text}</p>
    </section>
  );
}
