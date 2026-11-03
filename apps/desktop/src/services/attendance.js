import { t } from "./i18n.js";
export const presentCount = (row) =>
  row.sourceCounts?.present ?? row.totalLessons - row.absences;
export function otherAttendance(row) {
  if (!row.sourceCounts) return "";
  const counts = row.sourceCounts;
  return [
    [t("U"), counts.undefined],
    [t("T"), counts.tardy],
    [t("Pa shënim"), counts.noAttendance],
  ]
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
}
