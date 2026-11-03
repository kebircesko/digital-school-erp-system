import * as translation from "@erp/shared/src/translate.mjs";
const { translate, translateMessage, supportedLanguage } = translation;
export const languageKey = "erp-language";
let language = "sq";
try {
  language = supportedLanguage(localStorage.getItem(languageKey));
} catch {}
const listeners = new Set();
export const getLanguage = () => language;
export const getLocale = () => (language === "en" ? "en-GB" : "sq-AL");
export function subscribeLanguage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function updateDocument() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.title =
    language === "en"
      ? "Digital School • Prizren"
      : "Shkolla Digjitale • Prizren";
}
export function setLanguage(value) {
  const next = supportedLanguage(value);
  if (next === language) return;
  language = next;
  try {
    localStorage.setItem(languageKey, language);
  } catch {}
  updateDocument();
  listeners.forEach((listener) => listener());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === languageKey) setLanguage(event.newValue);
  });
}
updateDocument();
export const t = (source, values) => translate(source, values, language);
export const tm = (source) => translateMessage(source, language);
