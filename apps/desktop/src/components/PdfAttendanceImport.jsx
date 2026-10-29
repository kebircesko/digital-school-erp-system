import { useState } from "react";
import { Upload } from "lucide-react";
import Lookup from "./Lookup";
import { api } from "../services/api";

export default function PdfAttendanceImport({ imported }) {
  const [groupId, setGroupId] = useState("");
  const [upload, setUpload] = useState(null);
  const [preview, setPreview] = useState(null);
  const [matches, setMatches] = useState({});
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mapping = (values) =>
    Object.entries(values)
      .filter(([, studentId]) => studentId)
      .map(([row, studentId]) => ({ row: Number(row), studentId }));
  async function check(body, values = {}) {
    const result = await api("/attendance/import", {
      method: "POST",
      body: JSON.stringify({ ...body, groupId, matches: mapping(values) }),
      signal: AbortSignal.timeout(60000),
    });
    setPreview(result);
    setMatches(
      Object.fromEntries(
        result.items
          .filter((r) => r.studentId)
          .map((r) => [r.row, r.studentId]),
      ),
    );
    setChanged(false);
  }
  async function choose(file) {
    setUpload(null);
    setPreview(null);
    setMatches({});
    setError("");
    setNotice("");
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      setError("Ngarkoni raportin origjinal PDF deri në 2 MB.");
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
      await check(body);
      setUpload(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function recheck() {
    setBusy(true);
    setError("");
    try {
      await check(upload, matches);
    } catch (e) {
      setError(e.message);
      setChanged(true);
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
          groupId,
          matches: mapping(matches),
          commit: true,
          previewToken: preview.previewToken,
        }),
        signal: AbortSignal.timeout(60000),
      });
      const period = preview.report.period;
      setNotice(
        `${result.imported} nxënës u ruajtën për ${period}. Tani vendosni çmimet te lista më poshtë.`,
      );
      setPreview(null);
      setUpload(null);
      setMatches({});
      imported(period);
    } catch (e) {
      setError(e.message);
      setChanged(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card attendance-import pdf-attendance-import">
      <div className="card-heading">
        <div>
          <h2>Vijueshmëria nga PDF i DSOS</h2>
          <p>
            Muaji dhe klasa lexohen nga raporti. P numërohet si prezent, A si
            mungesë. U, T dhe ditët pa shënim ruhen veçmas.
          </p>
        </div>
      </div>
      <fieldset disabled={busy} className="pdf-import-controls">
        <Lookup
          endpoint="/groups"
          label="Grupi në ERP"
          value={groupId}
          onChange={(id) => {
            setGroupId(id);
            setUpload(null);
            setPreview(null);
            setMatches({});
            setError("");
            setNotice("");
          }}
        />
        <label className="secondary upload-label">
          <Upload size={16} />
          {busy ? "Duke përpunuar…" : "Ngarko raportin PDF"}
          <input
            aria-label="Ngarko raportin PDF të vijueshmërisë"
            type="file"
            accept=".pdf"
            disabled={busy || !groupId}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </fieldset>
      {!groupId && (
        <p className="muted">
          Zgjidhni grupin ku janë regjistruar këta nxënës, pastaj ngarkoni
          raportin e tij.
        </p>
      )}
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
            Muaji: {preview.report.period} · {preview.report.students} nxënës ·{" "}
            {preview.report.totalLessons} orë
          </h3>
          <p>
            Klasa në raport: <strong>{preview.report.className}</strong>
          </p>
          <p>
            Grupi në ERP: <strong>{preview.report.groupName}</strong>.
            Kontrolloni që përputhen para ruajtjes.
          </p>
          {preview.errors.length > 0 && (
            <div className="error pdf-import-errors" role="alert">
              {preview.errors.map((e, i) => (
                <p key={i}>
                  Rreshti {e.row}: {e.message}
                </p>
              ))}
            </div>
          )}
          <p className="muted">
            Kontrolloni emrat e lidhur automatikisht. Emrat që mungojnë ose
            përsëriten duhen zgjedhur nga lista; nxënësi duhet të ketë
            regjistrim në grup për këtë muaj.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Emri në PDF</th>
                  <th>Nxënësi në ERP</th>
                  <th>Prezent (P)</th>
                  <th>Mungesa (A)</th>
                  <th>U</th>
                  <th>T</th>
                  <th>Pa shënim</th>
                  <th>Veprimi</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((row) => (
                  <tr key={row.row}>
                    <td>{row.reportName}</td>
                    <td>
                      <select
                        aria-label={`Nxënësi për rreshtin ${row.row}`}
                        value={matches[row.row] ?? ""}
                        disabled={busy}
                        onChange={(e) => {
                          setMatches({ ...matches, [row.row]: e.target.value });
                          setChanged(true);
                        }}
                      >
                        <option value="">Zgjidhni nxënësin…</option>
                        {preview.students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <strong>{row.sourceCounts.present}</strong>
                    </td>
                    <td>{row.sourceCounts.absent}</td>
                    <td>{row.sourceCounts.undefined}</td>
                    <td>{row.sourceCounts.tardy}</td>
                    <td>{row.sourceCounts.noAttendance}</td>
                    <td>
                      {row.replacesExisting
                        ? "Zëvendëson muajin ekzistues"
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
                setMatches({});
              }}
            >
              Anulo
            </button>
            <button className="secondary" disabled={busy} onClick={recheck}>
              Kontrollo lidhjet
            </button>
            <button
              className="primary"
              disabled={busy || changed || !preview.valid}
              onClick={commit}
            >
              Konfirmo vijueshmërinë
            </button>
          </div>
          {changed && (
            <p className="muted">
              Lidhjet ndryshuan. Shtypni “Kontrollo lidhjet” para konfirmimit.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
