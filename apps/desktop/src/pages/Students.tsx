import StudentHistory from "../components/StudentHistory";
import { useDialog } from "../hooks/useDialog";
import { useState, useEffect, FormEvent } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { User, Student, StudentInput, StudentPage } from "@erp/shared";
import { api } from "../services/api";
import { date } from "../services/format";
import Badge from "../components/Badge";
const empty: StudentInput = {
  firstName: "",
  lastName: "",
  birthDate: "",
  parentName: "",
  parentPhone: "",
  address: "",
  notes: "",
  status: "ACTIVE",
};
export default function StudentsPage({ user }: { user: User }) {
  const [data, setData] = useState<StudentPage | null>(null),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("name"),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<Student | "new" | null>(null),
    [history, setHistory] = useState<Student | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [deleting, setDeleting] = useState<Student | null>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    api<StudentPage>(
      `/students?${new URLSearchParams({ search: query, status, sort, page: String(page) })}`.replace(
        "status=&",
        "",
      ),
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [query, status, sort, page, revision]);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/students/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setNotice("Nxënësi u fshi me sukses.");
      setPage(1);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }
  const canWrite = user.role !== "INSTRUCTOR";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MENAXHIMI I SHKOLLËS</span>
          <h1>Nxënësit</h1>
          <p>Të dhënat dhe kontaktet e çdo nxënësi, gjithmonë pranë jush.</p>
        </div>
        {canWrite && (
          <button className="primary" onClick={() => setEditing("new")}>
            <Plus size={18} />
            Regjistro nxënës
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setRevision((v) => v + 1)}>
            Provo përsëri
          </button>
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          <CheckCircle2 size={17} />
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <section className="card student-table">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Kërko nxënës"
              placeholder="Kërko emër, prind ose telefon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Filtro statusin"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Të gjithë statuset</option>
            <option value="ACTIVE">Aktivë</option>
            <option value="INACTIVE">Joaktivë</option>
          </select>
          <select
            aria-label="Rendit nxënësit"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="name">Sipas mbiemrit</option>
            <option value="newest">Më të rinjtë</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nxënësi</th>
                <th>Datëlindja</th>
                <th>Prindi / Kujdestari</th>
                <th>Telefoni</th>
                <th>Statusi</th>
                <th>Veprime</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="name-cell">
                      <div className="student-avatar">
                        {s.firstName[0]}
                        {s.lastName[0]}
                      </div>
                      <strong>
                        {s.firstName} {s.lastName}
                      </strong>
                    </div>
                  </td>
                  <td>{date(s.birthDate)}</td>
                  <td>{s.parentName}</td>
                  <td>{s.parentPhone}</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        title="Historiku i nxënësit"
                        onClick={() => setHistory(s)}
                      >
                        Historiku
                      </button>
                      <button
                        title={
                          canWrite ? "Ndrysho të dhënat" : "Shiko të dhënat"
                        }
                        onClick={() => setEditing(s)}
                      >
                        <Pencil size={16} />
                      </button>
                      {user.role === "ADMIN" && (
                        <button
                          title="Fshi nxënësin"
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data && !error && (
          <div className="empty">Duke ngarkuar nxënësit…</div>
        )}
        {data && !data.items.length && (
          <div className="empty">
            <Users size={34} />
            <h3>Nuk u gjetën nxënës</h3>
            <p>
              {query || status
                ? "Provoni një kërkim ose filtër tjetër."
                : "Regjistroni nxënësin e parë për të filluar."}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {data?.total ?? 0} nxënës · Faqja {page} nga {data?.pages ?? 1}
          </span>
          <div>
            <button
              aria-label="Faqja e mëparshme"
              disabled={page <= 1 || !data}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Faqja tjetër"
              disabled={!data || page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {history && (
        <StudentHistory
          id={history.id}
          name={`${history.firstName} ${history.lastName}`}
          close={() => setHistory(null)}
        />
      )}
      {editing && (
        <StudentModal
          student={editing}
          readOnly={!canWrite}
          close={() => setEditing(null)}
          saved={() => {
            setEditing(null);
            setNotice("Të dhënat u ruajtën me sukses.");
            setRevision((v) => v + 1);
          }}
        />
      )}
      {deleting && (
        <div className="modal-backdrop">
          <section
            className="modal small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Fshi nxënësin?</h2>
            <p>
              Regjistrimi i {deleting.firstName} {deleting.lastName} do të
              fshihet përgjithmonë. Ky veprim nuk mund të zhbëhet.
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Anulo
              </button>
              <button className="danger" disabled={busy} onClick={remove}>
                {busy ? "Duke fshirë…" : "Fshi nxënësin"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
function StudentModal({
  student,
  close,
  saved,
  readOnly,
}: {
  student: Student | "new";
  close: () => void;
  saved: () => void;
  readOnly: boolean;
}) {
  const [form, setForm] = useState<StudentInput>(
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
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(student === "new" ? "/students" : `/students/${student.id}`, {
        method: student === "new" ? "POST" : "PATCH",
        body: JSON.stringify({
          ...form,
          ...(student === "new" ? {} : { version: student.version }),
        }),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function field(
    key: keyof StudentInput,
    label: string,
    type = "text",
    required = true,
    maxLength = 160,
  ) {
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
                    status: e.target.value as StudentInput["status"],
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
