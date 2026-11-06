import { compact } from "../lib/format";
import { useCountUp } from "./motion";

export function MoneyHero({
  title,
  amount,
  line,
  note,
  active,
  stats,
  keepCase,
}: {
  title: string;
  amount: number;
  /** The second headline line, built from the counting number. */
  line: (shown: number) => string;
  note: string;
  active: boolean;
  stats: { label: string; value: number; prefix?: string }[];
  keepCase?: boolean;
}) {
  const shown = useCountUp(amount, active);

  return (
    <div className="money">
      <h1 className="money-title">
        <span
          className={keepCase ? "money-name money-keep" : "money-name"}
          style={{ ["--chars" as string]: Math.max(title.length, 6) }}
        >
          {title}.
        </span>
        <span className="money-amount">{line(shown)}</span>
      </h1>
      <div className="money-foot">
        <dl className="money-stats">
          {stats.map((stat) => (
            <Stat key={stat.label} {...stat} active={active} />
          ))}
        </dl>
        <p className="money-note">{note}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, prefix, active }: { label: string; value: number; prefix?: string; active: boolean }) {
  const shown = useCountUp(value, active);
  return (
    <div>
      <dd>
        {prefix}
        {compact(shown)}
      </dd>
      <dt>{label}</dt>
    </div>
  );
}
