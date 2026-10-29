import { useEffect, useState } from "react";
import Finance from "./Finance";
import BillingReview from "./BillingReview";

export default function InvoiceWorkspace({
  user,
  initialView = "list",
  initialPeriod,
}) {
  const [view, setView] = useState(initialView);
  useEffect(() => setView(initialView), [initialView, initialPeriod]);
  const tabs = [
    ["list", "Lista e faturave"],
    ["review", "Faturat e muajit"],
    ["payments", "Pagesat"],
  ];
  return (
    <>
      <div className="workspace-tabs" aria-label="Faturat dhe pagesat">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={view === id ? "active" : ""}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "review" ? (
        <BillingReview user={user} initialPeriod={initialPeriod} />
      ) : (
        <Finance
          key={view}
          user={user}
          kind={view === "payments" ? "payments" : "invoices"}
        />
      )}
    </>
  );
}
