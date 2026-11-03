import { t } from "../services/i18n.js";
export default function Badge({ status }) {
  return (
    <span className={status === "ACTIVE" ? "badge active" : "badge"}>
      <i />
      {status === "ACTIVE" ? t("Aktiv") : t("Joaktiv")}
    </span>
  );
}
