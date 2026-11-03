import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  t,
} from "../services/i18n.js";
import { useSyncExternalStore } from "react";
import { Languages } from "lucide-react";
export function useLanguage() {
  return useSyncExternalStore(subscribeLanguage, getLanguage, () => "sq");
}
export default function LanguageSelector() {
  const language = useLanguage();
  return (
    <label className="language-selector">
      <Languages size={17} aria-hidden="true" />
      <select
        aria-label={t("Gjuha")}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option value="sq" lang="sq">
          Shqip
        </option>
        <option value="en" lang="en">
          English
        </option>
      </select>
    </label>
  );
}
