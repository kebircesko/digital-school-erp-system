let token: string | null = null;
export const setToken = (value: string | null) => {
  token = value;
};
export function normalizeApiUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Adresa e serverit është e pavlefshme.");
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
      "Serveri në internet kërkon HTTPS. HTTP lejohet vetëm në këtë kompjuter.",
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
export const getApiUrl = () => base;
export function setApiUrl(value: string) {
  const next = normalizeApiUrl(value);
  localStorage.setItem("erp-api-url", next);
  base = next;
  setToken(null);
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error(
      "Nuk mund të lidhemi me serverin. Kontrolloni lidhjen dhe konfigurimin e API-së.",
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("session-expired"));
    if (response.status === 429)
      throw new Error("Shumë kërkesa. Prisni një minutë dhe provoni përsëri.");
    throw new Error(
      Array.isArray(body.message)
        ? body.message.join(" • ")
        : (body.message ?? "Veprimi dështoi."),
    );
  }
  return body;
}
export async function download(
  path: string,
  filename: string,
  preview = false,
) {
  const response = await fetch(base + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message ?? "Shkarkimi dështoi.");
  }
  const buffer = await response.arrayBuffer();
  if (preview && window.desktop) {
    await window.desktop.openPdf(new Uint8Array(buffer));
    return;
  }
  if (window.desktop) {
    await window.desktop.saveFile(new Uint8Array(buffer), filename);
    return;
  }
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: response.headers.get("content-type") ?? "application/octet-stream",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
