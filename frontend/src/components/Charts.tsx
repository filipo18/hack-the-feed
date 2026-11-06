import { useState, type PointerEvent } from "react";
import { compact } from "../lib/format";
import type { TimePoint } from "../lib/insights";

const WIDTH = 720;
const HEIGHT = 250;
const LEFT = 46;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 28;

function niceMax(value: number) {
  const power = Math.pow(10, Math.floor(Math.log10(Math.max(value, 1))));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * power >= value) return step * power;
  }
  return 10 * power;
}

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function GrowthChart({ points, unit }: { points: TimePoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;

  const times = points.map((point) => new Date(`${point.date}T12:00:00`).getTime());
  const first = times[0];
  const span = Math.max(times[times.length - 1] - first, 1);
  const max = niceMax(points[points.length - 1].total);
  const x = (index: number) => LEFT + ((times[index] - first) / span) * (WIDTH - LEFT - RIGHT);
  const y = (value: number) => TOP + (1 - value / max) * (HEIGHT - TOP - BOTTOM);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.total).toFixed(1)}`).join(" ");
  const base = y(0);
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${base} L${x(0).toFixed(1)} ${base} Z`;
  const active = hover === null ? null : points[hover];

  function move(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    points.forEach((_, index) => {
      if (Math.abs(x(index) - position) < Math.abs(x(nearest) - position)) nearest = index;
    });
    setHover(nearest);
  }

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${unit} over time, reaching ${compact(points[points.length - 1].total)}`}
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((share) => (
          <g key={share}>
            <line className="chart-grid" x1={LEFT} x2={WIDTH - RIGHT} y1={y(max * share)} y2={y(max * share)} />
            <text className="chart-axis" x={LEFT - 8} y={y(max * share) + 4} textAnchor="end">
              {compact(max * share)}
            </text>
          </g>
        ))}
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        <text className="chart-axis" x={LEFT} y={HEIGHT - 6}>
          {dayLabel(points[0].date)}
        </text>
        <text className="chart-axis" x={WIDTH - RIGHT} y={HEIGHT - 6} textAnchor="end">
          {dayLabel(points[points.length - 1].date)}
        </text>
        {hover !== null && (
          <>
            <line className="chart-cross" x1={x(hover)} x2={x(hover)} y1={TOP} y2={base} />
            <circle className="chart-dot" cx={x(hover)} cy={y(points[hover].total)} r={5} />
          </>
        )}
      </svg>
      {active && hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / WIDTH) * 100}%`, top: `${(y(active.total) / HEIGHT) * 100}%` }}>
          <strong>
            {compact(active.total)} {unit}
          </strong>
          <span>By {dayLabel(active.date)}</span>
        </div>
      )}
      <table className="visually-hidden">
        <caption>{unit} over time</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{point.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <ul className="bars">
      {rows.map((row) => (
        <li key={row.label} title={`${row.label}: ${row.value}`}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          <i style={{ width: `${(row.value / max) * 100}%` }} />
        </li>
      ))}
    </ul>
  );
}
