import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { OutreachDialog, type OutreachDraft } from "../components/OutreachDialog";
import { Empty, Loading } from "../components/ResultState";
import { useResult } from "../components/useResult";
import { searchBrand } from "../lib/api";
import { CHANNEL_LABEL, compact, money } from "../lib/format";
import { brandOutreach } from "../lib/messages";
import { rankCreators } from "../lib/rank";

export function BrandResults() {
  const brand = decodeURIComponent(useParams().brand ?? "");
  const loaded = useResult(() => searchBrand(brand), brand);
  const data = loaded?.data;
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const creators = useMemo(() => (data ? rankCreators(data) : []), [data]);
  const views = creators.reduce((sum, creator) => sum + creator.views, 0);
  const cost = creators.reduce((sum, creator) => sum + creator.cost, 0);

  return (
    <div className="page">
      <section className="result-head">
        <Nav audience="brands" />
        <h1 className="display">{brand}</h1>
        {data && creators.length > 0 && (
          <dl className="totals">
            <div>
              <dt>Creators with no ad marker</dt>
              <dd>At least {creators.length}</dd>
            </div>
            <div>
              <dt>Views on your brand</dt>
              <dd>At least {compact(views)}</dd>
            </div>
            <div>
              <dt>Cost to buy that reach</dt>
              <dd>{money(cost)}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="results">
        {!data && <Loading term={brand} />}
        {data && creators.length === 0 && <Empty term={brand} back="/for-brands" />}
        {creators.length > 0 && (
          <>
            <p className="results-meta">
              Sorted by views. {data?.paidPostsRemoved} posts with an ad marker were removed.
              {loaded?.sample && <span className="sample-tag">Sample data</span>}
            </p>
            <table className="rank">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Creator</th>
                  <th scope="col">Top mention</th>
                  <th scope="col" className="num">Views</th>
                  <th scope="col" className="num">Cost to buy</th>
                  <th scope="col"><span className="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {creators.map((creator, index) => (
                  <tr key={creator.handle}>
                    <td className="rank-number" data-label="Rank">{index + 1}</td>
                    <td data-label="Creator">
                      <strong>@{creator.handle}</strong>
                      <span className="sub">
                        {compact(creator.followers)} followers, {creator.market}
                      </span>
                    </td>
                    <td data-label="Top mention">
                      “{creator.top.snippet}”
                      <span className="sub">
                        {creator.top.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ")}
                        {creator.top.timestamp && ` at ${creator.top.timestamp}`}
                      </span>
                    </td>
                    <td className="num" data-label="Views">
                      <strong>{compact(creator.views)}</strong>
                      <span className="sub">
                        {creator.mentions.length} {creator.mentions.length === 1 ? "video" : "videos"}
                      </span>
                    </td>
                    <td className="num" data-label="Cost to buy">{money(creator.cost)}</td>
                    <td className="action">
                      <button
                        type="button"
                        className="pill pill-primary"
                        onClick={() => setDraft(brandOutreach(brand, creator))}
                      >
                        Reach out
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      <OutreachDialog draft={draft} onClose={() => setDraft(null)} />
      <Footer />
    </div>
  );
}
