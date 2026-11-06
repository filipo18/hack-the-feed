import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { COPY, PRODUCT_NAME, type Audience } from "../content";
import { saveSession } from "../lib/session";

export function Login() {
  const [params] = useSearchParams();
  const [audience, setAudience] = useState<Audience>(params.get("as") === "creators" ? "creators" : "brands");
  const [name, setName] = useState("");
  const navigate = useNavigate();
  const isBrand = audience === "brands";

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim().replace(/^@/, "");
    if (!clean) return;
    saveSession({ audience, name: clean });
    navigate("/app");
  }

  return (
    <main className="login">
      <Link className="wordmark" to={COPY[audience].path}>
        {PRODUCT_NAME}
      </Link>
      <form className="login-card" onSubmit={submit}>
        <h1 className="display">{isBrand ? "See who posts you." : "See who you post."}</h1>
        <div className="switch switch-light" role="group" aria-label="Choose your side">
          <button type="button" className={isBrand ? "active" : undefined} onClick={() => setAudience("brands")}>
            Brand
          </button>
          <button type="button" className={isBrand ? undefined : "active"} onClick={() => setAudience("creators")}>
            Creator
          </button>
        </div>
        <label htmlFor="login-name">{isBrand ? "Your brand" : "Your handle"}</label>
        <input
          id="login-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={isBrand ? "Birkenstock" : "yourname"}
          autoComplete="off"
          required
        />
        <button type="submit" className="pill pill-primary">
          Open my dashboard
        </button>
      </form>
    </main>
  );
}
