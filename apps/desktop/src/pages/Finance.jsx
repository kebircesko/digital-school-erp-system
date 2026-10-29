import { useState, useEffect } from "react";
import { Plus, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { useDialog } from "../hooks/useDialog";
import { api, download } from "../services/api";
import Lookup from "../components/Lookup";
import StudentLink from "../components/StudentLink";
import AttendanceSummary from "../components/AttendanceSummary";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import PaymentDeadline, { useSchoolDay } from "../components/PaymentDeadline";
import { calendarDay, date, monthLabel } from "../services/format";
import { InvoiceDialog, NewInvoiceDialog } from "../components/InvoiceDialog";
const labelStatus = {
  UNPAID: "Papaguar",
  PARTIAL: "Pjesërisht paguar",
  PAID: "Paguar",
  VOID: "Anuluar",
};
const money = (value) => value + " €";
function cents(value) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
}
function amount(value) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function PaymentEditor({ close, saved }) {
  const [studentId, setStudentId] = useState(""),
    [invoices, setInvoices] = useState([]),
    [allocations, setAllocations] = useState({}),
    [method, setMethod] = useState("CASH"),
    [paidAt, setPaidAt] = useState(calendarDay),
    [notes, setNotes] = useState(""),
    [key] = useState(crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useDialog(close, busy);
  useEffect(() => {
    setInvoices([]);
    setAllocations({});
    setError("");
    setLoading(Boolean(studentId));
    if (!studentId) return;
    const controller = new AbortController();
    api("/reports/debts?studentId=" + studentId, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          const rows = result.items
            .flatMap((r) => r.invoices)
            .sort(
              (a, b) =>
                a.period.localeCompare(b.period) ||
                a.number.localeCompare(b.number),
            );
          setInvoices(rows);
          if (rows.length)
            setAllocations(
              Object.fromEntries(
                rows
                  .filter((row) => row.period === rows[0].period)
                  .map((row) => [
                    row.id,
                    amount(cents(row.amount) - cents(row.paidAmount)),
                  ]),
              ),
            );
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studentId]);
  const total = Object.values(allocations).reduce(
    (sum, a) => sum + (cents(a) ?? 0n),
    0n,
  );
  function blocked(invoice) {
    return invoices.some(
      (older) =>
        older.period < invoice.period &&
        (cents(allocations[older.id] ?? "0") ?? 0n) <
          cents(older.amount) - cents(older.paidAmount),
    );
  }
  const invalidOrder = invoices.some(
    (invoice) => invoice.id in allocations && blocked(invoice),
  );
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (invalidOrder)
        throw new Error("Mbyllni fillimisht muajt më të vjetër të papaguar.");
      if (
        !Object.keys(allocations).length ||
        Object.values(allocations).some((v) => !cents(v))
      )
        throw new Error(
          "Zgjidhni faturat dhe vendosni shuma pozitive me dy shifra dhjetore.",
        );
      const payment = await api("/payments", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          idempotencyKey: key,
          amount: amount(total),
          method,
          paidAt,
          notes,
          allocations: Object.entries(allocations).map(
            ([invoiceId, amount]) => ({ invoiceId, amount }),
          ),
        }),
      });
      window.dispatchEvent(new Event("billing-updated"));
      saved(payment);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className="modal wide" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <h2>Regjistro pagesë</h2>
          <button disabled={busy} onClick={close}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <Lookup
              endpoint="/students"
              label="Nxënësi"
              value={studentId}
              onChange={setStudentId}
            />
            <AttendanceSummary
              key={`${studentId}:${invoices[0]?.period ?? ""}`}
              studentId={studentId}
              initialPeriod={invoices[0]?.period}
              disabled={busy}
            />
            <div className="form-grid spaced">
              <label>
                Metoda
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="CASH">Para të gatshme</option>
                  <option value="BANK">Bankë</option>
                </select>
              </label>
              <label>
                Data e pagesës
                <input
                  type="date"
                  required
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </label>
            </div>
            <h3 className="section-label">
              Muajt e papaguar · më i vjetri i pari
            </h3>
            {loading && <p role="status">Duke kontrolluar muajt e papaguar…</p>}
            {invoices.length > 0 && (
              <p className="payment-order-note">
                Mbyllni fillimisht {monthLabel(invoices[0].period)}. Për të
                përfshirë muajin tjetër, mbuloni plotësisht faturat e muajve më
                të vjetër.
              </p>
            )}
            {invoices.map((i) => {
              const balance = amount(
                (cents(i.amount) ?? 0n) - (cents(i.paidAmount) ?? 0n),
              );
              return (
                <div className="allocation-row" key={i.id}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      disabled={!(i.id in allocations) && blocked(i)}
                      checked={i.id in allocations}
                      onChange={(e) =>
                        setAllocations((previous) => {
                          const next = { ...previous };
                          if (e.target.checked) next[i.id] = balance;
                          else delete next[i.id];
                          return next;
                        })
                      }
                    />
                    {monthLabel(i.period)} · {i.number}
                    <small>Mbetja: {balance} €</small>
                  </label>
                  {i.id in allocations && (
                    <input
                      aria-label={"Shuma për " + i.number}
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,2})?"
                      required
                      value={allocations[i.id]}
                      onChange={(e) =>
                        setAllocations({
                          ...allocations,
                          [i.id]: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              );
            })}
            {studentId && !loading && !error && !invoices.length && (
              <p>Nuk ka fatura të papaguara për këtë nxënës.</p>
            )}
            <label className="spaced">
              Shënime
              <textarea
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="payment-total">
              Totali i pagesës <strong>{amount(total)} €</strong>
            </div>
          </fieldset>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              Anulo
            </button>
            <button
              className="primary"
              disabled={busy || loading || invalidOrder || total === 0n}
            >
              {busy ? "Duke regjistruar…" : "Regjistro pagesën"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export default function Finance({ kind, user, openReview }) {
  const updates = useSchoolUpdates();
  const day = useSchoolDay();
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [period, setPeriod] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [newPayment, setNewPayment] = useState(false),
    [newInvoice, setNewInvoice] = useState(false),
    [invoiceDialog, setInvoiceDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState(null),
    [reason, setReason] = useState("");
  useDialog(() => setAction(null), busy, Boolean(action));
  useEffect(() => {
    setPage(1);
    setSearch("");
    setStatus("");
    setPeriod("");
  }, [kind]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        search,
        ...(kind === "invoices" && period ? { period } : {}),
        ...(kind === "invoices" && status ? { status } : {}),
      });
      api("/" + kind + "?" + params, { signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) setData(result);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, page, search, period, status, revision, updates]);
  async function doc(id, number) {
    try {
      await download(`/${kind}/${id}/pdf`, number + ".pdf", true);
    } catch (e) {
      setError(e.message);
    }
  }
  async function cancel(event) {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    try {
      await api(
        `/${kind}/${action.id}/${kind === "invoices" ? "void" : "reverse"}`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      setAction(null);
      setNotice("Veprimi u regjistrua në historik.");
      window.dispatchEvent(new Event("billing-updated"));
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FINANCAT · EUR</span>
          <h1>{kind === "invoices" ? "Faturat" : "Pagesat"}</h1>
          <p>
            {kind === "invoices"
              ? "Hap faturën, regjistro pagesën dhe printoje nga e njëjta dritare."
              : "Pagesa të plota ose të pjesshme, me historik të gjurmueshëm."}
          </p>
        </div>
        {(kind !== "invoices" || user.role === "ADMIN") && (
          <button
            className="primary"
            onClick={() =>
              kind === "invoices" ? setNewInvoice(true) : setNewPayment(true)
            }
          >
            <Plus size={18} />
            {kind === "invoices" ? "Regjistro faturën" : "Regjistro pagesë"}
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <section className={`card ${kind === "invoices" ? "invoice-list" : ""}`}>
        <div className="table-toolbar">
          <input
            aria-label="Kërko faturë ose pagesë"
            placeholder="Kërko numrin ose nxënësin…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {kind === "invoices" && (
            <>
              <input
                aria-label="Periudha"
                type="month"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              />
              <select
                aria-label="Statusi i faturave"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Të gjitha statuset</option>
                {Object.entries(labelStatus).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Numri</th>
                <th>Nxënësi</th>
                <th>
                  {kind === "invoices" ? "Kursi / Periudha" : "Data / Metoda"}
                </th>
                {kind === "invoices" && <th>Datat</th>}
                {kind === "invoices" && <th>Afati i pagesës</th>}
                <th>Shuma</th>
                {kind === "invoices" && <th>Paguar</th>}
                <th>{kind === "invoices" ? "Mbetja" : "Regjistruar nga"}</th>
                <th>Statusi</th>
                <th>Veprimet</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r) => (
                <tr
                  key={r.id}
                  onDoubleClick={() => {
                    if (kind === "invoices") setInvoiceDialog({ id: r.id });
                  }}
                >
                  <td>
                    {kind === "invoices" ? (
                      <button
                        className="invoice-number"
                        onClick={() => setInvoiceDialog({ id: r.id })}
                      >
                        {r.number}
                      </button>
                    ) : (
                      r.number
                    )}
                  </td>
                  <td>
                    <StudentLink id={r.studentId ?? r.student?.id}>
                      {r.studentName ??
                        `${r.student.firstName} ${r.student.lastName}`}
                    </StudentLink>
                  </td>
                  <td>
                    {kind === "invoices"
                      ? r.courseName + " · " + r.period
                      : r.paidAt.slice(0, 10) +
                        " · " +
                        (r.method === "CASH" ? "Para të gatshme" : "Bankë")}
                  </td>
                  {kind === "invoices" && (
                    <td>
                      <span title="Data e lëshimit të faturës">
                        {date(r.issuedAt)}
                      </span>
                      <small>
                        Pagesa: {r.lastPaidAt ? date(r.lastPaidAt) : "-"}
                      </small>
                    </td>
                  )}
                  {kind === "invoices" && (
                    <td>
                      {date(r.dueDate)}
                      <small>
                        <PaymentDeadline invoice={r} day={day} />
                      </small>
                    </td>
                  )}
                  <td>{money(r.amount)}</td>
                  {kind === "invoices" && <td>{money(r.paidAmount)}</td>}
                  <td>
                    {kind === "invoices" ? money(r.balance) : r.user.name}
                  </td>
                  <td>
                    {kind === "invoices"
                      ? labelStatus[r.status]
                      : r.reversedAt
                        ? "Anuluar"
                        : "Regjistruar"}
                  </td>
                  <td>
                    <div className="row-actions">
                      {kind === "invoices" && (
                        <>
                          <button
                            onClick={() => setInvoiceDialog({ id: r.id })}
                          >
                            Hap
                          </button>
                          {r.status !== "VOID" && Number(r.balance) > 0 && (
                            <button
                              className="pay-invoice"
                              onClick={() =>
                                setInvoiceDialog({ id: r.id, pay: true })
                              }
                            >
                              Paguaj
                            </button>
                          )}
                        </>
                      )}
                      <button
                        title="PDF / Printo"
                        aria-label={"Printo faturën " + r.number}
                        onClick={() => doc(r.id, r.number)}
                      >
                        <FileText size={17} />
                      </button>
                      {((kind === "invoices" &&
                        user.role === "ADMIN" &&
                        ["UNPAID"].includes(r.status)) ||
                        (kind === "payments" &&
                          user.role === "ADMIN" &&
                          !r.reversedAt)) && (
                        <button
                          onClick={() => {
                            setAction(r);
                            setReason("");
                          }}
                        >
                          Anulo
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && (
          <div className="empty">Nuk ka regjistrime për këto filtra.</div>
        )}
        <div className="pagination">
          <span>
            {data?.total ?? 0} regjistrime · Faqja {page}
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={!data || page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {newInvoice && (
        <NewInvoiceDialog
          close={() => setNewInvoice(false)}
          created={(invoice) => {
            setNewInvoice(false);
            setInvoiceDialog({ id: invoice.id, pay: true });
            setRevision((v) => v + 1);
          }}
        />
      )}
      {invoiceDialog && (
        <InvoiceDialog
          {...invoiceDialog}
          user={user}
          close={() => setInvoiceDialog(null)}
          saved={() => setRevision((v) => v + 1)}
        />
      )}
      {newPayment && (
        <PaymentEditor
          close={() => setNewPayment(false)}
          saved={(payment) => {
            setNewPayment(false);
            const nextPeriods = [
              ...new Set(
                payment.allocations
                  .filter((a) => a.invoice.status === "PAID")
                  .map((a) => {
                    const date = new Date(a.invoice.period + "-01T00:00:00Z");
                    date.setUTCMonth(date.getUTCMonth() + 1);
                    return date.toISOString().slice(0, 7);
                  }),
              ),
            ];
            setNotice(
              "Pagesa u regjistrua me sukses." +
                (nextPeriods.length
                  ? ` Muaji pasues: ${nextPeriods.join(", ")}. Kontrolloni listën Për aprovim për regjistrimet që vazhdojnë.`
                  : " Mbetja qëndron te faturat e papaguara."),
            );
            setRevision((v) => v + 1);
          }}
        />
      )}
      {action && (
        <div className="modal-backdrop">
          <section className="modal small" role="dialog" aria-modal="true">
            <h2>Anulo {action.number}</h2>
            <p>
              {kind === "payments"
                ? "Shuma do të hiqet nga faturat; pagesa ruhet në historik."
                : "Fatura ruhet në historik dhe hiqet nga detyrimet."}
            </p>
            <form onSubmit={cancel}>
              <label>
                Arsyeja
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  Mbyll
                </button>
                <button className="danger" disabled={busy}>
                  Konfirmo anulimin
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
