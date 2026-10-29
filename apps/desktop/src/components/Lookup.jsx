import { useEffect, useState } from "react";
import StudentLookup from "./StudentLookup";
import { api } from "../services/api";
function ClassicLookup({
  endpoint,
  label,
  value,
  onChange,
  initialLabel = "",
}) {
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api(
        endpoint +
          (endpoint.includes("?") ? "&" : "?") +
          new URLSearchParams({ limit: "50", search }),
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) {
            const items = Array.isArray(result)
              ? result.filter((r) =>
                  (r.name ?? "").toLowerCase().includes(search.toLowerCase()),
                )
              : result.items;
            setRows(items);
            setError("");
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [endpoint, search]);
  const selected = rows.find((row) => row.id === value);
  return (
    <label>
      {label}
      <input
        aria-label={`Kërko: ${label}`}
        placeholder="Kërko për ta zgjedhur…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select
        aria-label={label}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Zgjidhni…</option>
        {value && !rows.some((r) => r.id === value) && (
          <option value={value}>{initialLabel || "Zgjedhja aktuale"}</option>
        )}
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name ?? `${r.firstName} ${r.lastName}`}
            {r.instructor?.name ? ` · ${r.instructor.name}` : ""}
          </option>
        ))}
      </select>
      {selected?.instructor?.name && (
        <small>
          Instruktori: <strong>{selected.instructor.name}</strong>
        </small>
      )}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export default function Lookup(props) {
  return props.endpoint.split("?")[0] === "/students" ? (
    <StudentLookup {...props} />
  ) : (
    <ClassicLookup {...props} />
  );
}
