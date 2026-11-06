import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { OutreachDialog, type OutreachDraft } from "../components/OutreachDialog";
import { Empty, Loading } from "../components/ResultState";
import { useResult } from "../components/useResult";
import { searchCreator } from "../lib/api";
import { CHANNEL_LABEL, compact, money } from "../lib/format";
import { creatorPitch } from "../lib/messages";
import { rankBrands } from "../lib/rank";

export function CreatorResults() {
  const handle = decodeURIComponent(useParams().handle ?? "").replace(/^@/, "");
  const loaded = useResult(() => searchCreator(handle), handle);
  const data = loaded?.data;
  const [draft, setDraft] = useState<OutreachDraft | null>(null);

  const brands = useMemo(() => (data ? rankBrands(data) : []), [data]);

  const views = brands.reduce((sum, brand) => sum + brand.views, 0);
  const value = brands.reduce((sum, brand) => sum + brand.value, 0);

  return (
    <div className="page">
      <section className="result-head">
        <Nav audience="creators" />
        <h1 className="display display-handle">@{handle}</h1>
        {data && brands.length > 0 && (
          <dl className="totals">
            <div>
              <dt>Brands in your videos</dt>
              <dd>At least {brands.length}</dd>
            </div>
            <div>
              <dt>Views on those brands</dt>
              <dd>At least {compact(views)}</dd>
            </div>
            <div>
              <dt>Worth to those brands</dt>
              <dd>{money(value)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="results">
        {!data && <Loading term={`@${handle}`} />}
        {data && brands.length === 0 && <Empty term={`@${handle}`} back="/for-creators" />}
        {data && brands.length > 0 && (
          <>
            <p className="results-meta">
              Based on your views, market, account size and {data.creator.brandDeals} past brand deals.{" "}
              {data.paidPostsRemoved} posts with an ad marker were removed.
              {loaded?.sample && <span className="sample-tag">Sample data</span>}
            </p>
            <div className="brand-list">
              {brands.map((entry) => {
                return (
                  <article key={entry.brand} className="brand-row">
                    <div className="brand-main">
                      <h2>{entry.brand}</h2>
                      <p className="brand-value">{money(entry.value)}</p>
                      <p className="sub">
                        {compact(entry.views)} views across {entry.mentions.length}{" "}
                        {entry.mentions.length === 1 ? "video" : "videos"}
                      </p>
                    </div>
                    <ul className="mention-list">
                      {entry.mentions.map((mention) => (
                        <li key={mention.postUrl}>
                          <span>“{mention.snippet}”</span>
                          <span className="sub">
                            {mention.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ")}
                            {mention.timestamp && ` at ${mention.timestamp}`}, {compact(mention.views ?? 0)} views
                          </span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="pill pill-primary"
                      onClick={() => setDraft(creatorPitch(handle, entry))}
                    >
                      Pitch {entry.brand}
                    </button>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
      <Footer />
    </div>
  );
}
