import { lazy, Suspense, useEffect, useState } from "react";
import { useDialog } from "../hooks/useDialog";
const PdfPreview = lazy(() => import("./PdfPreview"));
export default function PdfWorkspace({ children }) {
  const [document, setDocument] = useState(null);
  useEffect(() => {
    const open = (event) =>
      setDocument({ ...event.detail, key: crypto.randomUUID() });
    window.addEventListener("pdf-preview", open);
    return () => window.removeEventListener("pdf-preview", open);
  }, []);
  return (
    <>
      {children}
      {document && (
        <Suspense fallback={<PdfLoading close={() => setDocument(null)} />}>
          <PdfPreview
            key={document.key}
            path={document.path}
            filename={document.filename}
            autoPrint={document.autoPrint}
            close={() => setDocument(null)}
          />
        </Suspense>
      )}
    </>
  );
}

function PdfLoading({ close }) {
  useDialog(close);
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Pamja PDF"
      >
        <p role="status">Duke hapur shikuesin PDF…</p>
        <button className="secondary" onClick={close}>
          Mbyll
        </button>
      </section>
    </div>
  );
}
