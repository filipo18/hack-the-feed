import { Link } from "react-router-dom";

export function Loading({ term }: { term: string }) {
  return (
    <div className="report-loading" aria-busy="true">
      <div className="report-loading-copy" role="status">
        <span className="report-spinner" aria-hidden="true" />
        <div>
          <h2>Reading videos for {term}</h2>
          <p>Finding recent posts and checking their captions, transcripts and on-screen text. This can take about a minute.</p>
        </div>
      </div>
      <div className="report-skeletons" aria-hidden="true">
        {[0, 1, 2].map((item) => <div key={item}><div /><span /><span /></div>)}
      </div>
    </div>
  );
}

export function Empty({ term, back }: { term: string; back: string }) {
  return (
    <div className="result-note">
      <p>
        No indexed videos match {term} yet. Only part of each profile is indexed, so this does not prove there are
        none.
      </p>
      <Link className="pill pill-quiet" to={back}>
        Try another search
      </Link>
    </div>
  );
}
