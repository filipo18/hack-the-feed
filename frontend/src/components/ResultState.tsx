import { Link } from "react-router-dom";

export function Loading({ term }: { term: string }) {
  return <p className="result-note">Reading videos for {term}.</p>;
}

export function Empty({ term, back }: { term: string; back: string }) {
  return (
    <div className="result-note">
      <p>
        No indexed videos match {term} yet. Only part of each profile is indexed, so this does not prove there are
        none.
      </p>
      <Link className="pill pill-quiet-dark" to={back}>
        Try another search
      </Link>
    </div>
  );
}
