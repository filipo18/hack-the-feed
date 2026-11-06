import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COPY, PRODUCT_NAME, type Audience } from "../content";
import { Nav } from "../components/Nav";
import { SearchBox } from "../components/SearchBox";
import { Footer } from "../components/Footer";

export function Landing({ audience }: { audience: Audience }) {
  const copy = COPY[audience];
  const other = COPY[audience === "brands" ? "creators" : "brands"];
  const [step, setStep] = useState(0);
  const active = copy.steps[step];

  useEffect(() => {
    document.title = `${PRODUCT_NAME} for ${audience}`;
    setStep(0);
  }, [audience]);

  return (
    <div className="page" key={audience}>
      <section className="hero">
        <Nav audience={audience} sections />
        <div className="hero-stage">
          <p className="hero-lede">{copy.lede}</p>
          <div className="frame" aria-hidden="true">
            <div className="frame-video">
              <p className="frame-caption">{copy.frame.caption}</p>
            </div>
            <div className="toast toast-found">
              <strong>{copy.frame.toastTitle}</strong>
              <span>{copy.frame.toastText}</span>
            </div>
            <div className="toast toast-value">
              <span>{copy.frame.valueLabel}</span>
              <strong>{copy.frame.value}</strong>
            </div>
          </div>
        </div>
        <h1 className="hero-title">
          <span className="line-one">{copy.lineOne}</span>
          <span className="line-two">{copy.lineTwo}</span>
        </h1>
        <SearchBox copy={copy} id="hero-search" />
      </section>

      <section className="steps" id="how-it-works">
        <h2 className="display display-dark">
          {copy.stepsTitle[0]}
          <br />
          {copy.stepsTitle[1]}
        </h2>
        <div className="step-tabs" role="tablist" aria-label="How it works">
          {copy.steps.map((item, index) => (
            <button
              key={item.name}
              type="button"
              role="tab"
              aria-selected={index === step}
              className={index === step ? "active" : undefined}
              onClick={() => setStep(index)}
            >
              <span>{index + 1}</span>
              {item.name}
            </button>
          ))}
        </div>
        <p className="step-text">{active.text}</p>
        <div className="step-panel" role="tabpanel">
          {active.panel.map((item) => (
            <div key={item.label}>
              <p className="panel-label">{item.label}</p>
              <p className="panel-value">{item.value}</p>
              <p className="panel-note">{item.note}</p>
            </div>
          ))}
        </div>
        <p className="step-example">Example figures on this page, not a live search.</p>
      </section>

      <section className="compare" id="compare">
        <h2 className="display">
          {copy.compareTitle[0]}
          <br />
          {copy.compareTitle[1]}
        </h2>
        <table>
          <thead>
            <tr>
              <td />
              <th scope="col">{copy.compareOld}</th>
              <th scope="col">{PRODUCT_NAME}</th>
            </tr>
          </thead>
          <tbody>
            {copy.compareRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.old}</td>
                <td className="compare-next">{row.next}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="close">
        <h2 className="display">
          {copy.closeTitle[0]}
          <br />
          {copy.closeTitle[1]}
        </h2>
        <SearchBox copy={copy} id="close-search" />
        <div className="cross">
          <h3>{copy.crossTitle}</h3>
          <p>{copy.crossText}</p>
          <Link className="pill pill-quiet" to={other.path}>
            {copy.crossAction}
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}
