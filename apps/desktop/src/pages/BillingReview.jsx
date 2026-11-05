import { t, tm } from "../services/i18n.js";
import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { api, download } from "../services/api";
import { calendarDay, monthLabel } from "../services/format";
import { InvoiceDialog, NewInvoiceDialog } from "../components/InvoiceDialog";
import StudentLink from "../components/StudentLink";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import PdfAttendanceImport from "../components/PdfAttendanceImport";
import { presentCount, otherAttendance } from "../services/attendance";
import BatchInvoices from "../components/BatchInvoices";
import SortableHeader from "../components/SortableHeader";
export function calendarMonth(offset = 0) {
  const [year, month] = calendarDay().slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}
function AttendanceImport({ refresh }) {
  const [month, setMonth] = useState(calendarMonth()),
    [upload, setUpload] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function choose(file) {
    setUpload(null);
    setPreview(null);
    setError("");
    setNotice("");
    if (!file) return;
    if (
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > 2 * 1024 * 1024
    ) {
      setError(t("Zgjidhni një skedar .xlsx deri në 2 MB."));
      return;
    }
    setBusy(true);
    try {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error(t("Skedari nuk u lexua.")));
        reader.readAsDataURL(file);
      });
      const body = {
        filename: file.name,
        content,
      };
      setPreview(
        await api("/attendance/import", {
          method: "POST",
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60000),
        }),
      );
      setUpload(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError("");
    try {
      const result = await api("/attendance/import", {
        method: "POST",
        body: JSON.stringify({
          ...upload,
          commit: true,
          previewToken: preview.previewToken,
        }),
        signal: AbortSignal.timeout(60000),
      });
      setNotice(
        t(
          "{0} rreshta mungesash u ruajtën. Faturat ekzistuese ruajnë shumën dhe historikun e aprovimit.",
          [result.imported],
        ),
      );
      setUpload(null);
      setPreview(null);
      refresh(preview.items[0]?.period, upload.filename);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card attendance-import">
      <div className="card-heading">
        <div>
          <h2>{t("Mungesat nga Excel")}</h2>
          <p>
            {t(
              "Plotësoni modelin dhe kontrolloni parashikimin para ruajtjes. Importi nuk ndryshon shumat e faturave.",
            )}
          </p>
        </div>
      </div>
      <div className="table-toolbar">
        <label>
          {t("Muaji i modelit")}
          <input
            type="month"
            value={month}
            max={calendarMonth()}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          disabled={busy || !month}
          onClick={async () => {
            try {
              await download(
                `/attendance/template.xlsx?period=${month}`,
                `mungesat-${month}.xlsx`,
              );
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <Download size={16} />
          {t("Shkarko modelin")}
        </button>
        <label className="secondary upload-label">
          <Upload size={16} />
          {busy ? t("Duke përpunuar…") : t("Ngarko Excel")}
          <input
            aria-label={t("Ngarko Excel të mungesave")}
            type="file"
            accept=".xlsx"
            disabled={busy}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="muted">
        {t(
          "Modeli përmban ID-të e nxënësve dhe kurseve. “Orë gjithsej” janë orët e mbajtura nga klasa gjatë muajit. Plotësoni “Orë gjithsej”, “Mungesa” dhe “Me arsye”. Mungesat me arsye janë pjesë e numrit të përgjithshëm.",
        )}
      </p>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {tm(notice)}
        </div>
      )}
      {preview && (
        <div className="import-preview">
          <h3>
            {t("Parashikimi: ")}
            {preview.count}
            {t(" rreshta ·")}{" "}
            {preview.items.filter((r) => r.replacesExisting).length}
            {t(" zëvendësime")}
          </h3>
          {preview.errors.length > 0 && (
            <div className="error" role="alert">
              {preview.errors.map((e, i) => (
                <p key={i}>
                  {t("Rreshti ")}
                  {e.row}: {tm(e.message)}
                </p>
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Rreshti")}</th>
                  <th>{t("Nxënësi / Kursi")}</th>
                  <th>{t("Muaji")}</th>
                  <th>{t("Orë gjithsej")}</th>
                  <th>{t("Mungesa")}</th>
                  <th>{t("Me arsye")}</th>
                  <th>{t("Orë të ndjekura")}</th>
                  <th>{t("Veprimi")}</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>
                      <StudentLink id={r.studentId}>
                        {r.studentName}
                      </StudentLink>
                      <small>{r.courseName}</small>
                    </td>
                    <td>{r.period}</td>
                    <td>{r.totalLessons}</td>
                    <td>{r.absences}</td>
                    <td>{r.excusedAbsences}</td>
                    <td>
                      <strong>{presentCount(r)}</strong>
                    </td>
                    <td>
                      {r.replacesExisting
                        ? t("Zëvendëson P: {0}, A: {1}{2}", [
                            presentCount(r.previous),
                            r.previous.absences,
                            otherAttendance(r.previous)
                              ? ` · ${otherAttendance(r.previous)}`
                              : "",
                          ])
                        : t("I ri")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setUpload(null);
              }}
            >
              {t("Anulo importin")}
            </button>
            <button
              className="primary"
              disabled={busy || !preview.valid}
              onClick={commit}
            >
              {t("Konfirmo importin")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
export default function BillingReview({ user, initialPeriod }) {
  const updates = useSchoolUpdates();
  const batchActive = useRef(false);
  const draftCache = useRef({});
  const importPanel = useRef(null);
  const [period, setPeriod] = useState(initialPeriod || calendarMonth()),
    [data, setData] = useState(null),
    [imports, setImports] = useState([]),
    [sourceFile, setSourceFile] = useState(""),
    [batchBusy, setBatchBusy] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("createdAt:desc"),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [candidate, setCandidate] = useState(null),
    [invoice, setInvoice] = useState(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    setPeriod(initialPeriod || calendarMonth());
    setPage(1);
  }, [initialPeriod]);
  useEffect(() => {
    if (user.role !== "ADMIN") return;
    const controller = new AbortController();
    setImports([]);
    api(
      `/attendance/imports?period=${period > calendarMonth() ? calendarMonth() : period}&billingPeriod=${period}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setImports(result.items);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [period, revision, updates, user.role]);
  useEffect(() => {
    if (batchActive.current) return;
    const controller = new AbortController();
    setData(null);
    setError("");
    api(
      `/invoice-review/pending?${new URLSearchParams({
        period,
        page: String(page),
        search: query,
        status,
        sort,
        ...(sourceFile ? { sourceFile } : {}),
      })}`,
      {
        signal: controller.signal,
      },
    )
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [period, page, query, status, sort, sourceFile, revision, updates]);
  const selectedImport = imports.find((file) => file.filename === sourceFile);
  function selectImport(filename) {
    setSourceFile(filename);
    setSearch("");
    setQuery("");
    setStatus("");
    setPage(1);
  }
  function imported(month, filename) {
    if (month) setPeriod(month);
    selectImport(filename);
    if (importPanel.current) importPanel.current.open = false;
    reload();
  }
  const [sortKey, sortDirection] = sort.split(":");
  const columns = [
    ["studentName", "Nxënësi"],
    ["courseName", "Kursi / Grupi"],
    ["period", "Muaji"],
    ["totalLessons", "Orë gjithsej"],
    ["absences", "Mungesa (A)"],
    ["present", "Prezent (P)"],
    ["suggestedAmount", "Shuma e faturës"],
  ];
  function changeSort(value) {
    setSort(value);
    setPage(1);
  }
  function sortColumn(key) {
    changeSort(
      `${key}:${sortKey === key && sortDirection === "asc" ? "desc" : "asc"}`,
    );
  }
  function reload() {
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("billing-updated"));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Faturat e muajit")}</h1>
          <p>
            {t(
              "Ngarko Excel-in → kontrollo pjesëmarrjet → shëno shumat → krijo faturat bashkë.",
            )}
          </p>
        </div>
        <button className="secondary" disabled={batchBusy} onClick={reload}>
          <RefreshCw size={16} />
          {t("Rifresko")}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {tm(error)}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {tm(notice)}
        </div>
      )}
      {user.role === "ADMIN" && (
        <details className="attendance-disclosure" ref={importPanel}>
          <summary>{t("Ngarko vijueshmërinë nga PDF ose Excel")}</summary>
          <AttendanceImport refresh={imported} />
          <details className="attendance-excel-alternative">
            <summary>{t("Import nga PDF")}</summary>
            <PdfAttendanceImport imported={imported} />
          </details>
        </details>
      )}
      <details className="billing-attendance-help">
        <summary>{t("Si llogariten shumat dhe mungesat?")}</summary>
        <p>
          {t(
            "Zgjidhni nxënësit, kontrolloni mungesat dhe caktoni zbritjen në euro. Për muajin e ardhshëm shfaqet vijueshmëria e muajit paraprak. Sistemi nuk zbret automatikisht nga çmimi. Te raporti PDF numërohen direkt P-të dhe A-të; U, T dhe orët pa shënim nuk numërohen si prezenca. Për muajin e ardhshëm përfshihen regjistrimet e reja dhe nxënësit që kanë paguar muajin paraprak.",
          )}
        </p>
      </details>
      {user.role === "ADMIN" && imports.length > 0 && (
        <section className="card attendance-import">
          <div className="table-toolbar">
            <label>
              {t("Nxënësit nga importi")}
              <select
                aria-label={t("Zgjidh importin e vijueshmërisë")}
                value={sourceFile}
                disabled={batchBusy}
                onChange={(e) => selectImport(e.target.value)}
              >
                <option value="">{t("Shfaq të gjithë")}</option>
                {imports.map((file) => (
                  <option key={file.filename} value={file.filename}>
                    {file.filename} ({file.items.length})
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary"
              disabled={batchBusy}
              onClick={() => selectImport(imports[0].filename)}
            >
              {t("Shfaq importin e fundit")}
            </button>
            {sourceFile && (
              <button
                className="secondary"
                disabled={batchBusy}
                onClick={() => selectImport("")}
              >
                {t("Shfaq të gjithë")}
              </button>
            )}
          </div>
          {selectedImport && (
            <>
              <p role="status">
                {t(
                  "{0} nxënës nga importi. Vijueshmëria: {1}. Faturimi: {2}.",
                  [
                    selectedImport.items.length,
                    monthLabel(selectedImport.items[0].period),
                    monthLabel(period),
                  ],
                )}
              </p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("Nxënësi")}</th>
                      <th>{t("Kursi")}</th>
                      <th>{t("Muaji i vijueshmërisë")}</th>
                      <th>{t("Prezent (P)")}</th>
                      <th>{t("Mungesa (A)")}</th>
                      <th>{t("Faturimi për {0}", [monthLabel(period)])}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedImport.items.map((row) => (
                      <tr key={`${row.studentId}:${row.courseId}`}>
                        <td>
                          <StudentLink id={row.studentId}>
                            {row.studentName}
                          </StudentLink>
                        </td>
                        <td>{row.courseName}</td>
                        <td>{row.period}</td>
                        <td>{presentCount(row)}</td>
                        <td>{row.absences}</td>
                        <td>
                          {row.invoice ? (
                            <button
                              className="secondary"
                              disabled={batchBusy}
                              onClick={() => setInvoice(row.invoice.id)}
                            >
                              {row.invoice.number} ·{" "}
                              {t("Hap faturën ekzistuese")}
                            </button>
                          ) : (
                            <>
                              <span>
                                {t(
                                  {
                                    READY: "Gati për faturim",
                                    NO_ENROLLMENT:
                                      "Pa regjistrim në këtë kurs për muajin e zgjedhur.",
                                    INACTIVE: "Nxënësi është joaktiv.",
                                    PREVIOUS_UNPAID:
                                      "Muaji paraprak nuk është paguar plotësisht.",
                                    PREVIOUS_MISSING:
                                      "Mungon fatura e muajit paraprak.",
                                  }[row.billingStatus] ?? "Pa faturë",
                                )}
                              </span>
                              {row.billingStatus === "PREVIOUS_UNPAID" &&
                                row.previousInvoice && (
                                  <button
                                    className="secondary"
                                    disabled={batchBusy}
                                    onClick={() =>
                                      setInvoice(row.previousInvoice.id)
                                    }
                                  >
                                    {t("Hap faturën e {0}", [
                                      monthLabel(row.previousPeriod),
                                    ])}
                                  </button>
                                )}
                              {row.billingStatus === "PREVIOUS_MISSING" && (
                                <button
                                  className="secondary"
                                  disabled={batchBusy}
                                  onClick={() => {
                                    setPeriod(row.previousPeriod);
                                    setPage(1);
                                    setStatus("");
                                  }}
                                >
                                  {t("Shfaq {0}", [
                                    monthLabel(row.previousPeriod),
                                  ])}
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
      <section className="card monthly-invoices">
        <div className="table-toolbar">
          <label>
            {t("Muaji")}
            <input
              aria-label={t("Muaji i faturës për aprovim")}
              disabled={batchBusy}
              type="month"
              required
              value={period}
              max={calendarMonth(1)}
              onChange={(e) => {
                if (e.target.value) {
                  setPeriod(e.target.value);
                  setPage(1);
                }
              }}
            />
          </label>
          <button
            className="secondary"
            aria-pressed={period === calendarMonth()}
            disabled={batchBusy}
            onClick={() => {
              setPeriod(calendarMonth());
              setPage(1);
            }}
          >
            {t("Ky muaj")}
          </button>
          <button
            className="secondary"
            aria-pressed={period === calendarMonth(1)}
            disabled={batchBusy}
            onClick={() => {
              setPeriod(calendarMonth(1));
              setPage(1);
            }}
          >
            {t("Përgatit muajin e ardhshëm")}
          </button>
          <span>
            {data ? t("{0} pa faturë", [data.total]) : t("Duke ngarkuar…")}
          </span>
        </div>
        <div className="billing-review-filters">
          <select
            aria-label={t("Rendit faturat")}
            disabled={batchBusy}
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
          >
            <option value="createdAt:desc">{t("Më të rejat")}</option>
            <option value="createdAt:asc">{t("Më të vjetrat")}</option>
            {sortKey !== "createdAt" && (
              <option value={sort}>
                {t(columns.find(([key]) => key === sortKey)?.[1])}{" "}
                {sortDirection === "asc" ? "↑" : "↓"}
              </option>
            )}
          </select>
          <input
            aria-label={t("Kërko nxënës, kurs ose grup për faturim")}
            placeholder={t("Kërko nxënës, kurs ose grup…")}
            value={search}
            maxLength={100}
            disabled={batchBusy}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div
            className="billing-filter-tabs"
            aria-label={t("Filtro faturat e muajit")}
          >
            {[
              ["", t("Të gjithë"), "all"],
              ["absences", t("Me mungesa"), "absences"],
              ["missing", t("Pa vijueshmëri"), "missing"],
              ["regular", t("Pa mungesa"), "regular"],
            ].map(([value, label, key]) => (
              <button
                key={key}
                className="secondary"
                aria-pressed={status === value}
                disabled={batchBusy}
                onClick={() => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                {label}
                {data?.summary ? ` (${data.summary[key]})` : ""}
              </button>
            ))}
          </div>
        </div>
        {user.role === "ADMIN" ? (
          data && (
            <BatchInvoices
              key={period}
              period={period}
              draftCache={draftCache}
              rows={data.items}
              sort={{ key: sortKey, direction: sortDirection }}
              onSort={sortColumn}
              priceSaved={(updated) =>
                setData((previous) =>
                  previous
                    ? {
                        ...previous,
                        items: previous.items.map((row) =>
                          row.enrollmentId === updated.enrollmentId
                            ? updated
                            : row,
                        ),
                      }
                    : previous,
                )
              }
              activeChanged={(value) => {
                batchActive.current = value;
                setBatchBusy(value);
              }}
              finished={(results) => {
                const count = results.filter((r) => r.ok).length;
                setNotice(
                  t("U regjistruan {0} fatura.{1}", [
                    count,
                    results.some((r) => !r.ok)
                      ? t(
                          " Disa kërkesa kërkojnë kontroll në listën e rifreskuar.",
                        )
                      : t(" Pagesat regjistrohen kur pranohen."),
                  ]),
                );
                batchActive.current = false;
                setBatchBusy(false);
                reload();
              }}
            />
          )
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <SortableHeader
                      key={key}
                      column={key}
                      label={t(label)}
                      sort={{ key: sortKey, direction: sortDirection }}
                      onSort={sortColumn}
                    />
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((row) => (
                  <tr key={row.enrollmentId}>
                    <td>
                      <StudentLink id={row.studentId}>
                        <strong>{row.studentName}</strong>
                      </StudentLink>
                    </td>
                    <td>
                      {row.courseName}
                      <small>{row.groupName}</small>
                    </td>
                    <td>{row.period}</td>
                    {row.attendance?.current ? (
                      <>
                        <td>{row.attendance.current.totalLessons}</td>
                        <td>
                          {row.attendance.current.absences}
                          <small>
                            {row.attendance.current.excusedAbsences}
                            {t(" me arsye")}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {presentCount(row.attendance.current)}
                          </strong>
                          <small>
                            {otherAttendance(row.attendance.current)}
                          </small>
                        </td>
                      </>
                    ) : (
                      <td colSpan={3}>
                        <span className="attendance-missing">
                          {t("Pa të dhëna për këtë muaj")}
                        </span>
                      </td>
                    )}
                    <td>{Number(row.suggestedAmount).toFixed(2)} €</td>
                    <td>
                      {user.role === "ADMIN" ? (
                        <button
                          className="primary"
                          onClick={() => setCandidate(row)}
                        >
                          {t("Regjistro faturën")}
                        </button>
                      ) : (
                        t("Në pritje të adminit")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && !data.items.length && (
          <div className="empty">
            {query || status
              ? t("Nuk u gjetën nxënës me këtë kërkim ose filtër.")
              : t("Nuk ka fatura të reja për të regjistruar për {0}.", [
                  period,
                ])}
          </div>
        )}
        <div className="pagination">
          <span>
            {t("Faqja ")}
            {data?.page ?? page} / {data?.pages ?? 1}
          </span>
          <div>
            <button
              disabled={batchBusy || page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={batchBusy || !data || page >= data.pages}
              onClick={() => setPage((v) => v + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {candidate && (
        <NewInvoiceDialog
          candidate={candidate}
          close={() => setCandidate(null)}
          created={(value) => {
            setCandidate(null);
            setInvoice(value.id);
            reload();
          }}
        />
      )}
      {invoice && (
        <InvoiceDialog
          id={invoice}
          pay
          close={() => setInvoice(null)}
          saved={reload}
          user={user}
        />
      )}
    </>
  );
}
