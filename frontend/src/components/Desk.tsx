import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { PRODUCT_NAME } from "../content";
import { clearSession, type Session } from "../lib/session";

export function Desk({
  session,
  listLabel,
  pipelineLabel,
  stat,
  children,
}: {
  session: Session;
  listLabel: string;
  pipelineLabel: string;
  stat?: { value: string; label: string; note: string };
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const isBrand = session.audience === "brands";

  function logOut() {
    clearSession();
    navigate(isBrand ? "/for-brands" : "/for-creators");
  }

  return (
    <div className="desk">
      <aside className="desk-side">
        <Link className="desk-mark" to="/app">
          <strong>{PRODUCT_NAME}</strong>
          <span>{isBrand ? "Brand desk" : "Creator desk"}</span>
        </Link>
        <nav aria-label="Dashboard">
          <NavLink to="/app" end>
            Overview
          </NavLink>
          <NavLink to="/app/list">{listLabel}</NavLink>
          <NavLink to="/app/pipeline">{pipelineLabel}</NavLink>
        </nav>
        <div className="desk-watching">
          <p>Watching</p>
          <span>{isBrand ? session.name : `@${session.name}`}</span>
        </div>
        {stat && (
          <div className="desk-stat">
            <strong>{stat.value}</strong>
            <p>{stat.label}</p>
            <span>{stat.note}</span>
          </div>
        )}
        <button type="button" className="desk-logout" onClick={logOut}>
          Log out
        </button>
      </aside>
      <main className="desk-main">{children}</main>
    </div>
  );
}

export function DeskHead({ title, note, sample }: { title: string; note: string; sample?: boolean }) {
  return (
    <header className="desk-head">
      <div>
        <h1>{title}</h1>
        <p>{note}</p>
      </div>
      {sample && <span className="desk-sample">Sample data</span>}
    </header>
  );
}
