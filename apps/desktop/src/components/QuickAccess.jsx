import { useContext, useEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { api } from "../services/api";
import { StudentWorkspaceContext } from "./StudentLink";
import StudentModal from "./StudentModal";
import { InvoiceDialog, NewInvoiceDialog } from "./InvoiceDialog";
import { PaymentEditor } from "../pages/Finance";

export default function QuickAccess({ user, navigate }) {
  const openStudent = useContext(StudentWorkspaceContext);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [menu, setMenu] = useState(false);
  const input = useRef(null);
  const container = useRef(null);
  const canWrite = user.role !== "INSTRUCTOR";
  useEffect(() => {
    const close = (event) => {
      if (!container.current?.contains(event.target)) {
        setMenu(false);
        setSearch("");
      }
    };
    const shortcut = (event) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", shortcut);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", shortcut);
    };
  }, []);
  useEffect(() => {
    setResults(null);
    setError("");
    if (!search.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(
        `/students?${new URLSearchParams({ search: search.trim(), limit: "6" })}`,
        { signal: controller.signal },
      )
        .then((data) => {
          if (!controller.signal.aborted) setResults(data);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);
  function open(id) {
    setSearch("");
    openStudent(id);
  }
  return (
    <div
      className="quick-access"
      ref={container}
      onKeyDown={(event) => {
        if (event.target.closest('[role="dialog"]')) return;
        if (event.key === "Escape") {
          setSearch("");
          setMenu(false);
          input.current?.focus();
        }
      }}
    >
      <div className="quick-search">
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          aria-label="Kërko nxënës nga çdo faqe"
          placeholder="Emër, prind ose telefon…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setMenu(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && search.trim()) {
              event.preventDefault();
              if (results?.total === 1) open(results.items[0].id);
              else {
                navigate("students", { search: search.trim() });
                setSearch("");
              }
            }
          }}
        />
        {search ? (
          <button
            aria-label="Pastro kërkimin"
            onClick={() => {
              setSearch("");
              input.current?.focus();
            }}
          >
            <X size={16} />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
        {search.trim() && (
          <div className="quick-results" aria-label="Rezultatet e kërkimit">
            {error ? (
              <p role="alert">{error}</p>
            ) : !results ? (
              <p role="status">Duke kërkuar…</p>
            ) : (
              <>
                {!results.items.length && <p>Nuk u gjetën nxënës.</p>}
                {results.items.map((student) => (
                  <button key={student.id} onClick={() => open(student.id)}>
                    <strong>
                      {student.firstName} {student.lastName}
                    </strong>
                    <small>
                      {student.parentName} · {student.parentPhone}
                    </small>
                    <span>Hap profilin / pagesat →</span>
                  </button>
                ))}
                <button
                  className="text-button"
                  onClick={() => {
                    navigate("students", { search: search.trim() });
                    setSearch("");
                  }}
                >
                  Shiko listën e plotë →
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {canWrite && (
        <div className="quick-create">
          <button
            className="primary"
            aria-expanded={menu}
            aria-controls="quick-create-actions"
            onClick={() => {
              setMenu(!menu);
              setSearch("");
            }}
          >
            <Plus size={17} />
            Veprim i ri
          </button>
          {menu && (
            <div id="quick-create-actions" className="quick-results">
              {[
                ["student", "Regjistro nxënës"],
                ["invoice", "Regjistro faturën"],
                ["payment", "Regjistro pagesë"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setAction(id);
                    setMenu(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {action === "student" && (
        <StudentModal
          student="new"
          close={() => setAction(null)}
          saved={(student) => {
            setAction(null);
            open(student.id);
          }}
        />
      )}
      {action === "invoice" && (
        <NewInvoiceDialog
          close={() => setAction(null)}
          created={(row) => {
            setAction(null);
            setInvoice(row.id);
          }}
        />
      )}
      {action === "payment" && (
        <PaymentEditor
          close={() => setAction(null)}
          saved={() => setAction(null)}
        />
      )}
      {invoice && (
        <InvoiceDialog
          id={invoice}
          user={user}
          close={() => setInvoice(null)}
        />
      )}
    </div>
  );
}
