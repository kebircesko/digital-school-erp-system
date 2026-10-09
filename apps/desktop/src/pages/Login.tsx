import { useState, FormEvent } from "react";
import { ArrowUpRight, GraduationCap, ShieldCheck } from "lucide-react";
import type { User } from "@erp/shared";
import { api, setToken, getApiUrl, setApiUrl } from "../services/api";
import Brand from "../components/Brand";
export default function Login({
  onLogin,
  message,
}: {
  onLogin: (user: User) => void;
  message: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [server, setServer] = useState(getApiUrl()),
    [serverNotice, setServerNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="login-art">
        <Brand />
        <div>
          <span className="eyebrow">SHKOLLA DIGJITALE PRIZREN</span>
          <h1>
            Më shumë kohë
            <br />
            për të ardhmen.
          </h1>
          <p>
            Një hapësirë e përbashkët për njerëzit, të dhënat dhe punën e
            përditshme të shkollës.
          </p>
          <div className="orb">
            <GraduationCap size={120} />
          </div>
        </div>
        <small>Platforma ERP · Qasje e autorizuar</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">MIRË SE ERDHËT</span>
          <h2>Kyçuni në hapësirën tuaj</h2>
          <p>Përdorni llogarinë e caktuar nga administratori.</p>
          <form onSubmit={submit}>
            <label>
              Emaili
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
              Fjalëkalimi
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
                {error || message}
              </div>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Duke u kyçur…" : "Kyçu në platformë"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          <details className="server-settings">
            <summary>Konfigurimi i serverit</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setError("");
                setServerNotice("");
                try {
                  setApiUrl(server);
                  setServer(getApiUrl());
                  setServerNotice("Adresa u ruajt. Mund të kyçeni.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label>
                Adresa e API-së
                <input
                  type="url"
                  required
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="https://serveri.shkolla.com/api"
                />
              </label>
              <p>
                Për disa kompjuterë përdorni të njëjtën adresë HTTPS të serverit
                të shkollës.
              </p>
              <button type="submit" disabled={busy}>
                Ruaj adresën
              </button>
              {serverNotice && (
                <div className="success" role="status">
                  {serverNotice}
                </div>
              )}
            </form>
          </details>
          <div className="login-security">
            <ShieldCheck size={17} />
            Sesione të sigurta dhe qasje sipas rolit.
          </div>
        </div>
      </section>
    </div>
  );
}
