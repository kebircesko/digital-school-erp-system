import { useEffect, useState } from "react";
import { api } from "../services/api";
interface Choice {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  number?: string;
}
export default function Lookup({
  endpoint,
  label,
  value,
  onChange,
  initialLabel = "",
}: {
  endpoint: string;
  label: string;
  value: string;
  onChange: (id: string) => void;
  initialLabel?: string;
}) {
  const [search, setSearch] = useState(""),
    [rows, setRows] = useState<Choice[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<{ items: Choice[] } | Choice[]>(
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
          </option>
        ))}
      </select>
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}
