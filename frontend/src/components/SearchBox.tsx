import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Copy } from "../content";

export function SearchBox({ copy, id }: { copy: Copy; id: string }) {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  function go(term: string) {
    const clean = term.trim();
    if (clean) navigate(`${copy.resultsPath}/${encodeURIComponent(clean)}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(value);
  }

  return (
    <div className="search-wrap">
      <form className="search" onSubmit={submit}>
        <label className="visually-hidden" htmlFor={id}>
          {copy.inputLabel}
        </label>
        <input
          id={id}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={copy.placeholder}
          autoComplete="off"
        />
        <button type="submit" className="pill pill-primary">
          {copy.action}
        </button>
      </form>
      <p className="examples">
        Try{" "}
        {copy.examples.map((example) => (
          <button key={example} type="button" onClick={() => go(example)}>
            {example}
          </button>
        ))}
      </p>
    </div>
  );
}
