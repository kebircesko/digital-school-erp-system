import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "../services/api";

const nameOf = (student) => `${student.firstName} ${student.lastName}`;

export default function StudentLookup({
  endpoint,
  label,
  value,
  onChange,
  initialLabel = "",
}) {
  const id = useId(),
    box = useRef(null),
    input = useRef(null),
    cache = useRef(new Map());
  const [text, setText] = useState(value ? initialLabel : "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [active, setActive] = useState(-1);
  const current =
    result?.query === query && result?.endpoint === endpoint ? result : null;
  const rows = current?.rows ?? [];

  useEffect(() => {
    input.current?.setCustomValidity(
      value || !text ? "" : "Zgjidhni nxënësin nga sugjerimet poshtë.",
    );
  }, [value, text]);
  useEffect(() => {
    if (!value) return;
    const remembered = cache.current.get(`${endpoint}:${value}`);
    if (remembered || initialLabel) {
      setText(remembered ? nameOf(remembered) : initialLabel);
      return;
    }
    const controller = new AbortController();
    api(`/students/${value}`, { signal: controller.signal })
      .then((student) => {
        if (!controller.signal.aborted) {
          cache.current.set(`${endpoint}:${student.id}`, student);
          setText(nameOf(student));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [value, initialLabel, endpoint]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(
        endpoint +
          (endpoint.includes("?") ? "&" : "?") +
          new URLSearchParams({ limit: "12", search: query }),
        { signal: controller.signal },
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          for (const student of data.items)
            cache.current.set(`${endpoint}:${student.id}`, student);
          setResult({ query, endpoint, rows: data.items, total: data.total });
          setActive(data.items.length ? 0 : -1);
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResult({ query, endpoint, rows: [], error: error.message });
        });
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, query, open]);
  useEffect(() => {
    const outside = (event) => {
      if (!box.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function choose(student) {
    cache.current.set(`${endpoint}:${student.id}`, student);
    setText(nameOf(student));
    setQuery("");
    setOpen(false);
    setActive(-1);
    onChange(student.id);
  }
  function change(event) {
    setText(event.target.value);
    setQuery(event.target.value.trim());
    setOpen(true);
    setActive(-1);
    if (value) onChange("");
  }
  function keydown(event) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (rows.length) {
        const next =
          active < 0
            ? event.key === "ArrowDown"
              ? 0
              : rows.length - 1
            : event.key === "ArrowDown"
              ? (active + 1) % rows.length
              : (active - 1 + rows.length) % rows.length;
        setActive(next);
        document
          .getElementById(`${id}-option-${next}`)
          ?.scrollIntoView({ block: "nearest" });
      }
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (rows.length) choose(rows[active >= 0 ? active : 0]);
    }
    if (event.key === "Tab") setOpen(false);
  }
  return (
    <div
      className="student-lookup"
      ref={box}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="student-lookup-input">
        <Search size={17} aria-hidden="true" />
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-label={`Kërko: ${label}`}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open && rows[active] ? `${id}-option-${active}` : undefined
          }
          placeholder="Shkruani emrin, prindin ose telefonin…"
          autoComplete="off"
          spellCheck={false}
          required
          value={text}
          onChange={change}
          onKeyDown={keydown}
          onFocus={() => setOpen(true)}
        />
        {text && (
          <button
            type="button"
            className="icon-button"
            aria-label={`Pastro zgjedhjen: ${label}`}
            onClick={() => {
              setText("");
              setQuery("");
              setActive(-1);
              onChange("");
              input.current.focus();
              setOpen(true);
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && (
        <div className="student-lookup-results">
          {!current ? (
            <p role="status">Duke kërkuar nxënësit…</p>
          ) : current.error ? (
            <p role="alert">{current.error}</p>
          ) : (
            <>
              <ul
                id={`${id}-list`}
                role="listbox"
                aria-label={`Sugjerime: ${label}`}
              >
                {rows.map((student, index) => (
                  <li
                    key={student.id}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={student.id === value}
                    className={index === active ? "highlighted" : ""}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => choose(student)}
                  >
                    <strong>{nameOf(student)}</strong>
                    <small>
                      {[student.parentName, student.parentPhone]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </li>
                ))}
              </ul>
              {!rows.length && (
                <p role="status">
                  Nuk u gjetën nxënës. Provoni një emër ose telefon tjetër.
                </p>
              )}
              {current.total > rows.length && (
                <p className="student-lookup-hint">
                  Shfaqen {rows.length} nga {current.total}. Shkruani më shumë
                  shkronja për ta ngushtuar kërkimin.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
