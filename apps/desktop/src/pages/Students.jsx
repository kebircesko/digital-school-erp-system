import { t, tm } from "../services/i18n.js";
import StudentHistory from "../components/StudentHistory";
import StudentModal from "../components/StudentModal";
import StudentLink from "../components/StudentLink";
import { useDialog } from "../hooks/useDialog";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { api } from "../services/api";
import { date } from "../services/format";
import Badge from "../components/Badge";
export default function StudentsPage({
  user,
  initialStatus = "",
  initialSearch = "",
}) {
  const updates = useSchoolUpdates();
  const [data, setData] = useState(null),
    [search, setSearch] = useState(initialSearch),
    [query, setQuery] = useState(initialSearch),
    [status, setStatus] = useState(initialStatus),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState(null),
    [history, setHistory] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [deleting, setDeleting] = useState(null),
    [busy, setBusy] = useState(false);
  useDialog(() => setDeleting(null), busy, Boolean(deleting));
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
    api(
      `/students?${new URLSearchParams({
        search: query,
        status,
        sort,
        page: String(page),
      })}`.replace("status=&", ""),
      {
        signal: controller.signal,
      },
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [query, status, sort, page, revision, updates]);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/students/${deleting.id}`, {
        method: "DELETE",
      });
      setDeleting(null);
      setNotice(t("Nxënësi u fshi me sukses."));
      setPage(1);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e.message);
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
          <span className="eyebrow">{t("MENAXHIMI I SHKOLLËS")}</span>
          <h1>{t("Nxënësit")}</h1>
          <p>
            {t("Të dhënat dhe kontaktet e çdo nxënësi, gjithmonë pranë jush.")}
          </p>
        </div>
        {canWrite && (
          <button className="primary" onClick={() => setEditing("new")}>
            <Plus size={18} />
            {t("Regjistro nxënës")}
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
          <button onClick={() => setRevision((v) => v + 1)}>
            {t("Provo përsëri")}
          </button>
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          <CheckCircle2 size={17} />
          {tm(notice)}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <section className="card student-table">
        <div className="table-toolbar">
          <div className="search">
            <Search size={18} />
            <input
              aria-label={t("Kërko nxënës")}
              placeholder={t("Kërko emër, prind ose telefon…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label={t("Filtro statusin")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("Të gjithë statuset")}</option>
            <option value="ACTIVE">{t("Aktivë")}</option>
            <option value="INACTIVE">{t("Joaktivë")}</option>
          </select>
          <select
            aria-label={t("Rendit nxënësit")}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="newest">{t("Më të rinjtë")}</option>
            <option value="name">{t("Sipas mbiemrit")}</option>
            <option value="oldest">{t("Më të vjetrit")}</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("Nxënësi")}</th>
                <th>{t("Datëlindja")}</th>
                <th>{t("Prindi / Kujdestari")}</th>
                <th>{t("Telefoni")}</th>
                <th>{t("Statusi")}</th>
                <th>{t("Veprime")}</th>
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
                      <StudentLink id={s.id}>
                        <strong>
                          {s.firstName} {s.lastName}
                        </strong>
                      </StudentLink>
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
                      <StudentLink id={s.id}>
                        {t("Profili / Pagesat")}
                      </StudentLink>
                      <button
                        title={t("Historiku i nxënësit")}
                        onClick={() => setHistory(s)}
                      >
                        {t("Historiku")}
                      </button>
                      <button
                        title={
                          canWrite
                            ? t("Ndrysho të dhënat")
                            : t("Shiko të dhënat")
                        }
                        onClick={() => setEditing(s)}
                      >
                        <Pencil size={16} />
                      </button>
                      {user.role === "ADMIN" && (
                        <button
                          title={t("Fshi nxënësin")}
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
          <div className="empty">{t("Duke ngarkuar nxënësit…")}</div>
        )}
        {data && !data.items.length && (
          <div className="empty">
            <Users size={34} />
            <h3>{t("Nuk u gjetën nxënës")}</h3>
            <p>
              {query || status
                ? t("Provoni një kërkim ose filtër tjetër.")
                : t("Regjistroni nxënësin e parë për të filluar.")}
            </p>
          </div>
        )}
        <div className="pagination">
          <span>
            {data?.total ?? 0}
            {t(" nxënës · Faqja ")}
            {page}
            {t(" nga ")}
            {data?.pages ?? 1}
          </span>
          <div>
            <button
              aria-label={t("Faqja e mëparshme")}
              disabled={page <= 1 || !data}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label={t("Faqja tjetër")}
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
            setNotice(t("Të dhënat u ruajtën me sukses."));
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
            <h2 id="delete-title">{t("Fshi nxënësin?")}</h2>
            <p>
              {t("Regjistrimi i ")}
              {deleting.firstName} {deleting.lastName}
              {t(" do të fshihet përgjithmonë. Ky veprim nuk mund të zhbëhet.")}
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                {t("Anulo")}
              </button>
              <button className="danger" disabled={busy} onClick={remove}>
                {busy ? t("Duke fshirë…") : t("Fshi nxënësin")}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
