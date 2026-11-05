import DateInput from "../components/DateInput";
import { useState, useEffect, useRef } from "react";
import { t, tm } from "../services/i18n.js";
import { api } from "../services/api";
import { calendarDay, date } from "../services/format";
import { moneyCents, centsMoney } from "../services/money.mjs";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";

export default function CashClose() {
  const [day, setDay] = useState(calendarDay),
    [data, setData] = useState(null),
    [error, setError] = useState("");
  const [opening, setOpening] = useState("0.00"),
    [counted, setCounted] = useState(""),
    [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState("");
  const initialized = useRef("");
  const updates = useSchoolUpdates();
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    api(`/admin-tools/cash?day=${day}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        if (initialized.current !== day) {
          initialized.current = day;
          setOpening(result.history[0]?.openingCash ?? "0.00");
          setCounted(result.history[0]?.countedCash ?? "");
          setNotes("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [day, revision, updates]);
  const openingCents = moneyCents(opening),
    countedCents = moneyCents(counted);
  const expected =
    data && openingCents !== null
      ? openingCents + moneyCents(data.cashTotal)
      : null;
  const difference =
    countedCents !== null && expected !== null ? countedCents - expected : null;
  async function close(e) {
    e.preventDefault();
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api("/admin-tools/cash/close", {
        method: "POST",
        body: JSON.stringify({
          day,
          openingCash: opening,
          countedCash: counted,
          notes,
          fingerprint: data.fingerprint,
          revision: data.history[0]?.revision ?? 0,
        }),
      });
      setNotice(t("Mbyllja e arkës u ruajt."));
      initialized.current = "";
      setRevision((v) => v + 1);
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
          <h1>{t("Mbyllja ditore e arkës")}</h1>
          <p>
            {t(
              "Krahasoni pagesat cash me shumën e numëruar. Pagesat bankare paraqiten veçmas.",
            )}
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          {t("Rifresko")}
        </button>
      </div>
      <label className="cash-date">
        {t("Data")}
        <DateInput
          required
          max={calendarDay()}
          disabled={busy}
          value={day}
          onChange={(e) => {
            if (e.target.value) {
              setDay(e.target.value);
              setNotice("");
            }
          }}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {tm(error)}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {!data && !error && <p role="status">{t("Duke ngarkuar…")}</p>}
      {data && (
        <>
          {data.changedSinceClose && (
            <p className="duplicate-warning" role="alert">
              {t(
                "Pagesat kanë ndryshuar pas mbylljes. Kontrolloni dhe ruani një korrigjim.",
              )}
            </p>
          )}
          <div className="stats cash-stats">
            {[
              ["Pagesa cash", data.cashTotal + " €"],
              ["Pagesa bankare", data.bankTotal + " €"],
              ["Totali i pagesave", data.total + " €"],
              ["Numri i pagesave", data.paymentCount],
            ].map(([label, value]) => (
              <div className="card" key={label}>
                <span>{t(label)}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <form className="card cash-form" onSubmit={close}>
            <fieldset disabled={busy} className="workflow-fields">
              <div className="form-grid">
                {[
                  ["opening", "Cash në fillim të ditës", opening, setOpening],
                  ["counted", "Cash i numëruar në fund", counted, setCounted],
                ].map(([key, label, value, setter]) => (
                  <label key={key}>
                    {t(label)}
                    <input
                      required
                      inputMode="decimal"
                      pattern="[0-9]+([.][0-9]{1,2})?"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <p>
                {t("Cash i pritur")}:{" "}
                <strong>
                  {expected === null ? "—" : centsMoney(expected) + " €"}
                </strong>
              </p>
              <p
                className={
                  difference !== null && difference !== 0n ? "task-due" : ""
                }
              >
                {t("Diferenca")}:{" "}
                <strong>
                  {difference === null ? "—" : centsMoney(difference) + " €"}
                </strong>
              </p>
              <small>
                {t(
                  "Cash i pritur = cash në fillim + pagesat cash të ditës. Shpenzimet dhe tërheqjet shpjegohen te shënimet e diferencës.",
                )}
              </small>
              <label>
                {t("Shënime / Arsyeja e diferencës")}
                <textarea
                  rows={3}
                  maxLength={2000}
                  required={
                    Boolean(data.history.length) ||
                    (difference !== null && difference !== 0n)
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={
                  expected === null ||
                  difference === null ||
                  day > calendarDay()
                }
              >
                {busy
                  ? t("Duke ruajtur…")
                  : data.history.length
                    ? t("Ruaj korrigjimin e mbylljes")
                    : t("Konfirmo mbylljen e arkës")}
              </button>
            </fieldset>
          </form>
          {data.history.length > 0 && (
            <section className="card cash-history">
              <h2>{t("Historiku i mbylljeve")}</h2>
              {data.history.map((row) => (
                <div className="task-row" key={row.id}>
                  <div>
                    <strong>
                      {t("Mbyllja {0}", [row.revision])} · {row.user.name}
                    </strong>
                    <small>
                      {date(row.createdAt)} · {row.paymentCount} {t("pagesa")}
                    </small>
                    <p>
                      {t("Cash i pritur")}: {row.expectedCash} € ·{" "}
                      {t("Cash i numëruar")}: {row.countedCash} € ·{" "}
                      {t("Diferenca")}: {row.difference} €
                    </p>
                    <p>
                      {t("Pagesa cash")}: {row.cashTotal} € ·{" "}
                      {t("Pagesa bankare")}: {row.bankTotal} €
                    </p>
                    {row.notes && <p className="task-notes">{row.notes}</p>}
                  </div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
