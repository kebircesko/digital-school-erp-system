import { t } from "../services/i18n.js";
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
    ["list", t("Lista e faturave")],
    ["review", t("Faturat e muajit")],
    ["payments", t("Pagesat")],
  ];
  return (
    <>
      <div className="workspace-tabs" aria-label={t("Faturat dhe pagesat")}>
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
