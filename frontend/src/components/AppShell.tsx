import type { ReactNode } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { PRODUCT_NAME } from "../content";
import { clearSession, readSession, type Session } from "../lib/session";

const LINKS = {
  brands: [
    { to: "/app", label: "Overview", end: true },
    { to: "/app/list", label: "Creators" },
    { to: "/app/pipeline", label: "Outreach" },
  ],
  creators: [
    { to: "/app", label: "Overview", end: true },
    { to: "/app/list", label: "Brands" },
    { to: "/app/pipeline", label: "Pitches" },
  ],
};

export function AppShell({ children }: { children: (session: Session) => ReactNode }) {
  const session = readSession();
  const navigate = useNavigate();
  if (!session) return <Navigate to="/login" replace />;

  function logOut() {
    clearSession();
    navigate(session?.audience === "creators" ? "/for-creators" : "/for-brands");
  }

  return (
    <div className="app">
      <header className="nav app-nav">
        <Link className="wordmark" to="/app">
          {PRODUCT_NAME}
        </Link>
        <nav className="switch" aria-label="Dashboard">
          {LINKS[session.audience].map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="app-account">
          <span>{session.audience === "brands" ? session.name : `@${session.name}`}</span>
          <button type="button" onClick={logOut}>
            Log out
          </button>
        </div>
      </header>
      <main className="workspace">{children(session)}</main>
    </div>
  );
}
