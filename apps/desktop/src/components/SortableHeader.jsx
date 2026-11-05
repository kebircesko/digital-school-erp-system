export default function SortableHeader({ label, column, sort, onSort }) {
  const active = sort?.key === column;
  return (
    <th
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button className="sortable-header" onClick={() => onSort(column)}>
        {label}{" "}
        <span aria-hidden="true">
          {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
