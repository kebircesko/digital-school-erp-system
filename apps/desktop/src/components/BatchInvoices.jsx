import { t, tm } from "../services/i18n.js";
import { useRef, useState } from "react";
import { api } from "../services/api";
import { calendarDay, date, monthLabel } from "../services/format";
import { presentCount } from "../services/attendance";
import { useDialog } from "../hooks/useDialog";
import StudentLink from "./StudentLink";
import SortableHeader from "./SortableHeader";
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
  sort,
  onSort,
  activeChanged,
  priceSaved,
  finished,
}) {
  const [selected, setSelected] = useState([]);
  const [drafts, setDrafts] = useState(() => draftCache.current[period] ?? {});
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(null);
  const selectedRows = rows.filter((r) => selected.includes(r.enrollmentId));
  const selectedTotal = selectedRows.reduce(
    (sum, row) => sum + cents(row.monthlyPrice) - cents(draft(row).discount),
    0,
  );
  const allSelected =
    rows.length > 0 && rows.every((r) => selected.includes(r.enrollmentId));
  function priceBasis(row) {
    return JSON.stringify([
      row.monthlyPrice,
      row.defaultAmount,
      row.suggestedAmount,
      row.suggestedNotes ?? "",
      row.priceDraft?.version ?? null,
    ]);
  }
  function draft(row) {
    const cached = drafts[row.enrollmentId];
    return (
      (cached?.priceBasis === priceBasis(row) ? cached : null) ?? {
        amount: row.suggestedAmount,
        discount: (
          (cents(row.monthlyPrice) - cents(row.suggestedAmount)) /
          100
        ).toFixed(2),
        notes: row.suggestedNotes ?? "",
      }
    );
  }
  function change(row, field, value) {
    setError("");
    const edit = { ...draft(row), [field]: value, priceBasis: priceBasis(row) };
    if (field === "amount")
      edit.discount = Number.isSafeInteger(cents(value))
        ? ((cents(row.monthlyPrice) - cents(value)) / 100).toFixed(2)
        : "";
    if (field === "discount")
      edit.amount = Number.isSafeInteger(cents(value))
        ? ((cents(row.monthlyPrice) - cents(value)) / 100).toFixed(2)
        : "";
    const next = {
      ...drafts,
      [row.enrollmentId]: edit,
    };
    draftCache.current[period] = next;
    setDrafts(next);
  }
  function validate(row) {
    const edit = draft(row),
      discount = cents(edit.discount),
      price = cents(row.monthlyPrice);
    const enteredAmount = cents(edit.amount);
    if (
      !Number.isSafeInteger(enteredAmount) ||
      enteredAmount < 0 ||
      enteredAmount > price
    ) {
      setError(
        t(
          "{0}: shuma e faturës duhet të jetë nga 0 deri në {1} €, me deri dy shifra pas pikës.",
          [row.studentName, row.monthlyPrice],
        ),
      );
      return null;
    }
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > price) {
      setError(
        t(
          "{0}: zbritja duhet të jetë nga 0 deri në {1} €, me deri dy shifra pas pikës.",
          [row.studentName, row.monthlyPrice],
        ),
      );
      return null;
    }
    const amount = ((price - discount) / 100).toFixed(2);
    if (
      amount !== (row.defaultAmount ?? row.suggestedAmount) &&
      !edit.notes.trim()
    ) {
      setError(
        t("{0}: shkruani arsyen e zbritjes ose ndryshimit të shumës.", [
          row.studentName,
        ]),
      );
      return null;
    }
    return {
      ...row,
      amount,
      notes: edit.notes.trim(),
    };
  }
  async function savePrice(row) {
    if (saving) return;
    setError("");
    const value = validate(row);
    if (!value) return;
    setSaving(row.enrollmentId);
    activeChanged(true);
    try {
      const updated = await api("/invoice-review/price", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId: row.enrollmentId,
          period: row.period,
          amount: value.amount,
          notes: value.notes,
          reviewToken: row.reviewToken,
        }),
      });
      const next = { ...drafts };
      delete next[row.enrollmentId];
      draftCache.current[period] = next;
      setDrafts(next);
      priceSaved(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(null);
      activeChanged(false);
    }
  }
  function prepare(rowsToPrepare = selectedRows) {
    setError("");
    const batch = rowsToPrepare.map(validate);
    if (batch.some((row) => !row)) return;
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
          disabled={!selectedRows.length || Boolean(saving)}
          onClick={() => prepare()}
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
              {[
                ["studentName", "Nxënësi dhe grupi"],
                ["absences", "Mungesat për kontroll"],
                ["suggestedAmount", "Shuma e faturës"],
              ].map(([key, label]) => (
                <SortableHeader
                  key={key}
                  column={key}
                  label={t(label)}
                  sort={sort}
                  onSort={onSort}
                />
              ))}
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
                        <small>
                          <strong>{presentCount(attendance)}</strong>
                          {t(" prezent (P) ·")} {attendance.totalLessons}
                          {t(" orë")}
                        </small>
                        <details className="batch-row-details">
                          <summary>{t("Shiko vijueshmërinë")}</summary>
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
                    <div className="batch-base-price">
                      {t("Çmimi mujor ")}
                      <strong>{row.monthlyPrice} €</strong>
                    </div>
                    <label>
                      {t("Çmimi për këtë muaj (€)")}
                      <input
                        aria-label={t("Çmimi për {0}", [row.studentName])}
                        inputMode="decimal"
                        value={edit.amount}
                        disabled={Boolean(saving)}
                        onChange={(e) => change(row, "amount", e.target.value)}
                      />
                    </label>
                    {cents(edit.discount) > 0 && (
                      <small>
                        {t("Zbritje: ")}
                        {euro(cents(edit.discount))}
                      </small>
                    )}
                    {(amount !==
                      cents(row.defaultAmount ?? row.suggestedAmount) ||
                      edit.notes) && (
                      <label className="batch-notes">
                        {t("Arsyeja / Shënime")}
                        <input
                          aria-label={t("Arsyeja për {0}", [row.studentName])}
                          maxLength={500}
                          disabled={Boolean(saving)}
                          value={edit.notes}
                          placeholder={t("P.sh. zbritje për mungesat")}
                          onChange={(e) => change(row, "notes", e.target.value)}
                        />
                      </label>
                    )}
                    <details className="batch-row-details">
                      <summary
                        aria-label={t("Ndrysho çmimin për {0}", [
                          row.studentName,
                        ])}
                      >
                        {t("Zbritja (€)")}
                      </summary>
                      <label>
                        {t("Zbritja (€)")}
                        <input
                          aria-label={t("Zbritja për {0}", [row.studentName])}
                          inputMode="decimal"
                          disabled={Boolean(saving)}
                          value={edit.discount}
                          onChange={(e) =>
                            change(row, "discount", e.target.value)
                          }
                        />
                      </label>
                      <p className="batch-price-scope">
                        {t("Vlen vetëm për {0}. Fatura regjistrohet më vonë.", [
                          monthLabel(row.period),
                        ])}
                      </p>
                      <button
                        className="secondary batch-save-price"
                        disabled={Boolean(saving)}
                        onClick={() => savePrice(row)}
                      >
                        {saving === row.enrollmentId
                          ? t("Duke ruajtur…")
                          : t("Ruaj çmimin për këtë muaj")}
                      </button>
                    </details>
                    {row.priceDraft && (
                      <small className="batch-price-saved" role="status">
                        {t("I ruajtur: {0} € për {1}", [
                          row.priceDraft.amount,
                          monthLabel(row.period),
                        ])}
                      </small>
                    )}
                    {(amount !== cents(row.suggestedAmount) ||
                      edit.notes !== (row.suggestedNotes ?? "")) && (
                      <small>{t("Ndryshime të paruajtura")}</small>
                    )}
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
                    </details>
                    <button
                      className="primary batch-register-single"
                      disabled={Boolean(saving)}
                      onClick={() => prepare([row])}
                    >
                      {t("Regjistro faturën")}
                    </button>
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
