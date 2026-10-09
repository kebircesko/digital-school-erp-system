import { useState, useEffect } from "react";
import { api, download } from "../services/api";
import Lookup from "../components/Lookup";
import { Row } from "./resources";
export default function Reports({ kind }: { kind: "debts" | "financial" }) {
  const [from, setFrom] = useState(
      new Date().toISOString().slice(0, 7) + "-01",
    ),
    [to, setTo] = useState(new Date().toISOString().slice(0, 10)),
    [period, setPeriod] = useState(""),
    [courseId, setCourseId] = useState(""),
    [groupId, setGroupId] = useState(""),
    [method, setMethod] = useState(""),
    [data, setData] = useState<Row | null>(null),
    [error, setError] = useState("");
  const params = new URLSearchParams({
    ...(kind === "financial" ? { from, to } : {}),
    ...(period && kind === "debts" ? { period } : {}),
    ...(courseId ? { courseId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(method ? { method } : {}),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api<Row>(`/reports/${kind}?${params}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [kind, params]);
  async function exportFile(type: string) {
    try {
      await download(
        `/reports/${kind}.${type}?${params}`,
        `raport-${kind}.${type}`,
        type === "pdf",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function preset(mode: string) {
    const today = new Date().toISOString().slice(0, 10);
    setTo(today);
    setFrom(
      mode === "day"
        ? today
        : mode === "month"
          ? today.slice(0, 7) + "-01"
          : today.slice(0, 4) + "-01-01",
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FINANCAT · EUR</span>
          <h1>
            {kind === "debts" ? "Borxhet e nxënësve" : "Raportet financiare"}
          </h1>
          <p>
            {kind === "debts"
              ? "Detyrimet e mbetura, sipas nxënësit dhe faturave."
              : "Arkëtimet sipas datës, kursit, grupit dhe metodës së pagesës."}
          </p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => exportFile("xlsx")}>
            Eksporto Excel
          </button>
          <button className="primary" onClick={() => exportFile("pdf")}>
            PDF / Printo
          </button>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <section className="card report-filters">
        {kind === "financial" ? (
          <>
            <div className="button-row">
              <button className="secondary" onClick={() => preset("day")}>
                Sot
              </button>
              <button className="secondary" onClick={() => preset("month")}>
                Ky muaj
              </button>
              <button className="secondary" onClick={() => preset("year")}>
                Ky vit
              </button>
            </div>
            <label>
              Nga data
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Deri më
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              Metoda
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">Të gjitha metodat</option>
                <option value="CASH">Para të gatshme</option>
                <option value="BANK">Bankë</option>
              </select>
            </label>
          </>
        ) : (
          <label>
            Muaji i faturimit
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        )}
        <Lookup
          endpoint="/courses"
          label="Kursi"
          value={courseId}
          onChange={(id) => {
            setCourseId(id);
            setGroupId("");
          }}
        />
        <Lookup
          endpoint={"/groups" + (courseId ? "?courseId=" + courseId : "")}
          label="Grupi"
          value={groupId}
          onChange={setGroupId}
        />
        <button
          className="text-button"
          onClick={() => {
            setCourseId("");
            setGroupId("");
            setPeriod("");
            setMethod("");
          }}
        >
          Pastro filtrat
        </button>
      </section>
      <div className="payment-total card report-total">
        <span>{kind === "debts" ? "Borxhi total" : "Totali i arkëtuar"}</span>
        <strong>{data?.total ?? "0.00"} €</strong>
      </div>
      {kind === "debts" ? (
        <section className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nxënësi</th>
                  <th>Borxhi</th>
                  <th>Faturat e papaguara</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((r: Row) => (
                  <tr key={r.studentId}>
                    <td>{r.studentName}</td>
                    <td>{r.amount} €</td>
                    <td>
                      {r.invoices.map((i: Row) => (
                        <div key={i.id}>
                          {i.number} · {i.period} · {i.courseName} /{" "}
                          {i.groupName}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && !data.items.length && (
            <div className="empty">Nuk ka borxhe për këto filtra.</div>
          )}
        </section>
      ) : (
        <>
          <div className="report-breakdowns">
            {(["courses", "groups", "methods"] as const).map((key, i) => (
              <section key={key} className="card breakdown">
                <h2>{["Sipas kursit", "Sipas grupit", "Sipas metodës"][i]}</h2>
                {data?.[key]?.map((r: Row) => (
                  <div className="legend" key={r.name}>
                    <span>
                      {r.name === "CASH"
                        ? "Para të gatshme"
                        : r.name === "BANK"
                          ? "Bankë"
                          : r.name}
                    </span>
                    <strong>{r.amount} €</strong>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <section className="card">
            <div className="card-heading">
              <h2>Historiku i arkëtimeve</h2>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Pagesa / Fatura</th>
                    <th>Nxënësi</th>
                    <th>Kursi / Grupi</th>
                    <th>Shuma</th>
                    <th>Përdoruesi</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.rows.map((r: Row, i: number) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>
                        {r.payment}
                        <br />
                        {r.invoice}
                      </td>
                      <td>{r.student}</td>
                      <td>
                        {r.course} / {r.group}
                      </td>
                      <td>{r.amount} €</td>
                      <td>{r.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && !data.rows.length && (
              <div className="empty">Nuk ka pagesa në këtë periudhë.</div>
            )}
          </section>
        </>
      )}
    </>
  );
}
