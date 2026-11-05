import { t } from "../services/i18n.js";
import { monthLabel } from "../services/format";

export default function MissingInvoiceMonths({ data, open = false }) {
  if (!data?.total) return null;
  return (
    <details className="missing-invoice-months" open={open}>
      <summary>{t("{0} muaj pa faturë — shiko muajt", [data.total])}</summary>
      <p>
        {t(
          "Për verifikim, pa u llogaritur si borxh. Kontrolloni datat e regjistrimit dhe pagesat jashtë sistemit para faturimit.",
        )}
      </p>
      {data.courses.map((course) => (
        <div className="history-row" key={course.courseId}>
          <strong>
            {course.courseName} · {t("{0} muaj pa faturë", [course.total])}
          </strong>
          {course.ranges.map((range) => (
            <span key={range.from}>
              {monthLabel(range.from)}
              {range.to !== range.from ? ` – ${monthLabel(range.to)}` : ""}
            </span>
          ))}
        </div>
      ))}
    </details>
  );
}
