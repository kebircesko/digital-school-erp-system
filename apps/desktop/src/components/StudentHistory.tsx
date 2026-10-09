import { useEffect, useState } from "react";
import { api, download } from "../services/api";
import { Row } from "../pages/resources";
export default function StudentHistory({
  id,
  name,
  close,
}: {
  id: string;
  name: string;
  close: () => void;
}) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<Row>("/students/" + id + "/history", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id]);
  async function document(kind: string, row: Row) {
    try {
      await download(`/${kind}/${row.id}/pdf`, row.number + ".pdf", true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className="modal wide" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <h2>Historiku · {name}</h2>
          <button aria-label="Mbyll historikun" onClick={close}>
            ×
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <h3 className="section-label">Kurset dhe regjistrimet</h3>
        {data?.enrollments.map((e: Row) => (
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
            {data.invoices.map((i: Row) => (
              <div className="history-row" key={i.id}>
                <button
                  className="text-button"
                  onClick={() => document("invoices", i)}
                >
                  {i.number} · {i.period} · PDF
                </button>
                <span>
                  {i.amount} € · Paguar {i.paidAmount} €
                </span>
              </div>
            ))}
          </>
        )}
        {data?.payments && (
          <>
            <h3 className="section-label">Pagesat</h3>
            {data.payments.map((p: Row) => (
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
