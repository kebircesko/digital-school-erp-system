import { t, tm } from "../services/i18n.js";
import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { api } from "../services/api";
import Lookup from "../components/Lookup";
import StudentLink from "../components/StudentLink";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import { useDialog } from "../hooks/useDialog";
import { getResources } from "./resources";
export function ResourceEditor({
  config,
  row,
  close,
  saved,
  initialValues = {},
  initialLabels = {},
}) {
  const [form, setForm] = useState(
      Object.fromEntries(
        config.fields.map((f) => [
          f.key,
          row === "new"
            ? (initialValues[f.key] ?? f.default ?? "")
            : (row[f.key] ?? f.default ?? ""),
        ]),
      ),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useDialog(close, busy);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = {
        ...form,
      };
      for (const f of config.fields) {
        if (f.type === "number") data[f.key] = Number(data[f.key]);
        if (
          f.required === false &&
          data[f.key] === "" &&
          ["password", "date"].includes(f.type ?? "")
        )
          delete data[f.key];
      }
      if (row !== "new" && row.version) data.version = row.version;
      await api(config.endpoint + (row === "new" ? "" : "/" + row.id), {
        method: row === "new" ? "POST" : "PATCH",
        body: JSON.stringify(data),
      });
      saved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function render(f) {
    if (f.endpoint)
      return (
        <Lookup
          key={f.key}
          endpoint={f.endpoint}
          label={f.label}
          value={form[f.key]}
          onChange={(id) =>
            setForm({
              ...form,
              [f.key]: id,
            })
          }
          initialLabel={
            row === "new" ? (initialLabels[f.key] ?? "") : f.initialLabel?.(row)
          }
        />
      );
    if (f.type === "days")
      return (
        <fieldset key={f.key}>
          <legend>{f.label}</legend>
          <div className="days-options">
            {[
              t("Hën"),
              t("Mar"),
              t("Mër"),
              t("Enj"),
              t("Pre"),
              t("Sht"),
              t("Die"),
            ].map((name, i) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={form.days.includes(i + 1)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      days: e.target.checked
                        ? [...form.days, i + 1].sort()
                        : form.days.filter((d) => d !== i + 1),
                    })
                  }
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
      );
    if (f.type === "checkbox")
      return (
        <label key={f.key} className="checkbox-label">
          <input
            type="checkbox"
            checked={form[f.key]}
            onChange={(e) =>
              setForm({
                ...form,
                [f.key]: e.target.checked,
              })
            }
          />
          {f.label}
        </label>
      );
    return (
      <label key={f.key}>
        {f.label}
        {f.type === "select" ? (
          <select
            aria-label={f.label}
            value={form[f.key]}
            onChange={(e) =>
              setForm({
                ...form,
                [f.key]: e.target.value,
              })
            }
          >
            {f.options?.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : f.type === "textarea" ? (
          <textarea
            aria-label={f.label}
            rows={3}
            value={form[f.key]}
            maxLength={3000}
            onChange={(e) =>
              setForm({
                ...form,
                [f.key]: e.target.value,
              })
            }
          />
        ) : (
          <input
            aria-label={f.label}
            required={f.required !== false}
            type={f.type === "money" ? "text" : (f.type ?? "text")}
            inputMode={f.type === "money" ? "decimal" : undefined}
            pattern={f.type === "money" ? "[0-9]+([.][0-9]{1,2})?" : undefined}
            min={f.type === "number" ? 1 : undefined}
            minLength={f.type === "password" ? 12 : undefined}
            maxLength={f.type === "password" ? 128 : 300}
            value={form[f.key]}
            onChange={(e) =>
              setForm({
                ...form,
                [f.key]: e.target.value,
              })
            }
          />
        )}
      </label>
    );
  }
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <h2>
            {row === "new" ? t("Shto") : t("Ndrysho")} {config.singular}
          </h2>
          <button
            className="icon-button"
            aria-label={t("Mbyll")}
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="form-grid">
            {config.fields.map(render)}
          </fieldset>
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
              {busy ? t("Duke ruajtur…") : t("Ruaj")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export default function ResourcePage({
  kind,
  user,
  navigate,
  context,
  initialStatus,
}) {
  const updates = useSchoolUpdates();
  const config = getResources()[kind],
    canWrite = user.role !== "INSTRUCTOR";
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(
      initialStatus ?? (kind === "groups" ? "ACTIVE" : ""),
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState(null),
    [action, setAction] = useState(null),
    [actionDate, setActionDate] = useState(""),
    [groupId, setGroupId] = useState(""),
    [busy, setBusy] = useState(false);
  useDialog(() => setAction(null), busy, Boolean(action));
  useEffect(() => {
    setPage(1);
    setSearch("");
    setStatus(initialStatus ?? (kind === "groups" ? "ACTIVE" : ""));
  }, [kind]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        search,
        ...(context?.groupId
          ? {
              groupId: context.groupId,
            }
          : {}),
        ...(context?.courseId
          ? {
              courseId: context.courseId,
            }
          : {}),
        ...(status
          ? {
              status,
            }
          : {}),
      });
      setError("");
      api(config.endpoint + "?" + params, {
        signal: controller.signal,
      })
        .then((result) => {
          if (!controller.signal.aborted) setData(result);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, page, search, status, revision, updates, context]);
  function saved() {
    setEditing(null);
    setAction(null);
    setNotice(t("Veprimi u krye me sukses."));
    setRevision((v) => v + 1);
  }
  async function perform(e) {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    setError("");
    try {
      if (action.kind === "delete")
        await api(config.endpoint + "/" + action.row.id, {
          method: "DELETE",
        });
      else if (action.kind === "end")
        await api(`/enrollments/${action.row.id}/end`, {
          method: "PATCH",
          body: JSON.stringify({
            endDate: actionDate,
            version: action.row.version,
          }),
        });
      else
        await api(`/enrollments/${action.row.id}/transfer`, {
          method: "POST",
          body: JSON.stringify({
            startDate: actionDate,
            groupId,
            version: action.row.version,
          }),
        });
      saved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("MENAXHIMI I SHKOLLËS")}</span>
          <h1>{config.title}</h1>
          <p>{t("Të dhëna të lidhura me databazën qendrore.")}</p>
        </div>
        {canWrite && (
          <button className="primary" onClick={() => setEditing("new")}>
            <Plus size={18} />
            {t("Shto ")}
            {config.singular}
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {tm(notice)}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {context && (
        <div className="context-filter" role="status">
          {t("Regjistrimet: ")}
          {context.label}
          <button className="text-button" onClick={() => navigate(kind)}>
            {t("Shiko të gjitha")}
          </button>
        </div>
      )}
      <section className="card">
        <div className="table-toolbar">
          <input
            aria-label={t("Kërko")}
            placeholder={t("Kërko…")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {config.status && (
            <select
              aria-label={t("Filtro statusin")}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("Të gjitha statuset")}</option>
              <option value="ACTIVE">{t("Aktivë")}</option>
              <option value="INACTIVE">{t("Joaktivë")}</option>
            </select>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {config.columns.map((c) => (
                  <th key={c.label}>{c.label}</th>
                ))}
                {canWrite && <th>{t("Veprime")}</th>}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((c) => (
                    <td key={c.label}>
                      {kind === "enrollments" && c.label === t("Nxënësi") ? (
                        <StudentLink id={row.studentId ?? row.student?.id}>
                          {c.render(row)}
                        </StudentLink>
                      ) : ["courses", "groups"].includes(kind) &&
                        c.label ===
                          (kind === "courses" ? t("Kursi") : t("Grupi")) ? (
                        <button
                          className="student-link"
                          title={t("Shiko nxënësit dhe regjistrimet")}
                          onClick={() =>
                            navigate("enrollments", {
                              context: {
                                [kind === "courses" ? "courseId" : "groupId"]:
                                  row.id,
                                label: row.name,
                              },
                            })
                          }
                        >
                          {c.render(row)}
                        </button>
                      ) : (
                        c.render(row)
                      )}
                    </td>
                  ))}
                  {canWrite && (
                    <td>
                      <div className="row-actions">
                        {config.editable !== false && (
                          <button
                            title={t("Ndrysho")}
                            onClick={() => setEditing(row)}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                        {config.deletable && user.role === "ADMIN" && (
                          <button
                            title={t("Fshi")}
                            onClick={() =>
                              setAction({
                                row,
                                kind: "delete",
                              })
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {kind === "enrollments" && row.status === "ACTIVE" && (
                          <>
                            <button
                              onClick={() => {
                                setAction({
                                  row,
                                  kind: "transfer",
                                });
                                setGroupId("");
                                setActionDate("");
                              }}
                            >
                              {t("Ndërro grupin")}
                            </button>
                            <button
                              onClick={() => {
                                setAction({
                                  row,
                                  kind: "end",
                                });
                                setActionDate("");
                              }}
                            >
                              {t("Përfundo")}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data ? (
          <div className="empty">{t("Duke ngarkuar…")}</div>
        ) : !data.items.length ? (
          <div className="empty">{t("Nuk u gjetën regjistrime.")}</div>
        ) : null}
        <div className="pagination">
          <span>
            {data?.total ?? 0}
            {t(" regjistrime · Faqja ")}
            {page}
          </span>
          <div>
            <button
              disabled={page <= 1}
              aria-label={t("Faqja e mëparshme")}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={!data || page >= data.pages}
              aria-label={t("Faqja tjetër")}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {editing && (
        <ResourceEditor
          key={kind}
          config={config}
          row={editing}
          close={() => setEditing(null)}
          saved={saved}
        />
      )}{" "}
      {action && (
        <div className="modal-backdrop">
          <section className="modal small" role="dialog" aria-modal="true">
            <h2>
              {action.kind === "delete"
                ? t("Fshi regjistrimin?")
                : action.kind === "end"
                  ? t("Përfundo regjistrimin")
                  : t("Ndërro grupin")}
            </h2>
            <form onSubmit={perform}>
              {action.kind === "delete" ? (
                <p>
                  {t(
                    "Regjistrimi me historik nuk mund të fshihet. Çaktivizojeni për ta ruajtur historikun.",
                  )}
                </p>
              ) : (
                <>
                  <label>
                    {t("Data")}
                    <input
                      type="date"
                      required
                      value={actionDate}
                      onChange={(e) => setActionDate(e.target.value)}
                    />
                  </label>
                  {action.kind === "transfer" && (
                    <>
                      <p>
                        {t(
                          "Ndërrimi fillon në datën 1 të muajit dhe ruan historikun.",
                        )}
                      </p>
                      <Lookup
                        endpoint={
                          "/groups?status=ACTIVE&courseId=" +
                          action.row.courseId
                        }
                        label={t("Grupi i ri")}
                        value={groupId}
                        onChange={setGroupId}
                      />
                    </>
                  )}
                </>
              )}
              {error && <div className="error">{tm(error)}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  {t("Anulo")}
                </button>
                <button
                  className={action.kind === "delete" ? "danger" : "primary"}
                  disabled={busy}
                >
                  {busy ? t("Duke punuar…") : t("Konfirmo")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
