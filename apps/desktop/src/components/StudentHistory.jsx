import { useEffect, useState } from "react";
import { useDialog } from "../hooks/useDialog";
import { api, download } from "../services/api";
import { InvoiceDialog } from "./InvoiceDialog";
import OutstandingMonths from "./OutstandingMonths";
import { date } from "../services/format";
export default function StudentHistory({
  id,
  name,
  close,
  student,
  edit,
  enroll,
}) {
  const [invoice, setInvoice] = useState(null);
  const [revision, setRevision] = useState(0);
  useDialog(close, false, !invoice);
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/students/" + id + "/history", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, revision]);
  async function document(kind, row) {
    try {
      await download(`/${kind}/${row.id}/pdf`, row.number + ".pdf", true);
    } catch (e) {
      setError(e.message);
    }
  }
  if (invoice)
    return (
      <InvoiceDialog
        id={invoice.id}
        pay={invoice.pay}
        close={() => setInvoice(null)}
        saved={() => setRevision((v) => v + 1)}
      />
    );
  return (
    <div className="modal-backdrop">
      <section
        className="modal wide"
        role="dialog"
        aria-modal="true"
        aria-label={`Profili · ${name}`}
      >
        <div className="modal-heading">
          <h2>
            {student ? "Profili" : "Historiku"} · {name}
          </h2>
          <button aria-label="Mbyll historikun" onClick={close}>
            ×
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {student && (
          <>
            <dl className="invoice-facts">
              <div>
                <dt>Datëlindja</dt>
                <dd>{date(student.birthDate)}</dd>
              </div>
              <div>
                <dt>Statusi</dt>
                <dd>{student.status === "ACTIVE" ? "Aktiv" : "Joaktiv"}</dd>
              </div>
              <div>
                <dt>Prindi / Kujdestari</dt>
                <dd>{student.parentName}</dd>
              </div>
              <div>
                <dt>Telefoni</dt>
                <dd>{student.parentPhone}</dd>
              </div>
            </dl>
            {enroll && (
              <button className="primary" onClick={enroll}>
                Regjistro në kurs / grup
              </button>
            )}
            {edit && (
              <button className="secondary" onClick={edit}>
                Ndrysho të dhënat
              </button>
            )}
          </>
        )}
        {!data && !error && <p role="status">Duke ngarkuar historikun…</p>}
        {data?.invoices && (
          <OutstandingMonths
            invoices={data.invoices.filter(
              (row) =>
                ["UNPAID", "PARTIAL"].includes(row.status) &&
                Number(row.amount) > Number(row.paidAmount),
            )}
            open={(row) => setInvoice({ id: row.id, pay: true })}
          />
        )}
        <h3 className="section-label">Kurset dhe regjistrimet</h3>
        {data?.enrollments.map((e) => (
          <div className="history-row" key={e.id}>
            <strong>
              {e.course.name} / {e.group.name}
            </strong>
            <small>
              {e.startDate.slice(0, 10)} →{" "}
              {e.endDate?.slice(0, 10) ?? "Pa afat"}
            </small>
            {e.monthlyPrice !== undefined && (
              <span>
                {e.monthlyPrice} € · Zbritja {e.discount} €
              </span>
            )}
          </div>
        ))}
        {data?.invoices && (
          <>
            <h3 className="section-label">Faturat dhe detyrimet</h3>
            {data.invoices.map((i) => (
              <div className="history-row" key={i.id}>
                <button
                  className="text-button"
                  onClick={() => setInvoice({ id: i.id, pay: false })}
                >
                  {i.number} · {i.period}
                </button>
                <button
                  className="text-button"
                  onClick={() => document("invoices", i)}
                >
                  PDF / Printo
                </button>
                <span>
                  {i.amount} € · Paguar {i.paidAmount} €
                </span>
                {["UNPAID", "PARTIAL"].includes(i.status) &&
                  Number(i.amount) > Number(i.paidAmount) && (
                    <button
                      className="primary"
                      onClick={() => setInvoice({ id: i.id, pay: true })}
                    >
                      Paguaj
                    </button>
                  )}
              </div>
            ))}
          </>
        )}
        {data?.payments && (
          <>
            <h3 className="section-label">Pagesat</h3>
            {data.payments.map((p) => (
              <div className="history-row" key={p.id}>
                <button
                  className="text-button"
                  onClick={() => document("payments", p)}
                >
                  {p.number} · PDF
                </button>
                <span>
                  {p.amount} € ·{" "}
                  {p.method === "CASH" ? "Para të gatshme" : "Bankë"} ·{" "}
                  {p.user.name}
                  {p.reversedAt ? " · Anuluar" : ""}
                </span>
              </div>
            ))}
          </>
        )}
        <div className="modal-actions">
          <button className="secondary" onClick={close}>
            Mbyll
          </button>
        </div>
      </section>
    </div>
  );
}
