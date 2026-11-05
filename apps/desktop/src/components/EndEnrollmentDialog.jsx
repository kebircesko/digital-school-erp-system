import { useState } from "react";
import { t, tm } from "../services/i18n.js";
import { api } from "../services/api";
import { calendarDay } from "../services/format";
import { useDialog } from "../hooks/useDialog";
import DateInput from "./DateInput";

export default function EndEnrollmentDialog({
  enrollment,
  name,
  close,
  saved,
}) {
  const [endDate, setEndDate] = useState(calendarDay);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useDialog(close, busy);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`/enrollments/${enrollment.id}/end`, {
        method: "PATCH",
        body: JSON.stringify({ endDate, version: enrollment.version }),
      });
      window.dispatchEvent(new Event("student-updated"));
      window.dispatchEvent(new Event("billing-updated"));
      saved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal small"
        role="dialog"
        aria-modal="true"
        aria-label={t("Largo nga grupi")}
      >
        <h2>{t("Largo nga grupi")}</h2>
        <p>
          <strong>{name}</strong> · {enrollment.group.name}
        </p>
        <p>
          {t(
            "Përfundon vetëm ky regjistrim. Nxënësi, grupet e tjera dhe faturat ekzistuese ruhen.",
          )}
        </p>
        <form onSubmit={submit}>
          <label>
            {t("Data e largimit")}
            <DateInput
              required
              min={enrollment.startDate.slice(0, 10)}
              max={calendarDay()}
              value={endDate}
              disabled={busy}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {tm(error)}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              {t("Anulo")}
            </button>
            <button className="primary" disabled={busy}>
              {busy ? t("Duke ruajtur…") : t("Largo nga grupi")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
