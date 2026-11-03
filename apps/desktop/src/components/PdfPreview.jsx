import { t, tm } from "../services/i18n.js";
import { useLanguage } from "./LanguageSelector";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, X } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { fetchFile, saveFile } from "../services/api";
import { useDialog } from "../hooks/useDialog";
GlobalWorkerOptions.workerSrc = workerUrl;
export default function PdfPreview({ path, filename, autoPrint, close }) {
  const language = useLanguage();
  const container = useRef(null),
    bytes = useRef(null),
    printed = useRef(false);
  const [pages, setPages] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useDialog(close, busy);
  useEffect(() => {
    const controller = new AbortController();
    let task,
      render,
      stopped = false;
    setPages([]);
    setError("");
    bytes.current = null;
    container.current.replaceChildren();
    (async () => {
      const { buffer } = await fetchFile(path, controller.signal);
      if (stopped) return;
      if (buffer.byteLength > 20 * 1024 * 1024)
        throw new Error(t("PDF-ja është më e madhe se 20 MB."));
      bytes.current = buffer;
      task = getDocument({
        data: new Uint8Array(buffer.slice(0)),
        isEvalSupported: false,
      });
      const pdf = await task.promise;
      const images = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        if (stopped) return;
        const page = await pdf.getPage(number);
        const viewport = page.getViewport({
          scale: 2,
        });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.setAttribute("aria-label", t("Faqja {0} e PDF-së", [number]));
        render = page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
        });
        await render.promise;
        if (stopped) return;
        container.current.append(canvas);
        images.push(canvas.toDataURL("image/png"));
      }
      if (!stopped) setPages(images);
    })().catch((error) => {
      if (!stopped) setError(error.message || t("PDF-ja nuk mund të hapej."));
    });
    return () => {
      stopped = true;
      controller.abort();
      render?.cancel();
      task?.destroy().catch(() => {});
    };
  }, [path, revision, language]);
  async function print() {
    if (!pages.length) return;
    try {
      await Promise.all(
        [...document.querySelectorAll(".pdf-print-pages img")].map((image) =>
          image.decode(),
        ),
      );
      window.print();
    } catch (error) {
      setError(error.message || t("Printimi nuk mund të hapej."));
    }
  }
  useEffect(() => {
    if (!autoPrint || !pages.length || printed.current) return;
    printed.current = true;
    const frame = requestAnimationFrame(print);
    return () => cancelAnimationFrame(frame);
  }, [autoPrint, pages]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await saveFile(bytes.current, filename);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="modal-backdrop pdf-preview-backdrop">
        <section
          className="modal pdf-preview"
          role="dialog"
          aria-modal="true"
          aria-label={t("Pamja PDF")}
        >
          <div className="modal-heading">
            <div>
              <h2>{t("Shiko PDF")}</h2>
              <p>{filename}</p>
            </div>
            <button
              aria-label={t("Mbyll PDF-në")}
              className="icon-button"
              disabled={busy}
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
          <div className="pdf-preview-toolbar">
            <button
              className="primary"
              disabled={!pages.length || busy}
              onClick={print}
            >
              <Printer size={17} />
              {t("Printo")}
            </button>
            <button
              className="secondary"
              disabled={!pages.length || busy}
              onClick={save}
            >
              <Download size={17} />
              {busy ? t("Duke ruajtur…") : t("Ruaj PDF")}
            </button>
            <span>
              {pages.length
                ? t("{0} faqe", [pages.length])
                : t("Duke përgatitur PDF-në…")}
            </span>
          </div>
          {error && (
            <div className="error" role="alert">
              {tm(error)}
              <button onClick={() => setRevision((value) => value + 1)}>
                {t("Provo përsëri")}
              </button>
            </div>
          )}
          {!pages.length && !error && (
            <p role="status">{t("Duke ngarkuar PDF-në…")}</p>
          )}
          <div className="pdf-canvas-pages" ref={container} />
        </section>
      </div>
      {createPortal(
        <div className="pdf-print-pages" aria-hidden="true">
          {pages.map((src, index) => (
            <div className="pdf-print-page" key={index}>
              <img src={src} alt={t("Faqja {0}", [index + 1])} />
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
