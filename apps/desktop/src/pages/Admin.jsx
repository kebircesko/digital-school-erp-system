import { useState, useEffect } from "react";
import { api, download } from "../services/api";
const actions = {
  LOGIN: "Kyçje",
  LOGOUT: "Çkyçje",
  STUDENT_CREATE: "Regjistrim nxënësi",
  STUDENT_UPDATE: "Ndryshim nxënësi",
  STUDENT_DELETE: "Fshirje nxënësi",
  COURSE_CREATE: "Krijim kursi",
  COURSE_UPDATE: "Ndryshim kursi",
  COURSE_DELETE: "Fshirje kursi",
  GROUP_CREATE: "Krijim grupi",
  GROUP_UPDATE: "Ndryshim grupi",
  GROUP_DELETE: "Fshirje grupi",
  ENROLLMENT_CREATE: "Regjistrim në kurs",
  ENROLLMENT_END: "Përfundim regjistrimi",
  ENROLLMENT_TRANSFER: "Ndërrim grupi",
  INVOICES_GENERATE: "Gjenerim faturash",
  INVOICE_APPROVE: "Aprovim fature",
  ATTENDANCE_IMPORT: "Importim mungesash nga Excel",
  ADMIN_PASSWORD_RESET_LOCAL: "Rivendosje lokale e fjalëkalimit",
  INVOICE_DEADLINE_UPDATE: "Përditësim afati sipas regjistrimit",
  INVOICE_VOID: "Anulim fature",
  PAYMENT_CREATE: "Regjistrim pagese",
  PAYMENT_REVERSE: "Anulim pagese",
  USER_CREATE: "Krijim përdoruesi",
  USER_UPDATE: "Ndryshim përdoruesi",
  BACKUP_CREATE: "Krijim kopjeje rezervë",
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
      { signal: controller.signal },
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
      setNotice("Backup-i i enkriptuar u krijua.");
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
          <span className="eyebrow">ADMINISTRIMI</span>
          <h1>
            {kind === "audit" ? "Historiku i veprimeve" : "Backup dhe rikthimi"}
          </h1>
          <p>
            {kind === "audit"
              ? "Veprimet e përdoruesve dhe punët automatike të serverit."
              : "Kopje të enkriptuara të databazës së aplikacionit."}
          </p>
        </div>
        {kind === "backups" && (
          <button className="primary" disabled={busy} onClick={backup}>
            {busy ? "Duke krijuar…" : "Krijo backup"}
          </button>
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && <div className="success">{notice}</div>}
      <section className="card">
        {kind === "audit" && (
          <div className="table-toolbar">
            <input
              placeholder="Kërko veprim…"
              aria-label="Kërko veprim"
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
                  ? ["Data", "Përdoruesi", "Veprimi", "Regjistrimi"]
                  : ["Data", "Skedari", "Madhësia", "Veprimi"]
                ).map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id ?? r.name}>
                  <td>{new Date(r.createdAt).toLocaleString("en-GB")}</td>
                  {kind === "audit" ? (
                    <>
                      <td>{r.user?.name ?? "Sistemi automatik"}</td>
                      <td>{actions[r.action] ?? r.action}</td>
                      <td>{r.entityId ?? "—"}</td>
                    </>
                  ) : (
                    <>
                      <td>{r.name}</td>
                      <td>{Math.ceil(r.size / 1024)} KB</td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => get(r.name)}
                        >
                          Shkarko
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && <div className="empty">Nuk ka regjistrime.</div>}
        {kind === "audit" && (
          <div className="pagination">
            <span>
              Faqja {page} nga {pages}
            </span>
            <div>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Para
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
              >
                Tjetra
              </button>
            </div>
          </div>
        )}
      </section>
      {kind === "backups" && (
        <section className="card backup-notes">
          <h2>Rikthimi i databazës</h2>
          <p>
            Rikthimi kryhet nga operatori i serverit në mënyrën e mirëmbajtjes,
            pasi ndalet API-ja. Komanda krijon një kopje sigurie para rikthimit
            dhe i revokon sesionet.
          </p>
          <code>
            RESTORE_CONFIRM=RESTORE_DIGITAL_SCHOOL npm run backup:restore -w
            @erp/api -- /rruga/backup.erpbackup
          </code>
          <p>
            Ruajeni BACKUP_KEY veçmas; nevojitet për hapjen e backup-it. Backup
            automatik: çdo ditë në 02:00, Europe/Tirane, kur serveri është
            aktiv.
          </p>
        </section>
      )}
    </>
  );
}
