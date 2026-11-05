import { t } from "../services/i18n.js";
import { useState, useEffect } from "react";
import { api } from "../services/api";
import SortableHeader from "./SortableHeader";
import { Bell } from "lucide-react";
import { date } from "../services/format";
import PaymentDeadline, { useSchoolDay } from "./PaymentDeadline";
import { InvoiceDialog } from "./InvoiceDialog";
import StudentLink from "./StudentLink";
import WhatsAppReminder from "./WhatsAppReminder";
export default function PaymentReminders({ reminders, refresh }) {
  const [tab, setTab] = useState(
    reminders.upcoming.total ? "upcoming" : "overdue",
  );
  const [invoiceAction, setInvoiceAction] = useState(null);
  const [sort, setSort] = useState(null);
  const [sorted, setSorted] = useState(null);
  const [error, setError] = useState("");
  const day = useSchoolDay();
  useEffect(() => {
    if (!sort) return;
    const controller = new AbortController();
    setSorted(null);
    setError("");
    api(`/dashboard/payment-reminders?sort=${sort.key}:${sort.direction}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setSorted(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [sort, reminders, day]);
  function sortColumn(key) {
    setSort((previous) => ({
      key,
      direction:
        previous?.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  }
  const group = (sorted ?? reminders)[tab];
  return (
    <section
      id="payment-reminders"
      className="card payment-reminders"
      aria-label={t("Njoftimet e pagesave")}
    >
      <div className="card-heading">
        <div>
          <h2>
            <Bell size={18} aria-hidden="true" />
            {t(" Njoftimet e pagesave")}
          </h2>
          <p>
            {t(
              "Faturat e papaguara ose pjesërisht të paguara, sipas afatit të pagesës.",
            )}
          </p>
        </div>
      </div>
      <div className="reminder-filters" aria-label={t("Filtro afatet")}>
        <button
          className="secondary"
          aria-pressed={tab === "upcoming"}
          onClick={() => setTab("upcoming")}
        >
          {t("Sot dhe 7 ditët e ardhshme (")}
          {reminders.upcoming.total})
        </button>
        <button
          className="secondary"
          aria-pressed={tab === "overdue"}
          onClick={() => setTab("overdue")}
        >
          {t("Me vonesë (")}
          {reminders.overdue.total})
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sort && !sorted && !error ? (
        <p className="empty" role="status">
          {t("Duke ngarkuar…")}
        </p>
      ) : group.items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  ["studentName", "Nxënësi / Kursi"],
                  ["dueDate", "Afati"],
                  ["days", "Ditët"],
                  ["balance", "Mbetja"],
                  ["number", "Fatura"],
                ].map(([key, label]) => (
                  <SortableHeader
                    key={key}
                    column={key}
                    label={t(label)}
                    sort={sort ?? { key: "dueDate", direction: "asc" }}
                    onSort={sortColumn}
                  />
                ))}
                <th>{t("Veprime")}</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    <button
                      className="student-link"
                      title={t("Hap pagesën e këtij nxënësi")}
                      onClick={() =>
                        setInvoiceAction({
                          id: invoice.id,
                          pay: true,
                        })
                      }
                    >
                      {invoice.studentName}
                    </button>
                    <small>
                      {invoice.courseName} · {invoice.period}
                    </small>
                  </td>
                  <td>{date(invoice.dueDate)}</td>
                  <td>
                    <PaymentDeadline invoice={invoice} day={day} />
                  </td>
                  <td>{invoice.balance} €</td>
                  <td>
                    <button
                      className="invoice-number"
                      onClick={() =>
                        setInvoiceAction({
                          id: invoice.id,
                          pay: false,
                        })
                      }
                    >
                      {invoice.number}
                    </button>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="primary"
                        onClick={() =>
                          setInvoiceAction({
                            id: invoice.id,
                            pay: true,
                          })
                        }
                      >
                        {t("Paguaj")}
                      </button>
                      <StudentLink id={invoice.studentId}>
                        {t("Profili")}
                      </StudentLink>
                      <WhatsAppReminder invoice={invoice} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {group.total > group.items.length && (
            <p className="reminder-limit">
              {t("Shfaqen ")}
              {group.items.length}
              {t(" nga ")}
              {group.total}
              {t(" fatura. Listën e plotë e gjeni te Faturat.")}
            </p>
          )}
        </div>
      ) : (
        <p className="empty">
          {tab === "upcoming"
            ? t("Nuk ka pagesa me afat brenda 7 ditëve.")
            : t("Nuk ka pagesa me vonesë.")}
        </p>
      )}
      {invoiceAction && (
        <InvoiceDialog
          id={invoiceAction.id}
          pay={invoiceAction.pay}
          close={() => setInvoiceAction(null)}
          saved={refresh}
        />
      )}
    </section>
  );
}
