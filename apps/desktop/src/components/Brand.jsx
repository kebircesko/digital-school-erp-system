import { t } from "../services/i18n.js";
import { GraduationCap } from "lucide-react";
export default function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <GraduationCap size={28} />
      </div>
      <div>
        <strong>{t("SHKOLLA DIGJITALE")}</strong>
        <span>{t("PRIZREN · ERP")}</span>
      </div>
    </div>
  );
}
