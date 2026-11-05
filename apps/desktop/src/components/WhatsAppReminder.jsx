import { useState, useEffect } from "react";
import { t, getLanguage } from "../services/i18n.js";
import { date } from "../services/format";
import { whatsappUrl } from "../services/payment-reminder";

export default function WhatsAppReminder({ invoice }) {
  const phone = invoice.student?.parentPhone ?? invoice.parentPhone ?? "";
  const initial = t(
    "Përshëndetje {0}, ju kujtojmë se për nxënësin {1}, fatura {2} për muajin {3} ka mbetje {4} €. Afati i pagesës: {5}. Faleminderit, Shkolla Digjitale Prizren.",
    [
      invoice.student?.parentName ?? invoice.parentName ?? "",
      invoice.studentName,
      invoice.number,
      invoice.period,
      invoice.balance,
      date(invoice.dueDate),
    ],
  );
  const [number, setNumber] = useState(phone);
  const [message, setMessage] = useState(initial);
  const language = getLanguage();
  useEffect(() => {
    setNumber(phone);
  }, [phone]);
  useEffect(() => {
    setMessage(initial);
  }, [invoice.id, invoice.balance, invoice.dueDate, language]);
  if (
    !["UNPAID", "PARTIAL"].includes(invoice.status) ||
    Number(invoice.balance) <= 0
  )
    return null;
  const url = whatsappUrl(number, message);
  return (
    <details className="whatsapp-reminder">
      <summary className="secondary">{t("Kujtesë WhatsApp")}</summary>
      <div className="reminder-preview">
        <label>
          {t("Telefoni i prindit")}
          <input
            type="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <small>
          {t(
            "Numrat lokalë me 0 përdorin prefiksin +383. Për shtete të tjera vendosni kodin ndërkombëtar.",
          )}
        </small>
        <label>
          {t("Mesazhi për prindin")}
          <textarea
            rows={5}
            maxLength={3000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        {!url && (
          <p className="error">
            {t("Vendosni një numër telefoni të vlefshëm me kodin e shtetit.")}
          </p>
        )}
        {url && message.trim() && (
          <a
            className="primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Hap WhatsApp")}
          </a>
        )}
        <small>
          {t("Kontrolloni mesazhin dhe dërgojeni vetë në WhatsApp.")}
        </small>
      </div>
    </details>
  );
}
