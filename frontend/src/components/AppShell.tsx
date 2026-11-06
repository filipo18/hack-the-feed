import type { ReactNode } from "react";
import { Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { PRODUCT_NAME } from "../content";
import { USING_SAMPLE_DATA } from "../lib/api";
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
      <aside className="rail">
        <Link className="wordmark" to="/app">
          {PRODUCT_NAME}
        </Link>
        <nav aria-label="Dashboard">
          {LINKS[session.audience].map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <p>{session.audience === "brands" ? session.name : `@${session.name}`}</p>
          <button type="button" onClick={logOut}>
            Log out
          </button>
        </div>
      </aside>
      <main className="workspace">
        {USING_SAMPLE_DATA && <p className="sample-tag workspace-tag">Sample data</p>}
        {children(session)}
      </main>
    </div>
  );
}
