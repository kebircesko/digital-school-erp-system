import { useEffect, useState } from "react";
import {
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { api, download } from "../services/api";
import { calendarDay } from "../services/format";
import { InvoiceDialog, NewInvoiceDialog } from "../components/InvoiceDialog";
import StudentLink from "../components/StudentLink";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import PdfAttendanceImport from "../components/PdfAttendanceImport";
import { presentCount, otherAttendance } from "../services/attendance";

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
      setError("Zgjidhni një skedar .xlsx deri në 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Skedari nuk u lexua."));
        reader.readAsDataURL(file);
      });
      const body = { filename: file.name, content };
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
        `${result.imported} rreshta mungesash u ruajtën. Faturat ekzistuese ruajnë shumën dhe historikun e aprovimit.`,
      );
      setUpload(null);
      setPreview(null);
      refresh();
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
          <h2>Mungesat nga Excel</h2>
          <p>
            Plotësoni modelin dhe kontrolloni parashikimin para ruajtjes.
            Importi nuk ndryshon shumat e faturave.
          </p>
        </div>
      </div>
      <div className="table-toolbar">
        <label>
          Muaji i modelit
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
          Shkarko modelin
        </button>
        <label className="secondary upload-label">
          <Upload size={16} />
          {busy ? "Duke përpunuar…" : "Ngarko Excel"}
          <input
            aria-label="Ngarko Excel të mungesave"
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
        Modeli përmban ID-të e nxënësve dhe kurseve. “Orë gjithsej” janë orët e
        mbajtura nga klasa gjatë muajit. Plotësoni “Orë gjithsej”, “Mungesa” dhe
        “Me arsye”. Mungesat me arsye janë pjesë e numrit të përgjithshëm.
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {notice}
        </div>
      )}
      {preview && (
        <div className="import-preview">
          <h3>
            Parashikimi: {preview.count} rreshta ·{" "}
            {preview.items.filter((r) => r.replacesExisting).length} zëvendësime
          </h3>
          {preview.errors.length > 0 && (
            <div className="error" role="alert">
              {preview.errors.map((e, i) => (
                <p key={i}>
                  Rreshti {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rreshti</th>
                  <th>Nxënësi / Kursi</th>
                  <th>Muaji</th>
                  <th>Orë gjithsej</th>
                  <th>Mungesa</th>
                  <th>Me arsye</th>
                  <th>Orë të ndjekura</th>
                  <th>Veprimi</th>
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
                        ? `Zëvendëson P: ${presentCount(r.previous)}, A: ${r.previous.absences}${otherAttendance(r.previous) ? ` · ${otherAttendance(r.previous)}` : ""}`
                        : "I ri"}
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
              Anulo importin
            </button>
            <button
              className="primary"
              disabled={busy || !preview.valid}
              onClick={commit}
            >
              Konfirmo importin
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
export default function BillingReview({ user, initialPeriod }) {
  const updates = useSchoolUpdates();
  const [period, setPeriod] = useState(initialPeriod || calendarMonth()),
    [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [candidate, setCandidate] = useState(null),
    [invoice, setInvoice] = useState(null);
  useEffect(() => {
    setPeriod(initialPeriod || calendarMonth());
    setPage(1);
  }, [initialPeriod]);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    api(`/invoice-review/pending?period=${period}&page=${page}`, {
      signal: controller.signal,
    })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [period, page, revision, updates]);
  function reload() {
    setRevision((v) => v + 1);
    window.dispatchEvent(new Event("billing-updated"));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Faturat e muajit</h1>
          <p>
            Ngarkoni vijueshmërinë e muajit, kontrolloni orët e ndjekura dhe
            vendosni çmimin për secilin nxënës.
          </p>
        </div>
        <button className="secondary" onClick={reload}>
          <RefreshCw size={16} />
          Rifresko
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {user.role === "ADMIN" && (
        <details className="attendance-disclosure" open>
          <summary>1. Ngarko orët dhe mungesat e muajit</summary>
          <PdfAttendanceImport
            imported={(month) => {
              setPeriod(month);
              setPage(1);
              reload();
            }}
          />
          <details className="attendance-excel-alternative">
            <summary>Alternativë: modeli ynë Excel</summary>
            <AttendanceImport refresh={reload} />
          </details>
        </details>
      )}
      <p className="billing-attendance-help">
        2. Kontrolloni orët për muajin e zgjedhur dhe hapni “Regjistro faturën”
        për të vendosur shumën. Te raporti PDF numërohen direkt P-të dhe A-të;
        U, T dhe orët pa shënim nuk numërohen si prezenca.
      </p>
      <section className="card monthly-invoices">
        <div className="table-toolbar">
          <label>
            Muaji
            <input
              aria-label="Muaji i faturës për aprovim"
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
            onClick={() => {
              setPeriod(calendarMonth());
              setPage(1);
            }}
          >
            Ky muaj
          </button>
          <button
            className="secondary"
            onClick={() => {
              setPeriod(calendarMonth(1));
              setPage(1);
            }}
          >
            Muaji i ardhshëm
          </button>
          <span>{data ? `${data.total} pa faturë` : "Duke ngarkuar…"}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nxënësi</th>
                <th>Kursi / Grupi</th>
                <th>Muaji</th>
                <th>Orë gjithsej</th>
                <th>Mungesa (A)</th>
                <th>Prezent (P)</th>
                <th>Çmimi mujor</th>
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
                          {row.attendance.current.excusedAbsences} me arsye
                        </small>
                      </td>
                      <td>
                        <strong>{presentCount(row.attendance.current)}</strong>
                        <small>{otherAttendance(row.attendance.current)}</small>
                      </td>
                    </>
                  ) : (
                    <td colSpan={3}>
                      <span className="attendance-missing">
                        Pa të dhëna për këtë muaj
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
                        Regjistro faturën
                      </button>
                    ) : (
                      "Në pritje të adminit"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && (
          <div className="empty">
            Nuk ka fatura të reja për të regjistruar për {period}.
          </div>
        )}
        <div className="pagination">
          <span>
            Faqja {data?.page ?? page} / {data?.pages ?? 1}
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={!data || page >= data.pages}
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
