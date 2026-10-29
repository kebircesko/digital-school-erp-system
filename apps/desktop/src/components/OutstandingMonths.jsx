import { monthLabel } from "../services/format";
export default function OutstandingMonths({ invoices, selectedId, open }) {
  if (!invoices.length) return null;
  const rows = [...invoices].sort(
    (a, b) =>
      a.period.localeCompare(b.period) || a.number.localeCompare(b.number),
  );
  const oldest = rows[0].period;
  return (
    <section className="outstanding-months" aria-label="Muajt e papaguar">
      <h3>Muajt e papaguar</h3>
      <p>
        Mbyllni fillimisht {monthLabel(oldest)}. Pastaj mund të vazhdoni me
        muajin tjetër.
      </p>
      {rows.map((row) => (
        <div className="outstanding-month" key={row.id}>
          <div>
            <strong>{monthLabel(row.period)}</strong>
            <small>
              {row.courseName} · {row.number}
            </small>
          </div>
          <span>
            {Number(
              row.balance ?? Number(row.amount) - Number(row.paidAmount),
            ).toFixed(2)}{" "}
            €
          </span>
          {open && (
            <button
              type="button"
              className="secondary"
              disabled={row.period !== oldest || row.id === selectedId}
              onClick={() => open(row)}
            >
              {row.id === selectedId
                ? "Fatura e hapur"
                : row.period === oldest
                  ? "Paguaj këtë muaj"
                  : "Pas muajit paraprak"}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
