import { t, tm } from "../services/i18n.js";
import LanguageSelector from "../components/LanguageSelector";
import { useState } from "react";
import { ArrowUpRight, GraduationCap, ShieldCheck } from "lucide-react";
import { api, setToken, getApiUrl, setApiUrl } from "../services/api";
import Brand from "../components/Brand";
export default function Login({ onLogin, message }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [server, setServer] = useState(getApiUrl()),
    [serverNotice, setServerNotice] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });
      setToken(result.token);
      onLogin(result.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-art">
        <Brand />
        <div>
          <span className="eyebrow">{t("SHKOLLA DIGJITALE PRIZREN")}</span>
          <h1>
            {t("Më shumë kohë")}
            <br />
            {t("për të ardhmen.")}
          </h1>
          <p>
            {t(
              "Një hapësirë e përbashkët për njerëzit, të dhënat dhe punën e përditshme të shkollës.",
            )}
          </p>
          <div className="orb">
            <GraduationCap size={120} />
          </div>
        </div>
        <small>{t("Platforma ERP · Qasje e autorizuar")}</small>
      </section>
      <section className="login-form">
        <LanguageSelector />
        <div>
          <span className="eyebrow">{t("MIRË SE ERDHËT")}</span>
          <h2>{t("Kyçuni në hapësirën tuaj")}</h2>
          <p>{t("Përdorni llogarinë e caktuar nga administratori.")}</p>
          <form onSubmit={submit}>
            <label>
              {t("Emaili")}
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="emri@shkolla.com"
              />
            </label>
            <label>
              {t("Fjalëkalimi")}
              <input
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {(error || message) && (
              <div className="error" role="alert">
                {tm(error || message)}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? t("Duke u kyçur…") : t("Kyçu në platformë")}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <details className="server-settings">
            <summary>{t("Konfigurimi i serverit")}</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setServerNotice("");
                try {
                  setApiUrl(server);
                  setServer(getApiUrl());
                  setServerNotice(t("Adresa u ruajt. Mund të kyçeni."));
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <label>
                {t("Adresa e API-së")}
                <input
                  type="url"
                  required
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="https://serveri.shkolla.com/api"
                />
              </label>
              <p>
                {t(
                  "Për disa kompjuterë përdorni të njëjtën adresë HTTPS të serverit të shkollës.",
                )}
              </p>
              <button type="submit" disabled={busy}>
                {t("Ruaj adresën")}
              </button>
              {serverNotice && (
                <div className="success" role="status">
                  {tm(serverNotice)}
                </div>
              )}
            </form>
          </details>
          <div className="login-security">
            <ShieldCheck size={17} />
            {t("Sesione të sigurta dhe qasje sipas rolit.")}
          </div>
        </div>
      </section>
    </div>
  );
}
