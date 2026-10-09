import { useState, useEffect, FormEvent } from "react";
import {
  Plus,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { User } from "@erp/shared";
import { api, download } from "../services/api";
import Lookup from "../components/Lookup";
import { Row } from "./resources";
const labelStatus: Record<string, string> = {
  UNPAID: "Papaguar",
  PARTIAL: "Pjesërisht paguar",
  PAID: "Paguar",
  VOID: "Anuluar",
};
const money = (value: string) => value + " €";
function cents(value: string) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, "0"));
}
function amount(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
function PaymentEditor({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [studentId, setStudentId] = useState(""),
    [invoices, setInvoices] = useState<Row[]>([]),
    [allocations, setAllocations] = useState<Record<string, string>>({}),
    [method, setMethod] = useState("CASH"),
    [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10)),
    [notes, setNotes] = useState(""),
    [key] = useState(crypto.randomUUID()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setInvoices([]);
    setAllocations({});
    if (!studentId) return;
    const controller = new AbortController();
    api<{ items: Row[] }>("/reports/debts?studentId=" + studentId, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted)
          setInvoices(result.items.flatMap((r) => r.invoices));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [studentId]);
  const total = Object.values(allocations).reduce<bigint>(
    (sum, a) => sum + (cents(a) ?? 0n),
    0n,
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (
        !Object.keys(allocations).length ||
        Object.values(allocations).some((v) => !cents(v))
      )
        throw new Error(
          "Zgjidhni faturat dhe vendosni shuma pozitive me dy shifra dhjetore.",
        );
      await api("/payments", {
        method: "POST",
        body: JSON.stringify({
          studentId,
          idempotencyKey: key,
          amount: amount(total),
          method,
          paidAt,
          notes,
          allocations: Object.entries(allocations).map(
            ([invoiceId, amount]) => ({ invoiceId, amount }),
          ),
        }),
      });
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section className="modal wide" role="dialog" aria-modal="true">
        <div className="modal-heading">
          <h2>Regjistro pagesë</h2>
          <button disabled={busy} onClick={close}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <Lookup
              endpoint="/students"
              label="Nxënësi"
              value={studentId}
              onChange={setStudentId}
            />
            <div className="form-grid spaced">
              <label>
                Metoda
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="CASH">Para të gatshme</option>
                  <option value="BANK">Bankë</option>
                </select>
              </label>
              <label>
                Data e pagesës
                <input
                  type="date"
                  required
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </label>
            </div>
            <h3 className="section-label">Zgjidh faturat dhe ndaje pagesën</h3>
            {invoices.map((i) => {
              const balance = amount(
                (cents(i.amount) ?? 0n) - (cents(i.paidAmount) ?? 0n),
              );
              return (
                <div className="allocation-row" key={i.id}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={i.id in allocations}
                      onChange={(e) =>
                        setAllocations((previous) => {
                          const next = { ...previous };
                          if (e.target.checked) next[i.id] = balance;
                          else delete next[i.id];
                          return next;
                        })
                      }
                    />
                    {i.number} · {i.period}
                    <small>Mbetja: {balance} €</small>
                  </label>
                  {i.id in allocations && (
                    <input
                      aria-label={"Shuma për " + i.number}
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,2})?"
                      required
                      value={allocations[i.id]}
                      onChange={(e) =>
                        setAllocations({
                          ...allocations,
                          [i.id]: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              );
            })}
            {studentId && !invoices.length && (
              <p>Nuk ka fatura të papaguara për këtë nxënës.</p>
            )}
            <label className="spaced">
              Shënime
              <textarea
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <div className="payment-total">
              Totali i pagesës <strong>{amount(total)} €</strong>
            </div>
          </fieldset>
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
              Anulo
            </button>
            <button className="primary" disabled={busy || total === 0n}>
              {busy ? "Duke regjistruar…" : "Regjistro pagesën"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
export default function Finance({
  kind,
  user,
}: {
  kind: "invoices" | "payments";
  user: User;
}) {
  const [data, setData] = useState<{
      items: Row[];
      total: number;
      pages: number;
    } | null>(null),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [period, setPeriod] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [newPayment, setNewPayment] = useState(false),
    [generate, setGenerate] = useState(false),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7)),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState<Row | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    setPage(1);
    setSearch("");
    setStatus("");
    setPeriod("");
  }, [kind]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        page: String(page),
        search,
        ...(kind === "invoices" && period ? { period } : {}),
        ...(kind === "invoices" && status ? { status } : {}),
      });
      api<typeof data>("/" + kind + "?" + params, { signal: controller.signal })
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
  }, [kind, page, search, period, status, revision]);
  async function doc(id: string, number: string) {
    try {
      await download(`/${kind}/${id}/pdf`, number + ".pdf", true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function createInvoices(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ created: number }>("/invoices/generate", {
        method: "POST",
        body: JSON.stringify({ period: month }),
      });
      setNotice(
        `${result.created} fatura të reja u krijuan. Faturat ekzistuese nuk u dyfishuan.`,
      );
      setGenerate(false);
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(event: FormEvent) {
    event.preventDefault();
    if (!action) return;
    setBusy(true);
    try {
      await api(
        `/${kind}/${action.id}/${kind === "invoices" ? "void" : "reverse"}`,
        { method: "POST", body: JSON.stringify({ reason }) },
      );
      setAction(null);
      setNotice("Veprimi u regjistrua në historik.");
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FINANCAT · EUR</span>
          <h1>{kind === "invoices" ? "Faturat mujore" : "Pagesat"}</h1>
          <p>
            {kind === "invoices"
              ? "Faturimi automatik dhe detyrimet sipas periudhës."
              : "Pagesa të plota ose të pjesshme, me historik të gjurmueshëm."}
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            kind === "invoices" ? setGenerate(true) : setNewPayment(true)
          }
        >
          <Plus size={18} />
          {kind === "invoices" ? "Gjenero faturat" : "Regjistro pagesë"}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {notice && (
        <div className="success" role="status">
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <section className="card">
        <div className="table-toolbar">
          <input
            aria-label="Kërko faturë ose pagesë"
            placeholder="Kërko numrin ose nxënësin…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {kind === "invoices" && (
            <>
              <input
                aria-label="Periudha"
                type="month"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  setPage(1);
                }}
              />
              <select
                aria-label="Statusi i faturave"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Të gjitha statuset</option>
                {Object.entries(labelStatus).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Numri</th>
                <th>Nxënësi</th>
                <th>
                  {kind === "invoices" ? "Kursi / Periudha" : "Data / Metoda"}
                </th>
                <th>Shuma</th>
                <th>{kind === "invoices" ? "Mbetja" : "Regjistruar nga"}</th>
                <th>Statusi</th>
                <th>Dokumenti</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.number}</td>
                  <td>
                    {r.studentName ??
                      `${r.student.firstName} ${r.student.lastName}`}
                  </td>
                  <td>
                    {kind === "invoices"
                      ? r.courseName + " · " + r.period
                      : r.paidAt.slice(0, 10) +
                        " · " +
                        (r.method === "CASH" ? "Para të gatshme" : "Bankë")}
                  </td>
                  <td>{money(r.amount)}</td>
                  <td>
                    {kind === "invoices" ? money(r.balance) : r.user.name}
                  </td>
                  <td>
                    {kind === "invoices"
                      ? labelStatus[r.status]
                      : r.reversedAt
                        ? "Anuluar"
                        : "Regjistruar"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        title="PDF / Printo"
                        onClick={() => doc(r.id, r.number)}
                      >
                        <FileText size={17} />
                      </button>
                      {((kind === "invoices" &&
                        ["UNPAID"].includes(r.status)) ||
                        (kind === "payments" &&
                          user.role === "ADMIN" &&
                          !r.reversedAt)) && (
                        <button
                          onClick={() => {
                            setAction(r);
                            setReason("");
                          }}
                        >
                          Anulo
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && !data.items.length && (
          <div className="empty">Nuk ka regjistrime për këto filtra.</div>
        )}
        <div className="pagination">
          <span>
            {data?.total ?? 0} regjistrime · Faqja {page}
          </span>
          <div>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={18} />
            </button>
            <button
              disabled={!data || page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {newPayment && (
        <PaymentEditor
          close={() => setNewPayment(false)}
          saved={() => {
            setNewPayment(false);
            setNotice("Pagesa u regjistrua me sukses.");
            setRevision((v) => v + 1);
          }}
        />
      )}
      {generate && (
        <div className="modal-backdrop">
          <section className="modal small" role="dialog" aria-modal="true">
            <h2>Gjenero faturat mujore</h2>
            <p>
              Çmimi mujor minus zbritja. Një faturë për nxënës, kurs dhe muaj;
              pa faturim proporcional të ditëve.
            </p>
            <form onSubmit={createInvoices}>
              <label>
                Muaji
                <input
                  type="month"
                  required
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </label>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setGenerate(false)}
                >
                  Anulo
                </button>
                <button className="primary" disabled={busy}>
                  Gjenero
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {action && (
        <div className="modal-backdrop">
          <section className="modal small" role="dialog" aria-modal="true">
            <h2>Anulo {action.number}</h2>
            <p>
              {kind === "payments"
                ? "Shuma do të hiqet nga faturat; pagesa ruhet në historik."
                : "Fatura ruhet në historik dhe hiqet nga detyrimet."}
            </p>
            <form onSubmit={cancel}>
              <label>
                Arsyeja
                <textarea
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {error && <div className="error">{error}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setAction(null)}
                >
                  Mbyll
                </button>
                <button className="danger" disabled={busy}>
                  Konfirmo anulimin
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
