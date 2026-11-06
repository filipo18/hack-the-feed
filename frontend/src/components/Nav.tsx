import { Link, NavLink } from "react-router-dom";
import { PRODUCT_NAME, type Audience } from "../content";

export function Nav({ audience, sections }: { audience: Audience; sections?: boolean }) {
  return (
    <header className="nav">
      <div className="nav-left">
        <Link className="wordmark" to={audience === "brands" ? "/for-brands" : "/for-creators"}>
          {PRODUCT_NAME}
        </Link>
        <nav className="switch" aria-label="Choose your side">
          <NavLink to="/for-brands" className={audience === "brands" ? "active" : undefined}>
            Brands
          </NavLink>
          <NavLink to="/for-creators" className={audience === "creators" ? "active" : undefined}>
            Creators
          </NavLink>
        </nav>
      </div>
      {sections && (
        <nav className="nav-sections" aria-label="On this page">
          <a href="#how-it-works">How it works</a>
          <a href="#compare">Compare</a>
        </nav>
      )}
      <Link className="pill pill-nav" to={`/login?as=${audience}`}>
        Demo access
      </Link>
    </header>
  );
}
