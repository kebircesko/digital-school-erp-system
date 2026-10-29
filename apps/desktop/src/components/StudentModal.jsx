import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../services/api";
import { useDialog } from "../hooks/useDialog";
const empty = {
  firstName: "",
  lastName: "",
  birthDate: "",
  parentName: "",
  parentPhone: "",
  address: "",
  notes: "",
  status: "ACTIVE",
};
export default function StudentModal({ student, close, saved, readOnly }) {
  const [form, setForm] = useState(
      student === "new"
        ? empty
        : {
            firstName: student.firstName,
            lastName: student.lastName,
            birthDate: student.birthDate.slice(0, 10),
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            address: student.address ?? "",
            notes: student.notes ?? "",
            status: student.status,
          },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useDialog(close, busy);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api(
        student === "new" ? "/students" : `/students/${student.id}`,
        {
          method: student === "new" ? "POST" : "PATCH",
          body: JSON.stringify({
            ...form,
            ...(student === "new" ? {} : { version: student.version }),
          }),
        },
      );
      window.dispatchEvent(new Event("student-updated"));
      saved(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function field(key, label, type = "text", required = true, maxLength = 160) {
    return (
      <label>
        {label}
        <input
          autoFocus={key === "firstName"}
          disabled={readOnly || busy}
          type={type}
          required={required}
          maxLength={maxLength}
          value={form[key] ?? ""}
          max={
            type === "date" ? new Date().toISOString().slice(0, 10) : undefined
          }
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      </label>
    );
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">TË DHËNAT E NXËNËSIT</span>
            <h2 id="student-title">
              {student === "new"
                ? "Regjistro nxënës"
                : readOnly
                  ? "Profili i nxënësit"
                  : "Ndrysho nxënësin"}
            </h2>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Mbyll formularin"
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            {field("firstName", "Emri", "text", true, 80)}
            {field("lastName", "Mbiemri", "text", true, 80)}
            {field("birthDate", "Data e lindjes", "date")}
            <label>
              Statusi
              <select
                disabled={readOnly || busy}
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value,
                  })
                }
              >
                <option value="ACTIVE">Aktiv</option>
                <option value="INACTIVE">Joaktiv</option>
              </select>
            </label>
            {field("parentName", "Emri i prindit / kujdestarit")}
            {field("parentPhone", "Telefoni i prindit", "tel", true, 30)}
            <div className="full">
              {field("address", "Adresa", "text", false, 300)}
            </div>
            <label className="full">
              Shënime shtesë
              <textarea
                disabled={readOnly || busy}
                maxLength={2000}
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              {readOnly ? "Mbyll" : "Anulo"}
            </button>
            {!readOnly && (
              <button className="primary" disabled={busy}>
                {busy ? "Duke ruajtur…" : "Ruaj nxënësin"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
