import { t } from "../services/i18n.js";
import { useState } from "react";
import { Bell } from "lucide-react";
import { date } from "../services/format";
import PaymentDeadline, { useSchoolDay } from "./PaymentDeadline";
import { InvoiceDialog } from "./InvoiceDialog";
import StudentLink from "./StudentLink";
export default function PaymentReminders({ reminders, refresh }) {
  const [tab, setTab] = useState(
    reminders.upcoming.total ? "upcoming" : "overdue",
  );
  const [invoiceAction, setInvoiceAction] = useState(null);
  const day = useSchoolDay();
  const group = reminders[tab];
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
      {group.items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Nxënësi / Kursi")}</th>
                <th>{t("Afati")}</th>
                <th>{t("Ditët")}</th>
                <th>{t("Mbetja")}</th>
                <th>{t("Fatura")}</th>
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
              {t(
                " fatura, me afatet më të hershme. Listën e plotë e gjeni te Faturat.",
              )}
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
