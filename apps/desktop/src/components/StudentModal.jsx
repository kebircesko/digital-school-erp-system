import { FormInput } from "./DateInput";
import { t, tm } from "../services/i18n.js";
import { useState, useEffect } from "react";
import Lookup from "./Lookup";
import { calendarDay, date } from "../services/format";
import { X } from "lucide-react";
import { api } from "../services/api";
import { useDialog } from "../hooks/useDialog";
import { InvoiceDialog } from "./InvoiceDialog";
const empty = {
  firstName: "",
  lastName: "",
  birthDate: "",
  parentName: "",
  parentPhone: "",
  address: "",
  notes: "",
  status: "ACTIVE",
};
export default function StudentModal({
  student,
  close,
  saved,
  readOnly,
  user,
}) {
  const [step, setStep] = useState("details");
  const [withGroup, setWithGroup] = useState(student === "new");
  const [matches, setMatches] = useState([]);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [registration, setRegistration] = useState(null);
  const [enrollment, setEnrollment] = useState({
    groupId: "",
    groupName: "",
    startDate: calendarDay(),
    endDate: "",
    monthlyPrice: "0.00",
    discount: "0.00",
    offer: "",
    issueInvoice: false,
  });
  const [form, setForm] = useState(
      student === "new"
        ? empty
        : {
            firstName: student.firstName,
            lastName: student.lastName,
            birthDate: student.birthDate.slice(0, 10),
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            address: student.address ?? "",
            notes: student.notes ?? "",
            status: student.status,
          },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    setMatches([]);
    setAllowDuplicate(false);
  }, [form.firstName, form.lastName, form.birthDate]);
  useDialog(close, busy, !registration);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const duplicateRows = await api(
        `/admin-tools/duplicates?${new URLSearchParams({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), birthDate: form.birthDate, ...(student === "new" && withGroup ? { requestId } : {}), ...(student === "new" ? {} : { excludeId: student.id }) })}`,
      );
      setMatches(duplicateRows);
      if (duplicateRows.length && !allowDuplicate) return;
      if (student === "new" && withGroup && step !== "review") {
        if (
          step === "group" &&
          Number(enrollment.discount) > Number(enrollment.monthlyPrice)
        )
          throw new Error(t("Zbritja nuk mund ta tejkalojë çmimin."));
        setStep(step === "details" ? "group" : "review");
        return;
      }
      const onboard = student === "new" && withGroup;
      const { groupName, ...enrollmentData } = enrollment;
      const result = await api(
        onboard
          ? "/admin-tools/onboard"
          : student === "new"
            ? "/students"
            : `/students/${student.id}`,
        {
          method: student === "new" ? "POST" : "PATCH",
          body: JSON.stringify({
            ...form,
            allowDuplicate,
            ...(onboard
              ? {
                  ...enrollmentData,
                  requestId,
                  ...(enrollmentData.endDate ? {} : { endDate: undefined }),
                }
              : {}),
            ...(student === "new"
              ? {}
              : {
                  version: student.version,
                }),
          }),
        },
      );
      window.dispatchEvent(new Event("student-updated"));
      if (onboard) window.dispatchEvent(new Event("billing-updated"));
      if (onboard && result.invoice) setRegistration(result);
      else saved(onboard ? result.student : result);
    } catch (e) {
      if (e.details?.duplicates) {
        setMatches(e.details.duplicates);
        setAllowDuplicate(false);
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function field(key, label, type = "text", required = true, maxLength = 160) {
    return (
      <label>
        {label}
        <FormInput
          autoFocus={key === "firstName"}
          disabled={readOnly || busy}
          type={type}
          required={required}
          maxLength={maxLength}
          value={form[key] ?? ""}
          max={
            type === "date" ? new Date().toISOString().slice(0, 10) : undefined
          }
          onChange={(e) =>
            setForm({
              ...form,
              [key]: e.target.value,
            })
          }
        />
      </label>
    );
  }
  if (registration)
    return (
      <InvoiceDialog
        id={registration.invoice.id}
        user={user}
        pay
        close={() => saved(registration.student)}
      />
    );
  return (
    <div className="modal-backdrop">
      <section
        className="modal student-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{t("TË DHËNAT E NXËNËSIT")}</span>
            <h2 id="student-title">
              {student === "new"
                ? t("Regjistro nxënës")
                : readOnly
                  ? t("Profili i nxënësit")
                  : t("Ndrysho nxënësin")}
            </h2>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            aria-label={t("Mbyll formularin")}
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="student-form-body">
            {student === "new" && withGroup && (
              <p className="workflow-steps" role="status">
                {t("Nxënësi → Grupi dhe çmimi → Konfirmimi")} ·{" "}
                {step === "details" ? "1/3" : step === "group" ? "2/3" : "3/3"}
              </p>
            )}
            {step === "details" && (
              <div className="form-grid">
                {field("firstName", t("Emri"), "text", true, 80)}
                {field("lastName", t("Mbiemri"), "text", true, 80)}
                {field("birthDate", t("Data e lindjes"), "date")}
                <label>
                  {t("Statusi")}
                  <select
                    disabled={readOnly || busy}
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value,
                      })
                    }
                  >
                    <option value="ACTIVE">{t("Aktiv")}</option>
                    <option value="INACTIVE">{t("Joaktiv")}</option>
                  </select>
                </label>
                {field("parentName", t("Emri i prindit / kujdestarit"))}
                {field("parentPhone", t("Telefoni i prindit"), "tel", true, 30)}
                <div className="full">
                  {field("address", t("Adresa"), "text", false, 300)}
                </div>
                <label className="full">
                  {t("Shënime shtesë")}
                  <textarea
                    disabled={readOnly || busy}
                    maxLength={2000}
                    rows={3}
                    value={form.notes}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        notes: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
            )}
            {student === "new" && step === "details" && (
              <label className="workflow-check">
                <input
                  type="checkbox"
                  checked={withGroup}
                  disabled={busy}
                  onChange={(e) => setWithGroup(e.target.checked)}
                />
                {t("Vazhdo me grupin dhe faturën e parë")}
              </label>
            )}
            {step === "group" && (
              <fieldset disabled={busy} className="workflow-fields">
                <Lookup
                  endpoint="/groups?status=ACTIVE"
                  label={t("Grupi")}
                  value={enrollment.groupId}
                  initialLabel={enrollment.groupName}
                  onChange={(id, row) =>
                    setEnrollment({
                      ...enrollment,
                      groupId: id,
                      groupName: row?.name ?? "",
                      monthlyPrice:
                        row?.course?.monthlyPrice ?? enrollment.monthlyPrice,
                    })
                  }
                />
                <div className="form-grid">
                  {[
                    ["startDate", "Data e fillimit", "date"],
                    ["endDate", "Data e përfundimit", "date"],
                    ["monthlyPrice", "Çmimi individual mujor EUR", "text"],
                    ["discount", "Zbritja mujore EUR", "text"],
                  ].map(([key, label, type]) => (
                    <label key={key}>
                      {t(label)}
                      <FormInput
                        type={type}
                        required={key !== "endDate"}
                        value={enrollment[key]}
                        min={
                          key === "endDate" ? enrollment.startDate : undefined
                        }
                        inputMode={type === "text" ? "decimal" : undefined}
                        pattern={
                          type === "text" ? "[0-9]+([.][0-9]{1,2})?" : undefined
                        }
                        onChange={(e) =>
                          setEnrollment({
                            ...enrollment,
                            [key]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label>
                  {t("Oferta / Shënime")}
                  <textarea
                    maxLength={300}
                    value={enrollment.offer}
                    onChange={(e) =>
                      setEnrollment({ ...enrollment, offer: e.target.value })
                    }
                  />
                </label>
                {user?.role === "ADMIN" && (
                  <label className="workflow-check">
                    <input
                      type="checkbox"
                      checked={enrollment.issueInvoice}
                      onChange={(e) =>
                        setEnrollment({
                          ...enrollment,
                          issueInvoice: e.target.checked,
                        })
                      }
                    />
                    {t("Lësho faturën e parë pas konfirmimit")}
                  </label>
                )}
              </fieldset>
            )}
            {step === "review" && (
              <div className="workflow-review">
                <h3>
                  {form.firstName} {form.lastName}
                </h3>
                <p>{enrollment.groupName}</p>
                <p>
                  {date(enrollment.startDate)} →{" "}
                  {enrollment.endDate ? date(enrollment.endDate) : t("Pa afat")}
                </p>
                <p>
                  {t("Muaji")}: {enrollment.startDate.slice(0, 7)}
                </p>
                <p>
                  {t("Shuma")}:{" "}
                  <strong>
                    {(
                      Number(enrollment.monthlyPrice) -
                      Number(enrollment.discount)
                    ).toFixed(2)}{" "}
                    €
                  </strong>
                </p>
                <p>
                  {enrollment.issueInvoice
                    ? t("Fatura do të lëshohet dhe do të hapet pagesa.")
                    : t("Fatura e parë do të jetë për aprovim.")}
                </p>
              </div>
            )}
            {matches.length > 0 && (
              <div className="duplicate-warning" role="alert">
                <strong>
                  {t("Ekziston nxënës me të njëjtin emër dhe datëlindje.")}
                </strong>
                {matches.map((row) => (
                  <p key={row.id}>
                    {row.firstName} {row.lastName} · {date(row.birthDate)} ·{" "}
                    {row.parentName} · {row.parentPhone}
                  </p>
                ))}
                <label className="workflow-check">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={allowDuplicate}
                    onChange={(e) => setAllowDuplicate(e.target.checked)}
                  />
                  {t("E kontrollova; ky është nxënës tjetër.")}
                </label>
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {tm(error)}
              </div>
            )}
          </div>
          <div className="modal-actions">
            {step !== "details" && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setStep(step === "review" ? "group" : "details")}
              >
                {t("Kthehu")}
              </button>
            )}
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={close}
            >
              {readOnly ? t("Mbyll") : t("Anulo")}
            </button>
            {!readOnly && (
              <button className="primary" disabled={busy}>
                {busy
                  ? t("Duke ruajtur…")
                  : student === "new" && withGroup
                    ? step === "review"
                      ? enrollment.issueInvoice
                        ? t("Regjistro dhe lësho faturën")
                        : t("Konfirmo regjistrimin")
                      : t("Vazhdo")
                    : t("Ruaj nxënësin")}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
