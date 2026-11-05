import { t, tm } from "../services/i18n.js";
import { useState, useEffect } from "react";
import { StudentWorkspaceContext } from "./StudentLink";
import StudentHistory from "./StudentHistory";
import StudentModal from "./StudentModal";
import { ResourceEditor } from "../pages/ResourcePage";
import { getResources } from "../pages/resources";
import { useDialog } from "../hooks/useDialog";
import { api } from "../services/api";
import { InvoiceDialog, NewInvoiceDialog } from "./InvoiceDialog";
function StudentProfile({ id, user, close }) {
  const [student, setStudent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useDialog(close, false, !student && !editing && !enrolling);
  useEffect(() => {
    const controller = new AbortController();
    api(`/students/${id}`, {
      signal: controller.signal,
    })
      .then((row) => {
        if (!controller.signal.aborted) setStudent(row);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id, revision]);
  if (invoicing && student)
    return (
      <NewInvoiceDialog
        initialStudent={student}
        close={() => setInvoicing(false)}
        created={(invoice) => {
          setInvoicing(false);
          setCreatedInvoice(invoice.id);
          setRevision((v) => v + 1);
          window.dispatchEvent(new Event("billing-updated"));
        }}
      />
    );
  if (createdInvoice)
    return (
      <InvoiceDialog
        id={createdInvoice}
        user={user}
        pay
        close={() => {
          setCreatedInvoice(null);
          setRevision((v) => v + 1);
        }}
        saved={() => setRevision((v) => v + 1)}
      />
    );
  if (enrolling && student)
    return (
      <ResourceEditor
        config={getResources().enrollments}
        row="new"
        initialValues={{
          studentId: id,
        }}
        initialLabels={{
          studentId: `${student.firstName} ${student.lastName}`,
        }}
        close={() => setEnrolling(false)}
        saved={() => {
          setEnrolling(false);
          setRevision((v) => v + 1);
          window.dispatchEvent(new Event("student-updated"));
        }}
      />
    );
  if (editing && student)
    return (
      <StudentModal
        user={user}
        student={student}
        close={() => setEditing(false)}
        saved={() => {
          setEditing(false);
          setStudent(null);
          setRevision((v) => v + 1);
        }}
      />
    );
  if (!student)
    return (
      <div className="modal-backdrop">
        <section
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={t("Profili i nxënësit")}
        >
          <p role={error ? "alert" : "status"}>
            {tm(error) || t("Duke ngarkuar nxënësin…")}
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={close}>
              {t("Mbyll")}
            </button>
          </div>
        </section>
      </div>
    );
  return (
    <StudentHistory
      canManageTasks={user.role === "ADMIN"}
      canManageEnrollments={user.role !== "INSTRUCTOR"}
      key={`${id}:${revision}`}
      id={id}
      name={`${student.firstName} ${student.lastName}`}
      student={student}
      close={close}
      enroll={user.role !== "INSTRUCTOR" ? () => setEnrolling(true) : undefined}
      edit={user.role !== "INSTRUCTOR" ? () => setEditing(true) : undefined}
      createInvoice={
        user.role === "ADMIN" ? () => setInvoicing(true) : undefined
      }
    />
  );
}
export default function StudentWorkspace({ user, children }) {
  const [selection, setSelection] = useState(null);
  return (
    <StudentWorkspaceContext.Provider
      value={(id) =>
        setSelection((previous) => ({
          id,
          revision: (previous?.revision ?? 0) + 1,
        }))
      }
    >
      {children}
      {selection && (
        <StudentProfile
          key={`${selection.id}:${selection.revision}`}
          id={selection.id}
          user={user}
          close={() => setSelection(null)}
        />
      )}
    </StudentWorkspaceContext.Provider>
  );
}
