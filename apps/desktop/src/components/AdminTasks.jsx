import DateInput from "./DateInput";
import { useState, useEffect } from "react";
import { t, tm } from "../services/i18n.js";
import { api } from "../services/api";
import { calendarDay, date } from "../services/format";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import StudentLink from "./StudentLink";
import Lookup from "./Lookup";
import { useSchoolDay } from "./PaymentDeadline";

export default function AdminTasks({ studentId, compact = false, openAll }) {
  const day = useSchoolDay();
  const updates = useSchoolUpdates();
  const [status, setStatus] = useState("open");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api(
      `/admin-tools/tasks?${new URLSearchParams({ status, ...(studentId ? { studentId } : {}) })}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setRows(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [status, studentId, updates]);
  async function save(row, completed) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin-tools/tasks${row.id ? `/${row.id}` : ""}`, {
        method: row.id ? "PATCH" : "POST",
        body: JSON.stringify({
          title: row.title,
          notes: row.notes,
          dueDate: row.dueDate.slice(0, 10),
          ...(row.studentId ? { studentId: row.studentId } : {}),
          ...(row.id ? { version: row.version, completed } : {}),
        }),
      });
      setEditing(null);
      window.dispatchEvent(new Event("admin-tasks-updated"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const due =
    rows?.filter((row) => !row.completedAt && row.dueDate.slice(0, 10) <= day)
      .length ?? 0;
  return (
    <section className="card admin-tasks">
      <div className="card-heading">
        <div>
          <h2>{t("Detyrat dhe rikujtimet")}</h2>
          {due > 0 && (
            <p className="task-due">
              {t("{0} detyra për sot ose me vonesë", [due])}
            </p>
          )}
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            setEditing({
              title: "",
              notes: "",
              dueDate: calendarDay(),
              studentId: studentId ?? "",
            })
          }
        >
          {t("Shto detyrë")}
        </button>
      </div>
      {!compact && (
        <label>
          {t("Statusi")}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">{t("Të hapura")}</option>
            <option value="done">{t("Të përfunduara")}</option>
            <option value="all">{t("Të gjitha")}</option>
          </select>
        </label>
      )}
      {editing && (
        <form
          className="task-editor"
          onSubmit={(e) => {
            e.preventDefault();
            save(editing, Boolean(editing.completedAt));
          }}
        >
          <fieldset disabled={busy} className="workflow-fields">
            <div className="form-grid">
              <label>
                {t("Detyra")}
                <input
                  autoFocus
                  required
                  maxLength={160}
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <label>
                {t("Afati")}
                <DateInput
                  required
                  value={editing.dueDate.slice(0, 10)}
                  onChange={(e) =>
                    setEditing({ ...editing, dueDate: e.target.value })
                  }
                />
              </label>
            </div>
            {!studentId && (
              <>
                <label className="workflow-check">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.linkStudent || editing.studentId)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        linkStudent: e.target.checked,
                        studentId: "",
                      })
                    }
                  />
                  {t("Lidhe me një nxënës")}
                </label>
                {(editing.linkStudent || editing.studentId) && (
                  <Lookup
                    endpoint="/students"
                    label={t("Nxënësi")}
                    value={editing.studentId}
                    initialLabel={
                      editing.student
                        ? `${editing.student.firstName} ${editing.student.lastName}`
                        : ""
                    }
                    onChange={(id) => setEditing({ ...editing, studentId: id })}
                  />
                )}
              </>
            )}
            <label>
              {t("Shënime")}
              <textarea
                rows={2}
                maxLength={2000}
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(null)}
              >
                {t("Anulo")}
              </button>
              <button className="primary">
                {busy ? t("Duke ruajtur…") : t("Ruaj detyrën")}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {tm(error)}
        </p>
      )}
      {!rows && !error && <p role="status">{t("Duke ngarkuar…")}</p>}
      {rows?.length === 0 && (
        <p className="empty">{t("Nuk ka detyra për këto filtra.")}</p>
      )}
      {(compact ? rows?.slice(0, 5) : rows)?.map((row) => (
        <div className="task-row" key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <small
              className={
                !row.completedAt && row.dueDate.slice(0, 10) <= day
                  ? "task-due"
                  : ""
              }
            >
              {date(row.dueDate)} · {row.user.name}
            </small>
            {row.student && (
              <StudentLink id={row.studentId}>
                {row.student.firstName} {row.student.lastName}
              </StudentLink>
            )}
            {row.notes && <p className="task-notes">{row.notes}</p>}
          </div>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setEditing(row)}
            >
              {t("Ndrysho")}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => save(row, !row.completedAt)}
            >
              {row.completedAt ? t("Rihap detyrën") : t("Përfundo")}
            </button>
          </div>
        </div>
      ))}
      {compact && openAll && (
        <button className="text-button" onClick={openAll}>
          {t("Të gjitha detyrat")}
        </button>
      )}
    </section>
  );
}
