import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "../services/api";
import { calendarDay } from "../services/format";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";

export default function AttendanceSummary({
  studentId,
  courseId,
  initialPeriod,
  disabled = false,
}) {
  const [period, setPeriod] = useState(
    initialPeriod || calendarDay().slice(0, 7),
  );
  const [state, setState] = useState(null);
  const [revision, setRevision] = useState(0);
  const updates = useSchoolUpdates();
  const key = `${studentId}:${courseId ?? ""}:${period}:${revision}:${updates}`;
  useEffect(() => {
    if (!studentId || !period) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      studentId,
      period,
      ...(courseId ? { courseId } : {}),
    });
    api(`/attendance/summary?${params}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ key, error: error.message });
      });
    return () => controller.abort();
  }, [key, studentId, courseId, period]);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  if (!studentId) return null;
  const current = state?.key === key ? state : null;
  return (
    <section
      className="payment-attendance"
      aria-label="Vijueshmëria për pagesën"
    >
      <div className="payment-attendance-heading">
        <div>
          <h3>Vijueshmëria</h3>
          <p>Kontrolloni P, A, U dhe T për muajin përpara pagesës.</p>
        </div>
        <label>
          Muaji i vijueshmërisë
          <input
            aria-label="Muaji i vijueshmërisë"
            type="month"
            value={period}
            disabled={disabled}
            onChange={(event) => setPeriod(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary"
          aria-label="Rifresko vijueshmërinë"
          disabled={disabled}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {!period ? (
        <p>Zgjidhni muajin që dëshironi të kontrolloni.</p>
      ) : !current ? (
        <p role="status">Duke ngarkuar vijueshmërinë për {period}…</p>
      ) : current.error ? (
        <p className="error" role="alert">
          {current.error}
        </p>
      ) : current.data.items.length ? (
        current.data.items.map((row) => (
          <div className="attendance-course-summary" key={row.courseId}>
            <strong>
              {row.courseName} · {period}
            </strong>
            <dl className="attendance-status-counts">
              {[
                ["P", "Prezent"],
                ["A", "Mungesa"],
                ["U", "E papërcaktuar"],
                ["T", "Vonesë"],
              ].map(([code, label]) => (
                <div
                  key={code}
                  className={`attendance-count-${code.toLowerCase()}`}
                >
                  <dt>
                    {code} · {label}
                  </dt>
                  <dd>{row.counts[code] ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="attendance-source">
              {row.totalLessons} orë gjithsej
              {row.counts.unmarked > 0
                ? ` · ${row.counts.unmarked} pa shënim`
                : ""}{" "}
              · Burimi: {row.sourceFile}
            </p>
            {!row.hasStatusBreakdown && (
              <p className="attendance-source">
                Importi Excel me numra jep P/A; U dhe T nuk janë regjistruar në
                atë model.
              </p>
            )}
          </div>
        ))
      ) : (
        <p className="attendance-no-data">
          Nuk ka vijueshmëri të ngarkuar për {period}
          {courseId ? " për këtë kurs" : " për këtë nxënës"}. Ngarkojeni te
          Faturat e muajit.
        </p>
      )}
      {initialPeriod && initialPeriod !== period && (
        <p className="attendance-source">
          Muaji i faturës për këtë pagesë: {initialPeriod}.
        </p>
      )}
    </section>
  );
}
