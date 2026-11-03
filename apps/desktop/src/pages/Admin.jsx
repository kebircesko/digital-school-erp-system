import { t, tm, getLocale } from "../services/i18n.js";
import { useState, useEffect } from "react";
import { api, download } from "../services/api";
const actions = {
  get LOGIN() {
    return t("Kyçje");
  },
  get LOGOUT() {
    return t("Çkyçje");
  },
  get STUDENT_CREATE() {
    return t("Regjistrim nxënësi");
  },
  get STUDENT_UPDATE() {
    return t("Ndryshim nxënësi");
  },
  get STUDENT_DELETE() {
    return t("Fshirje nxënësi");
  },
  get COURSE_CREATE() {
    return t("Krijim kursi");
  },
  get COURSE_UPDATE() {
    return t("Ndryshim kursi");
  },
  get COURSE_DELETE() {
    return t("Fshirje kursi");
  },
  get GROUP_CREATE() {
    return t("Krijim grupi");
  },
  get GROUP_UPDATE() {
    return t("Ndryshim grupi");
  },
  get GROUP_DELETE() {
    return t("Fshirje grupi");
  },
  get ENROLLMENT_CREATE() {
    return t("Regjistrim në kurs");
  },
  get ENROLLMENT_END() {
    return t("Përfundim regjistrimi");
  },
  get ENROLLMENT_TRANSFER() {
    return t("Ndërrim grupi");
  },
  get INVOICES_GENERATE() {
    return t("Gjenerim faturash");
  },
  get INVOICE_APPROVE() {
    return t("Aprovim fature");
  },
  get ATTENDANCE_IMPORT() {
    return t("Importim mungesash nga Excel");
  },
  get ADMIN_PASSWORD_RESET_LOCAL() {
    return t("Rivendosje lokale e fjalëkalimit");
  },
  get INVOICE_DEADLINE_UPDATE() {
    return t("Përditësim afati sipas regjistrimit");
  },
  get INVOICE_VOID() {
    return t("Anulim fature");
  },
  get PAYMENT_CREATE() {
    return t("Regjistrim pagese");
  },
  get PAYMENT_REVERSE() {
    return t("Anulim pagese");
  },
  get USER_CREATE() {
    return t("Krijim përdoruesi");
  },
  get USER_UPDATE() {
    return t("Ndryshim përdoruesi");
  },
  get BACKUP_CREATE() {
    return t("Krijim kopjeje rezervë");
  },
};
export default function Admin({ kind }) {
  const [items, setItems] = useState([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api(
      kind === "audit"
        ? `/audit?page=${page}&search=${encodeURIComponent(search)}`
        : "/backups",
      {
        signal: controller.signal,
      },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(Array.isArray(result) ? result : result.items);
          setPages(Array.isArray(result) ? 1 : result.pages);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [kind, page, search, revision]);
  async function backup() {
    setBusy(true);
    setError("");
    try {
      await api("/backups", {
        method: "POST",
        signal: AbortSignal.timeout(120000),
      });
      setNotice(t("Backup-i i enkriptuar u krijua."));
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function get(name) {
    try {
      await download("/backups/" + name, name);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("ADMINISTRIMI")}</span>
          <h1>
            {kind === "audit"
              ? t("Historiku i veprimeve")
              : t("Backup dhe rikthimi")}
          </h1>
          <p>
            {kind === "audit"
              ? t("Veprimet e përdoruesve dhe punët automatike të serverit.")
              : t("Kopje të enkriptuara të databazës së aplikacionit.")}
          </p>
        </div>
        {kind === "backups" && (
          <button className="primary" disabled={busy} onClick={backup}>
            {busy ? t("Duke krijuar…") : t("Krijo backup")}
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      {notice && <div className="success">{tm(notice)}</div>}
      <section className="card">
        {kind === "audit" && (
          <div className="table-toolbar">
            <input
              placeholder={t("Kërko veprim…")}
              aria-label={t("Kërko veprim")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {(kind === "audit"
                  ? [t("Data"), t("Përdoruesi"), t("Veprimi"), t("Regjistrimi")]
                  : [t("Data"), t("Skedari"), t("Madhësia"), t("Veprimi")]
                ).map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id ?? r.name}>
                  <td>{new Date(r.createdAt).toLocaleString(getLocale())}</td>
                  {kind === "audit" ? (
                    <>
                      <td>{r.user?.name ?? t("Sistemi automatik")}</td>
                      <td>{actions[r.action] ?? r.action}</td>
                      <td>{r.entityId ?? "—"}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.name}</td>
                      <td>
                        {Math.ceil(r.size / 1024)}
                        {t(" KB")}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => get(r.name)}
                        >
                          {t("Shkarko")}
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <div className="empty">{t("Nuk ka regjistrime.")}</div>
        )}
        {kind === "audit" && (
          <div className="pagination">
            <span>
              {t("Faqja ")}
              {page}
              {t(" nga ")}
              {pages}
            </span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t("Para")}
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                {t("Tjetra")}
              </button>
            </div>
          </div>
        )}
      </section>
      {kind === "backups" && (
        <section className="card backup-notes">
          <h2>{t("Rikthimi i databazës")}</h2>
          <p>
            {t(
              "Rikthimi kryhet nga operatori i serverit në mënyrën e mirëmbajtjes, pasi ndalet API-ja. Komanda krijon një kopje sigurie para rikthimit dhe i revokon sesionet.",
            )}
          </p>
          <code>
            RESTORE_CONFIRM=RESTORE_DIGITAL_SCHOOL npm run backup:restore -w
            @erp/api -- /rruga/backup.erpbackup
          </code>
          <p>
            {t(
              "Ruajeni BACKUP_KEY veçmas; nevojitet për hapjen e backup-it. Backup automatik: çdo ditë në 02:00, Europe/Tirane, kur serveri është aktiv.",
            )}
          </p>
        </section>
      )}
    </>
  );
}
