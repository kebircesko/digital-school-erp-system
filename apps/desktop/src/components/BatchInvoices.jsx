import { t, tm } from "../services/i18n.js";
import { useRef, useState } from "react";
import { api } from "../services/api";
import { calendarDay, date, monthLabel } from "../services/format";
import { presentCount } from "../services/attendance";
import { useDialog } from "../hooks/useDialog";
import StudentLink from "./StudentLink";
const cents = (value) =>
  /^\d+(\.\d{1,2})?$/.test(String(value))
    ? Math.round(Number(value) * 100)
    : NaN;
const euro = (value) => `${(value / 100).toFixed(2)} €`;
function ConfirmBatch({ rows, close, finished }) {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(0);
  const submitting = useRef(false);
  useDialog(() => {
    if (results) finished(results);
    else close();
  }, busy);
  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const outcome = [];
    for (const row of rows) {
      try {
        await api("/invoice-review/approve", {
          method: "POST",
          body: JSON.stringify({
            enrollmentId: row.enrollmentId,
            period: row.period,
            amount: row.amount,
            notes: row.notes,
            reviewToken: row.reviewToken,
          }),
        });
        outcome.push({
          name: row.studentName,
          ok: true,
        });
      } catch (e) {
        outcome.push({
          name: row.studentName,
          ok: false,
          message: e.message,
        });
      }
      setProgress(outcome.length);
    }
    setResults(outcome);
    setBusy(false);
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-title"
      >
        <h2 id="batch-title">{t("Konfirmo faturat e zgjedhura")}</h2>
        {results ? (
          <>
            <p role="status">
              {t("U regjistruan ")}
              {results.filter((r) => r.ok).length}
              {t(" nga")} {rows.length}
              {t(" fatura.")}
            </p>
            {results
              .filter((r) => !r.ok)
              .map((r, i) => (
                <p className="error" key={i}>
                  {r.name}: {tm(r.message)}
                  {t(
                    " Kontrolloni listën pas rifreskimit para se të provoni sërish.",
                  )}
                </p>
              ))}
            <div className="modal-actions">
              <button className="primary" onClick={() => finished(results)}>
                {t("Përfundo")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              {rows.length}
              {t(" fatura për ")}
              {monthLabel(rows[0].period)}
              {t(" · Totali:")}{" "}
              <strong>
                {euro(rows.reduce((sum, row) => sum + cents(row.amount), 0))}
              </strong>
            </p>
            <p>
              {t(
                "Kontrolloni shumat. Faturat regjistrohen si detyrim; pagesën e regjistroni kur e pranoni.",
              )}
            </p>
            <div className="table-scroll batch-confirm-table">
              <table>
                <thead>
                  <tr>
                    <th>{t("Nxënësi / Grupi")}</th>
                    <th>{t("Zbritja")}</th>
                    <th>{t("Shuma")}</th>
                    <th>{t("Afati")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.enrollmentId}>
                      <td>
                        {row.studentName}
                        <small>{row.groupName}</small>
                        {row.notes && <small>{row.notes}</small>}
                      </td>
                      <td>
                        {euro(cents(row.monthlyPrice) - cents(row.amount))}
                      </td>
                      <td>{row.amount} €</td>
                      <td>{date(row.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {busy && (
              <p role="status">
                {t("Duke regjistruar… ")}
                {progress} / {rows.length}
              </p>
            )}
            <div className="modal-actions">
              <button className="secondary" disabled={busy} onClick={close}>
                {t("Kthehu te kontrolli")}
              </button>
              <button className="primary" disabled={busy} onClick={submit}>
                {busy ? t("Duke regjistruar…") : t("Konfirmo regjistrimin")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
export default function BatchInvoices({
  period,
  draftCache,
  rows,
  openSingle,
  activeChanged,
  finished,
}) {
  const [selected, setSelected] = useState([]);
  const [drafts, setDrafts] = useState(() => draftCache.current[period] ?? {});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const selectedRows = rows.filter((r) => selected.includes(r.enrollmentId));
  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + cents(row.monthlyPrice) - cents(draft(row).discount),
    0,
  );
  const allSelected =
    rows.length > 0 && rows.every((r) => selected.includes(r.enrollmentId));
  function draft(row) {
    return (
      drafts[row.enrollmentId] ?? {
        discount: (
          (cents(row.monthlyPrice) - cents(row.suggestedAmount)) /
          100
        ).toFixed(2),
        notes: "",
      }
    );
  }
  function change(row, field, value) {
    setError("");
    const next = {
      ...drafts,
      [row.enrollmentId]: {
        ...draft(row),
        [field]: value,
      },
    };
    draftCache.current[period] = next;
    setDrafts(next);
  }
  function prepare() {
    setError("");
    const batch = [];
    for (const row of rows.filter((r) => selected.includes(r.enrollmentId))) {
      const edit = draft(row),
        discount = cents(edit.discount),
        price = cents(row.monthlyPrice);
      if (!Number.isSafeInteger(discount) || discount < 0 || discount > price) {
        setError(
          t(
            "{0}: zbritja duhet të jetë nga 0 deri në {1} €, me deri dy shifra pas pikës.",
            [row.studentName, row.monthlyPrice],
          ),
        );
        return;
      }
      const amount = ((price - discount) / 100).toFixed(2);
      if (amount !== row.suggestedAmount && !edit.notes.trim()) {
        setError(
          t("{0}: shkruani arsyen e zbritjes ose ndryshimit të shumës.", [
            row.studentName,
          ]),
        );
        return;
      }
      batch.push({
        ...row,
        amount,
        notes: edit.notes.trim(),
      });
    }
    if (!batch.length) return;
    setConfirm(batch);
    activeChanged(true);
  }
  function close() {
    setConfirm(null);
    activeChanged(false);
  }
  return (
    <>
      <div className="batch-invoice-actions">
        <label>
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!rows.length}
            onChange={(e) =>
              setSelected(
                e.target.checked ? rows.map((r) => r.enrollmentId) : [],
              )
            }
          />{" "}
          {t("Zgjidh të gjithë në këtë faqe")}
        </label>
        <span aria-live="polite">
          {selectedRows.length}
          {t(" të zgjedhur ·")}{" "}
          {Number.isFinite(selectedTotal) && selectedTotal >= 0
            ? euro(selectedTotal)
            : t("Kontrolloni zbritjet")}
        </span>
        <button
          className="primary"
          disabled={!selectedRows.length}
          onClick={prepare}
        >
          {t("Regjistro faturat e zgjedhura")}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      <div className="table-scroll">
        <table className="batch-invoice-table">
          <colgroup>
            <col className="batch-col-select" />
            <col className="batch-col-student" />
            <col className="batch-col-attendance" />
            <col />
            <col className="batch-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th aria-label={t("Zgjidh")}></th>
              <th>{t("Nxënësi dhe grupi")}</th>
              <th>{t("Mungesat për kontroll")}</th>
              <th>{t("Shuma e faturës")}</th>
              <th>{t("Veprime")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const edit = draft(row),
                amount = cents(row.monthlyPrice) - cents(edit.discount);
              const attendance =
                row.period > calendarDay().slice(0, 7)
                  ? row.attendance.previous
                  : (row.attendance.current ?? row.attendance.previous);
              return (
                <tr key={row.enrollmentId}>
                  <td className="batch-select-cell">
                    <input
                      type="checkbox"
                      aria-label={t("Zgjidh {0}", [row.studentName])}
                      checked={selected.includes(row.enrollmentId)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, row.enrollmentId]
                            : prev.filter((id) => id !== row.enrollmentId),
                        )
                      }
                    />
                  </td>
                  <td className="batch-student-cell">
                    <StudentLink id={row.studentId}>
                      <strong>{row.studentName}</strong>
                    </StudentLink>
                    <small>
                      {row.courseName} · {row.groupName}
                    </small>
                  </td>
                  <td className="batch-attendance-cell">
                    {attendance ? (
                      <>
                        <strong
                          className={`batch-absence-count${attendance.absences ? " has-absences" : ""}`}
                        >
                          {attendance.absences}
                          {t(" mungesa (A)")}
                        </strong>
                        <small>{monthLabel(attendance.period)}</small>
                        <details className="batch-row-details">
                          <summary>{t("Shiko vijueshmërinë")}</summary>
                          <small>
                            {presentCount(attendance)}
                            {t(" prezent (P) ·")} {attendance.totalLessons}
                            {t(" orë")}
                          </small>
                          <small>
                            {attendance.excusedAbsences}
                            {t(" mungesa me arsye")}
                          </small>
                        </details>
                      </>
                    ) : (
                      <span className="attendance-missing">
                        {t("Pa të dhëna të vijueshmërisë")}
                      </span>
                    )}
                  </td>
                  <td className="batch-pricing-cell">
                    <strong className="batch-compact-amount">
                      {Number.isFinite(amount) && amount >= 0
                        ? euro(amount)
                        : t("Kontrolloni zbritjen")}
                    </strong>
                    {cents(edit.discount) > 0 && (
                      <small>
                        {t("Zbritje: ")}
                        {euro(cents(edit.discount))}
                      </small>
                    )}
                    <details className="batch-row-details">
                      <summary
                        aria-label={t("Ndrysho zbritjen për {0}", [
                          row.studentName,
                        ])}
                      >
                        {t("Ndrysho zbritjen")}
                      </summary>
                      <div className="batch-base-price">
                        {t("Çmimi mujor ")}
                        <strong>{row.monthlyPrice} €</strong>
                      </div>
                      <div className="batch-price-editor">
                        <label>
                          {t("Zbritja (€)")}
                          <input
                            aria-label={t("Zbritja për {0}", [row.studentName])}
                            inputMode="decimal"
                            value={edit.discount}
                            onChange={(e) =>
                              change(row, "discount", e.target.value)
                            }
                          />
                        </label>
                        <div className="batch-final-price">
                          <span>{t("Për faturim")}</span>
                          <strong>
                            {Number.isFinite(amount) && amount >= 0
                              ? euro(amount)
                              : t("Kontrolloni zbritjen")}
                          </strong>
                        </div>
                      </div>
                      <label className="batch-notes">
                        {t("Arsyeja / Shënime")}
                        <input
                          aria-label={t("Arsyeja për {0}", [row.studentName])}
                          maxLength={500}
                          value={edit.notes}
                          placeholder={t("P.sh. zbritje për mungesat")}
                          onChange={(e) => change(row, "notes", e.target.value)}
                        />
                      </label>
                    </details>
                  </td>
                  <td className="batch-action-cell">
                    <details className="batch-row-details">
                      <summary
                        aria-label={t("Detajet për {0}", [row.studentName])}
                      >
                        {t("Detaje")}
                      </summary>
                      {row.instructorName && (
                        <small>
                          {t("Instruktori: ")}
                          {row.instructorName}
                        </small>
                      )}
                      <small>
                        {t("Afati: ")}
                        {date(row.dueDate)}
                      </small>
                      <button
                        className="secondary"
                        onClick={() => openSingle(row)}
                      >
                        {t("Regjistro veçmas")}
                      </button>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {confirm && (
        <ConfirmBatch
          rows={confirm}
          close={close}
          finished={(results) => {
            setConfirm(null);
            finished(results);
          }}
        />
      )}
    </>
  );
}
