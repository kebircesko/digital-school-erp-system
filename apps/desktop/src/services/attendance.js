export const presentCount = (row) =>
  row.sourceCounts?.present ?? row.totalLessons - row.absences;
export function otherAttendance(row) {
  if (!row.sourceCounts) return "";
  const counts = row.sourceCounts;
  return [
    ["U", counts.undefined],
    ["T", counts.tardy],
    ["Pa shënim", counts.noAttendance],
  ]
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
}
