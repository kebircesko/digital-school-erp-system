import { t, tm } from "../services/i18n.js";
import { useState, useEffect } from "react";
import { api, download } from "../services/api";
import { InvoiceDialog } from "../components/InvoiceDialog";
import Lookup from "../components/Lookup";
import StudentLink from "../components/StudentLink";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import { calendarDay } from "../services/format";
export default function Reports({ kind, initialPreset = "month" }) {
  const updates = useSchoolUpdates();
  const [invoice, setInvoice] = useState(null);
  const [from, setFrom] = useState(() =>
      initialPreset === "day"
        ? calendarDay()
        : initialPreset === "year"
          ? calendarDay().slice(0, 4) + "-01-01"
          : calendarDay().slice(0, 7) + "-01",
    ),
    [to, setTo] = useState(calendarDay()),
    [period, setPeriod] = useState(""),
    [courseId, setCourseId] = useState(""),
    [groupId, setGroupId] = useState(""),
    [method, setMethod] = useState(""),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  const params = new URLSearchParams({
    ...(kind === "financial"
      ? {
          from,
          to,
        }
      : {}),
    ...(period && kind === "debts"
      ? {
          period,
        }
      : {}),
    ...(courseId
      ? {
          courseId,
        }
      : {}),
    ...(groupId
      ? {
          groupId,
        }
      : {}),
    ...(method
      ? {
          method,
        }
      : {}),
  }).toString();
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api(`/reports/${kind}?${params}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [kind, params, updates]);
  async function exportFile(type) {
    try {
      await download(
        `/reports/${kind}.${type}?${params}`,
        `raport-${kind}.${type}`,
        type === "pdf",
      );
    } catch (e) {
      setError(e.message);
    }
  }
  function preset(mode) {
    const today = calendarDay();
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
          <span className="eyebrow">{t("FINANCAT · EUR")}</span>
          <h1>
            {kind === "debts"
              ? t("Borxhet e nxënësve")
              : t("Raportet financiare")}
          </h1>
          <p>
            {kind === "debts"
              ? t("Detyrimet e mbetura, sipas nxënësit dhe faturave.")
              : t(
                  "Arkëtimet sipas datës, kursit, grupit dhe metodës së pagesës.",
                )}
          </p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={() => exportFile("xlsx")}>
            {t("Eksporto Excel")}
          </button>
          <button className="primary" onClick={() => exportFile("pdf")}>
            {t("PDF / Printo")}
          </button>
        </div>
      </div>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      <section className="card report-filters">
        {kind === "financial" ? (
          <>
            <div className="button-row">
              <button className="secondary" onClick={() => preset("day")}>
                {t("Sot")}
              </button>
              <button className="secondary" onClick={() => preset("month")}>
                {t("Ky muaj")}
              </button>
              <button className="secondary" onClick={() => preset("year")}>
                {t("Ky vit")}
              </button>
            </div>
            <label>
              {t("Nga data")}
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              {t("Deri më")}
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <label>
              {t("Metoda")}
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="">{t("Të gjitha metodat")}</option>
                <option value="CASH">{t("Para të gatshme")}</option>
                <option value="BANK">{t("Bankë")}</option>
              </select>
            </label>
          </>
        ) : (
          <label>
            {t("Muaji i faturimit")}
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </label>
        )}
        <Lookup
          endpoint="/courses"
          label={t("Kursi")}
          value={courseId}
          onChange={(id) => {
            setCourseId(id);
            setGroupId("");
          }}
        />
        <Lookup
          endpoint={"/groups" + (courseId ? "?courseId=" + courseId : "")}
          label={t("Grupi")}
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
          {t("Pastro filtrat")}
        </button>
      </section>
      <div className="payment-total card report-total">
        <span>
          {kind === "debts" ? t("Borxhi total") : t("Totali i arkëtuar")}
        </span>
        <strong>{data?.total ?? "0.00"} €</strong>
      </div>
      {kind === "debts" ? (
        <section className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Nxënësi")}</th>
                  <th>{t("Borxhi")}</th>
                  <th>{t("Faturat e papaguara")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((r) => (
                  <tr key={r.studentId}>
                    <td>
                      <StudentLink id={r.studentId}>
                        {r.studentName}
                      </StudentLink>
                    </td>
                    <td>{r.amount} €</td>
                    <td>
                      {r.invoices.map((i) => (
                        <button
                          className="student-link debt-invoice-link"
                          key={i.id}
                          onClick={() => setInvoice(i.id)}
                        >
                          {i.number} · {i.period} · {i.courseName} /{" "}
                          {i.groupName}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && !data.items.length && (
            <div className="empty">{t("Nuk ka borxhe për këto filtra.")}</div>
          )}
        </section>
      ) : (
        <>
          <div className="report-breakdowns">
            {["courses", "groups", "methods"].map((key, i) => (
              <section key={key} className="card breakdown">
                <h2>
                  {
                    [t("Sipas kursit"), t("Sipas grupit"), t("Sipas metodës")][
                      i
                    ]
                  }
                </h2>
                {data?.[key]?.map((r) => (
                  <div className="legend" key={r.name}>
                    <span>
                      {r.name === "CASH"
                        ? t("Para të gatshme")
                        : r.name === "BANK"
                          ? t("Bankë")
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
              <h2>{t("Historiku i arkëtimeve")}</h2>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t("Data")}</th>
                    <th>{t("Pagesa / Fatura")}</th>
                    <th>{t("Nxënësi")}</th>
                    <th>{t("Kursi / Grupi")}</th>
                    <th>{t("Shuma")}</th>
                    <th>{t("Përdoruesi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.date}</td>
                      <td>
                        {r.payment}
                        <br />
                        {r.invoice}
                      </td>
                      <td>
                        <StudentLink id={r.studentId}>{r.student}</StudentLink>
                      </td>
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
              <div className="empty">
                {t("Nuk ka pagesa në këtë periudhë.")}
              </div>
            )}
          </section>
        </>
      )}
      {invoice && <InvoiceDialog id={invoice} close={() => setInvoice(null)} />}
    </>
  );
}
