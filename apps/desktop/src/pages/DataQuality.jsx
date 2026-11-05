import { useState, useEffect } from "react";
import { t, tm } from "../services/i18n.js";
import { api } from "../services/api";
import { useSchoolUpdates } from "../hooks/useSchoolUpdates";
import StudentLink from "../components/StudentLink";
import MissingInvoiceMonths from "../components/MissingInvoiceMonths";

export default function DataQuality({ navigate }) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  const updates = useSchoolUpdates();
  const [showAllMissing, setShowAllMissing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    api("/admin-tools/data-quality", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [updates]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("Kontrolli i të dhënave")}</h1>
          <p>
            {t(
              "Nxënësit aktivë që kërkojnë kontroll ose plotësim të të dhënave.",
            )}
          </p>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {tm(error)}
        </p>
      )}
      {!data && !error && <p role="status">{t("Duke ngarkuar…")}</p>}
      <div className="quality-grid">
        {[
          [
            "recent",
            "Nxënës të rinj (30 ditë)",
            "Nxënës aktivë të shtuar në sistem gjatë 30 ditëve të fundit.",
          ],
          ["noGroup", "Pa grup", "Pa regjistrim aktiv në datën e sotme."],
          [
            "incompletePhone",
            "Telefon i paplotë",
            "Numra me gjatësi të pazakontë ose me të gjitha shifrat e njëjta.",
          ],
          [
            "endingSoon",
            "Regjistrime që përfundojnë",
            "Regjistrimet që përfundojnë brenda 30 ditëve.",
          ],
        ].map(([key, label, description]) => (
          <section className="card quality-card" key={key}>
            <h2>
              {t(label)} <span>{data?.[key]?.total ?? "—"}</span>
            </h2>
            <p>{t(description)}</p>
            {data?.[key]?.items.map((row) => (
              <div className="quality-row" key={row.id}>
                <StudentLink id={row.id}>
                  {row.firstName} {row.lastName}
                </StudentLink>
                {key === "incompletePhone" && (
                  <small>{row.parentPhone || "—"}</small>
                )}
              </div>
            ))}
            <button
              className="secondary"
              onClick={() =>
                navigate("students", { filter: key, status: "ACTIVE" })
              }
            >
              {t("Shiko listën e plotë")}
            </button>
          </section>
        ))}
        <section className="card quality-card invoice-gaps-card">
          <h2>
            {t("Muaj pa faturë")}{" "}
            <span>{data?.missingInvoices?.total ?? "—"}</span>
          </h2>
          <p>
            {t(
              "Nxënës aktivë me muaj pa faturë gjatë regjistrimeve të tyre. Rastet kërkojnë verifikim dhe nuk janë borxh automatik.",
            )}
          </p>
          {data?.missingInvoices?.items
            .slice(0, showAllMissing ? undefined : 10)
            .map((row) => (
              <div className="quality-row" key={row.id}>
                <StudentLink id={row.id}>
                  {row.firstName} {row.lastName}
                </StudentLink>
                <MissingInvoiceMonths data={row.missingInvoices} />
              </div>
            ))}
          {data?.missingInvoices?.total === 0 && (
            <p>{t("Nuk u gjetën muaj pa faturë.")}</p>
          )}
          {data?.missingInvoices?.total > 10 && (
            <button
              className="secondary"
              onClick={() => setShowAllMissing((value) => !value)}
            >
              {showAllMissing ? t("Shfaq më pak") : t("Shiko listën e plotë")}
            </button>
          )}
        </section>
      </div>
    </>
  );
}
