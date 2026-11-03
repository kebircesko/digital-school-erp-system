import { t, getLanguage } from "./i18n.js";
let token = null;
export function normalizeApiUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(t("Adresa e serverit është e pavlefshme."));
  }
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      t(
        "Serveri në internet kërkon HTTPS. HTTP lejohet vetëm në këtë kompjuter.",
      ),
    );
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname || "/api";
  return url.toString().replace(/\/$/, "");
}
const defaultBase = normalizeApiUrl(
  import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3000/api",
);
let base = defaultBase;
try {
  const saved = localStorage.getItem("erp-api-url");
  if (saved) base = normalizeApiUrl(saved);
} catch {}
const sessionKey = "erp-session";
try {
  const saved = JSON.parse(sessionStorage.getItem(sessionKey));
  if (saved?.server === base && typeof saved.token === "string")
    token = saved.token;
} catch {}
export const hasSession = () => Boolean(token);
export const setToken = (value) => {
  token = value;
  try {
    if (value)
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          server: base,
          token: value,
        }),
      );
    else sessionStorage.removeItem(sessionKey);
  } catch {}
};
export const getApiUrl = () => base;
export function setApiUrl(value) {
  const next = normalizeApiUrl(value);
  localStorage.setItem("erp-api-url", next);
  base = next;
  setToken(null);
}
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(base + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": getLanguage(),
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      t(
        "Nuk mund të lidhemi me serverin. Kontrolloni lidhjen dhe konfigurimin e API-së.",
      ),
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("session-expired"));
    if (response.status === 429)
      throw new Error(
        t("Shumë kërkesa. Prisni një minutë dhe provoni përsëri."),
      );
    throw new Error(
      Array.isArray(body.message)
        ? body.message.join(" • ")
        : (body.message ?? t("Veprimi dështoi.")),
    );
  }
  return body;
}
export async function fetchFile(path, signal) {
  const response = await fetch(base + path, {
    headers: {
      "Accept-Language": getLanguage(),
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
    signal: signal ?? AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("session-expired"));
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? t("Shkarkimi dështoi."));
  }
  return {
    buffer: await response.arrayBuffer(),
    type: response.headers.get("content-type") ?? "application/octet-stream",
  };
}
export async function saveFile(buffer, filename, type = "application/pdf") {
  if (window.desktop)
    return window.desktop.saveFile(
      new Uint8Array(buffer),
      filename,
      getLanguage(),
    );
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type,
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function download(path, filename, preview = false) {
  if (preview) {
    window.dispatchEvent(
      new CustomEvent("pdf-preview", {
        detail: {
          path,
          filename,
          autoPrint: preview === "print",
        },
      }),
    );
    return;
  }
  const { buffer, type } = await fetchFile(path);
  return saveFile(buffer, filename, type);
}
