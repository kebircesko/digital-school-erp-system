import DateInput from "./DateInput";
import { t, tm } from "../services/i18n.js";
import WhatsAppReminder from "./WhatsAppReminder";
import { useEffect, useState } from "react";
import { Eye, Printer, Wallet } from "lucide-react";
import { useDialog } from "../hooks/useDialog";
import { api, download } from "../services/api";
import { calendarDay, date } from "../services/format";
import Lookup from "./Lookup";
import StudentLink from "./StudentLink";
import { presentCount, otherAttendance } from "../services/attendance";
import PaymentDeadline, { useSchoolDay } from "./PaymentDeadline";
import OutstandingMonths from "./OutstandingMonths";
import AttendanceSummary from "./AttendanceSummary";
import MissingInvoiceMonths from "./MissingInvoiceMonths";
const money = (value) => `${Number(value).toFixed(2)} €`;
const statuses = {
  get PAID() {
    return t("Paguar");
  },
  get PARTIAL() {
    return t("Pjesërisht paguar");
  },
  get UNPAID() {
    return t("Papaguar");
  },
  get VOID() {
    return t("Anuluar");
  },
};
function PaymentForm({ invoice, close, saved, onBusyChange }) {
  const [amount, setAmount] = useState(invoice.balance),
    [paidAt, setPaidAt] = useState(calendarDay),
    [method, setMethod] = useState("CASH"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key] = useState(crypto.randomUUID());
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      await api("/payments", {
        method: "POST",
        body: JSON.stringify({
          studentId: invoice.studentId,
          amount,
          method,
          paidAt,
          notes: "",
          idempotencyKey: key,
          allocations: [
            {
              invoiceId: invoice.id,
              amount,
            },
          ],
        }),
      });
      window.dispatchEvent(new Event("billing-updated"));
      saved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form className="invoice-payment-form" onSubmit={submit}>
      <h3>{t("Regjistro pagesën")}</h3>
      <p>
        {invoice.studentName} · {invoice.number}
        {t(" · Mbetja:")} {money(invoice.balance)}
      </p>
      <fieldset disabled={busy}>
        <AttendanceSummary
          studentId={invoice.studentId}
          courseId={invoice.courseId}
          initialPeriod={invoice.period}
          disabled={busy}
        />
        <div className="form-grid">
          <label>
            {t("Shuma e pagesës (€)")}
            <input
              autoFocus
              required
              inputMode="decimal"
              pattern="[0-9]+([.][0-9]{1,2})?"
              aria-label={t("Shuma e pagesës EUR")}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            {t("Data e pagesës")}
            <DateInput
              required
              max={calendarDay()}
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </label>
          <label>
            {t("Mënyra e pagesës")}
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">{t("Të gatshme (Cash)")}</option>
              <option value="BANK">{t("Bankë")}</option>
            </select>
          </label>
        </div>
      </fieldset>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={close}
        >
          {t("Mbyll")}
        </button>
        <button className="primary" disabled={busy}>
          {busy ? t("Duke ruajtur…") : t("Ruaj pagesën")}
        </button>
      </div>
    </form>
  );
}
export function InvoiceDialog({
  id: initialId,
  pay = false,
  close,
  saved,
  user,
}) {
  const day = useSchoolDay();
  const [id, setId] = useState(initialId);
  const [debts, setDebts] = useState(null);
  const [correcting, setCorrecting] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  useDialog(close, correcting || paymentBusy);
  useEffect(() => {
    setId(initialId);
    setPayment(pay);
  }, [initialId, pay]);
  const [invoice, setInvoice] = useState(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [payment, setPayment] = useState(pay),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setDebts(null);
    setError("");
    api(`/invoices/${id}`, {
      signal: controller.signal,
    })
      .then(async (value) => {
        if (controller.signal.aborted) return;
        setInvoice(value);
        const result = await api(
          `/reports/debts?studentId=${value.studentId}`,
          {
            signal: controller.signal,
          },
        );
        if (!controller.signal.aborted)
          setDebts(
            result.items
              .flatMap((row) => row.invoices)
              .filter((row) => Number(row.amount) > Number(row.paidAmount)),
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, revision]);
  async function preview(autoPrint = false) {
    await download(
      `/invoices/${id}/pdf`,
      invoice.number + ".pdf",
      autoPrint ? "print" : true,
    );
  }
  async function correctDeadline() {
    setCorrecting(true);
    setError("");
    try {
      await api(`/invoices/${id}/registration-deadline`, {
        method: "POST",
      });
      window.dispatchEvent(new Event("billing-updated"));
      setRevision((value) => value + 1);
      setNotice(t("Afati u përditësua sipas regjistrimit në kurs."));
    } catch (e) {
      setError(e.message);
    } finally {
      setCorrecting(false);
    }
  }
  function openDebt(row) {
    setInvoice(null);
    setNotice("");
    setPayment(true);
    setId(row.id);
  }
  const older = debts?.find((row) => row.period < invoice?.period);
  const allocations =
    invoice?.allocations.filter((a) => !a.payment.reversedAt) ?? [];
  return (
    <div className="modal-backdrop">
      <section
        className="modal wide invoice-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("Fatura")}
      >
        <div className="modal-heading">
          <div>
            <h2>
              {t("Fatura ")}
              {invoice?.number ?? ""}
            </h2>
            {invoice && (
              <p>
                {invoice.studentName} · {invoice.period}
              </p>
            )}
          </div>
          <button
            aria-label={t("Mbyll faturën")}
            disabled={correcting || paymentBusy}
            onClick={close}
          >
            ×
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            {tm(error)}
          </div>
        )}
        {notice && (
          <div className="success" role="status">
            {tm(notice)}
          </div>
        )}
        {!invoice ? (
          <p>{t("Duke ngarkuar faturën…")}</p>
        ) : (
          <>
            <div className="invoice-dialog-toolbar">
              <button className="secondary" onClick={() => preview()}>
                <Eye size={16} />
                {t("Shiko PDF")}
              </button>
              <button className="secondary" onClick={() => preview(true)}>
                <Printer size={16} />
                {t("Printo faturën")}
              </button>
              {invoice.status !== "VOID" &&
                Number(invoice.balance) > 0 &&
                !payment && (
                  <button className="primary" onClick={() => setPayment(true)}>
                    <Wallet size={16} />
                    {t("Regjistro pagesën")}
                  </button>
                )}
              <WhatsAppReminder invoice={invoice} />
              <span className={`invoice-state ${invoice.status.toLowerCase()}`}>
                {statuses[invoice.status]}
              </span>
            </div>
            <dl className="invoice-facts">
              <div>
                <dt>{t("Nxënësi")}</dt>
                <dd>
                  <StudentLink id={invoice.studentId}>
                    {invoice.studentName}
                  </StudentLink>
                </dd>
              </div>
              <div>
                <dt>{t("Data e faturës")}</dt>
                <dd>{date(invoice.issuedAt)}</dd>
              </div>
              <div>
                <dt>{t("Muaji")}</dt>
                <dd>{invoice.period}</dd>
              </div>
              <div>
                <dt>{t("Afati i pagesës")}</dt>
                <dd>
                  {date(invoice.dueDate)}{" "}
                  <PaymentDeadline invoice={invoice} day={day} />
                  {invoice.canUpdateDeadline &&
                    invoice.registrationDueDate !==
                      String(invoice.dueDate).slice(0, 10) && (
                      <button
                        className="text-button deadline-correction"
                        disabled={correcting}
                        onClick={correctDeadline}
                      >
                        {correcting
                          ? t("Duke përditësuar…")
                          : t("Vendos afatin sipas regjistrimit: {0}", [
                              date(invoice.registrationDueDate),
                            ])}
                      </button>
                    )}
                </dd>
              </div>
            </dl>
            <div className="table-scroll invoice-lines">
              <table>
                <thead>
                  <tr>
                    <th>{t("Përshkrimi")}</th>
                    <th>{t("Sasia")}</th>
                    <th>{t("Çmimi")}</th>
                    <th>{t("Zbritja")}</th>
                    <th>{t("Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {invoice.courseName}
                      <small>{invoice.groupName}</small>
                    </td>
                    <td>1</td>
                    <td>{money(invoice.subtotal)}</td>
                    <td>{money(invoice.discount)}</td>
                    <td>
                      <strong>{money(invoice.amount)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="invoice-balance">
              <span>
                {t("Total ")}
                <strong>{money(invoice.amount)}</strong>
              </span>
              <span>
                {t("Paguar ")}
                <strong>{money(invoice.paidAmount)}</strong>
              </span>
              <span>
                {t("Mbetja ")}
                <strong>{money(invoice.balance)}</strong>
              </span>
            </div>
            {debts && (
              <OutstandingMonths
                invoices={debts}
                selectedId={id}
                open={openDebt}
              />
            )}
            {payment && !debts && (
              <p role="status">{t("Duke kontrolluar muajt e papaguar…")}</p>
            )}
            {payment && older && (
              <p className="error" role="alert">
                {t(
                  "Ky nxënës ka muaj të mëparshëm të papaguar. Zgjidhni “Paguaj këtë muaj” te borxhi më i vjetër më sipër.",
                )}
              </p>
            )}
            {payment &&
            debts &&
            !older &&
            invoice.status !== "VOID" &&
            Number(invoice.balance) > 0 ? (
              <PaymentForm
                key={`${invoice.id}:${invoice.balance}`}
                invoice={invoice}
                onBusyChange={setPaymentBusy}
                close={() => setPayment(false)}
                saved={() => {
                  setPayment(false);
                  setNotice(
                    t(
                      "Pagesa u ruajt. Fatura për printim përmban edhe pagesën.",
                    ),
                  );
                  setRevision((v) => v + 1);
                  saved?.();
                }}
              />
            ) : (
              <>
                <h3 className="section-label">{t("Pagesat e kësaj fature")}</h3>
                {allocations.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("Data")}</th>
                          <th>{t("Lloji i pagesës")}</th>
                          <th>{t("Paguar në")}</th>
                          <th>{t("Shuma")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allocations.map((a) => (
                          <tr key={a.id}>
                            <td>{date(a.payment.paidAt)}</td>
                            <td>
                              {a.payment.method === "CASH"
                                ? t("Të gatshme (Cash)")
                                : t("Bankë")}
                            </td>
                            <td>
                              {a.payment.method === "CASH"
                                ? t("Arka zyre")
                                : t("Bankë")}
                            </td>
                            <td>{money(a.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="invoice-empty">
                    {t("Ende nuk është regjistruar pagesë.")}
                  </p>
                )}
              </>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={correcting || paymentBusy}
                onClick={close}
              >
                {t("Mbyll")}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
export function NewInvoiceDialog({
  candidate,
  initialStudent,
  initialPeriod,
  initialCourseId,
  close,
  created,
}) {
  const [studentId, setStudentId] = useState(
      candidate?.studentId ?? initialStudent?.id ?? "",
    ),
    [period, setPeriod] = useState(
      candidate?.period ?? initialPeriod ?? calendarDay().slice(0, 7),
    ),
    [rows, setRows] = useState(candidate ? [candidate] : []),
    [existingInvoices, setExistingInvoices] = useState([]),
    [gapState, setGapState] = useState(null),
    [enrollmentId, setEnrollmentId] = useState(candidate?.enrollmentId ?? ""),
    [amount, setAmount] = useState(candidate?.suggestedAmount ?? ""),
    [notes, setNotes] = useState(candidate?.suggestedNotes ?? ""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useDialog(close, busy);
  useEffect(() => {
    setGapState(null);
    if (!studentId) return;
    const controller = new AbortController();
    api(`/students/${studentId}/history`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted)
          setGapState({ studentId, data: result.missingInvoices });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setGapState({ studentId, error: e.message });
      });
    return () => controller.abort();
  }, [studentId]);
  const gaps = gapState?.studentId === studentId ? gapState : null;
  useEffect(() => {
    setExistingInvoices([]);
    if (!studentId || !period) {
      setRows([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(
      `/invoice-review/pending?studentId=${studentId}&period=${period}&limit=200`,
      {
        signal: controller.signal,
      },
    )
      .then(async (data) => {
        const items = initialCourseId
          ? data.items.filter((item) => item.courseId === initialCourseId)
          : data.items;
        const existing = items.length
          ? []
          : (
              await api(
                `/invoices?studentId=${studentId}&period=${period}&limit=200${initialCourseId ? `&courseId=${initialCourseId}` : ""}`,
                { signal: controller.signal },
              )
            ).items;
        if (controller.signal.aborted) return;
        setExistingInvoices(existing);
        setRows(items);
        const row =
          items.find((r) => r.enrollmentId === candidate?.enrollmentId) ??
          items[0];
        setEnrollmentId(row?.enrollmentId ?? "");
        setAmount(row?.suggestedAmount ?? "");
        setNotes(row?.suggestedNotes ?? "");
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setRows([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studentId, period, candidate?.enrollmentId, initialCourseId]);
  const row = rows.find((r) => r.enrollmentId === enrollmentId);
  async function submit(event) {
    event.preventDefault();
    if (!row) return;
    setBusy(true);
    setError("");
    try {
      const invoice = await api("/invoice-review/approve", {
        method: "POST",
        body: JSON.stringify({
          period,
          enrollmentId: row.enrollmentId,
          amount,
          notes,
          reviewToken: row.reviewToken,
        }),
      });
      window.dispatchEvent(new Event("billing-updated"));
      created(invoice);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal wide invoice-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("Regjistro faturën")}
      >
        <div className="modal-heading">
          <div>
            <h2>{t("Regjistro faturën")}</h2>
            <p>
              {t(
                "Zgjidh nxënësin, muajin dhe shumën. Numri i faturës caktohet automatikisht.",
              )}
            </p>
          </div>
          <button
            disabled={busy}
            aria-label={t("Mbyll faturën")}
            onClick={close}
          >
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Lookup
                endpoint="/students"
                label={t("Nxënësi")}
                value={studentId}
                initialLabel={
                  candidate?.studentName ??
                  (initialStudent
                    ? `${initialStudent.firstName} ${initialStudent.lastName}`
                    : "")
                }
                onChange={setStudentId}
              />
              <label>
                {t("Muaji i faturës")}
                <input
                  type="month"
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                />
              </label>
              <label>
                {t("Data e faturës")}
                <DateInput readOnly value={calendarDay()} />
              </label>
              {row && (
                <label>
                  {t("Afati i pagesës")}
                  <DateInput readOnly value={row.dueDate} />
                  <small>
                    {t(
                      "Pagesa e radhës: një muaj kalendarik, sipas ditës së regjistrimit.",
                    )}
                  </small>
                </label>
              )}
              <label>
                {t("Valuta")}
                <input readOnly value="EUR" />
              </label>
            </div>
            {studentId && (
              <section
                className="card missing-invoice-warning"
                aria-label={t("Muaj pa faturë")}
              >
                <h3>{t("Muaj pa faturë")}</h3>
                {!gaps ? (
                  <p role="status">{t("Duke kontrolluar muajt pa faturë…")}</p>
                ) : gaps.error ? (
                  <p className="error" role="alert">
                    {tm(gaps.error)}
                  </p>
                ) : gaps.data?.total ? (
                  <MissingInvoiceMonths data={gaps.data} open />
                ) : (
                  <p>{t("Nuk u gjetën muaj pa faturë.")}</p>
                )}
              </section>
            )}
            {loading ? (
              <p className="invoice-empty">
                {t("Duke kontrolluar regjistrimin…")}
              </p>
            ) : studentId && !row && existingInvoices.length ? (
              <div className="invoice-empty" role="status">
                <p>{t("Ky nxënës ka faturë për këtë muaj.")}</p>
                {existingInvoices.map((invoice) => (
                  <div key={invoice.id} className="table-toolbar">
                    <span>
                      <strong>{invoice.number}</strong> · {invoice.courseName}
                      {" · "}
                      {money(invoice.amount)} · {statuses[invoice.status]}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => created(invoice)}
                    >
                      {t("Hap faturën ekzistuese")}
                    </button>
                  </div>
                ))}
              </div>
            ) : studentId && !row && !error ? (
              <p className="invoice-empty">
                {t(
                  "Nuk ka regjistrim për faturim në këtë muaj. Kontrollo regjistrimin në kurs ose pagesën e muajit paraprak.",
                )}
              </p>
            ) : (
              row && (
                <>
                  <label className="spaced">
                    {t("Kursi / Grupi")}
                    <select
                      value={enrollmentId}
                      onChange={(e) => {
                        setEnrollmentId(e.target.value);
                        setAmount(
                          rows.find((r) => r.enrollmentId === e.target.value)
                            ?.suggestedAmount ?? "",
                        );
                        setNotes(
                          rows.find((r) => r.enrollmentId === e.target.value)
                            ?.suggestedNotes ?? "",
                        );
                      }}
                    >
                      {rows.map((r) => (
                        <option key={r.enrollmentId} value={r.enrollmentId}>
                          {r.courseName} · {r.groupName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-grid spaced">
                    <label>
                      {t("Çmimi i kursit (€)")}
                      <input readOnly value={row.monthlyPrice} />
                    </label>
                    <label>
                      {t("Shuma për pagesë (€)")}
                      <input
                        autoFocus
                        required
                        aria-label={t("Shuma e faturës EUR")}
                        inputMode="decimal"
                        pattern="[0-9]+([.][0-9]{1,2})?"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </label>
                  </div>
                  {(Number(amount) !==
                    Number(row.defaultAmount ?? row.suggestedAmount) ||
                    Boolean(notes)) && (
                    <label className="spaced">
                      {t("Arsyeja e ndryshimit")}
                      <textarea
                        aria-label={t("Arsyeja e ndryshimit")}
                        required
                        maxLength={500}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t("P.sh. zbritje për mungesat")}
                      />
                    </label>
                  )}
                  <details className="invoice-attendance" open>
                    <summary>{t("Mungesat për kontroll")}</summary>
                    {[
                      [
                        t("Muaji paraprak"),
                        row.previousPeriod,
                        row.attendance.previous,
                      ],
                      [
                        t("Muaji i faturës"),
                        row.period,
                        row.attendance.current,
                      ],
                    ].map(([label, month, a]) => (
                      <p key={label}>
                        <strong>
                          {label} ({month}):{" "}
                        </strong>
                        {a
                          ? t(
                              "{0} prezent (P) · {1} mungesa (A) · {2} orë gjithsej{3}",
                              [
                                presentCount(a),
                                a.absences,
                                a.totalLessons,
                                otherAttendance(a)
                                  ? ` · ${otherAttendance(a)}`
                                  : "",
                              ],
                            )
                          : t("Pa të dhëna")}
                      </p>
                    ))}
                  </details>
                </>
              )
            )}
          </fieldset>
          {error && (
            <div className="error" role="alert">
              {tm(error)}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              {t("Anulo")}
            </button>
            <button className="primary" disabled={busy || loading || !row}>
              {busy ? t("Duke ruajtur…") : t("Ruaj faturën")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
