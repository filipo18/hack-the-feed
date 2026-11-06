import { CHANNEL_LABEL } from "./format";
import type { Channel, Mention } from "./types";

export interface TimePoint {
  date: string;
  total: number;
}

export function cumulativeViews(mentions: Mention[]): TimePoint[] {
  const byDate = new Map<string, number>();
  for (const mention of mentions) {
    byDate.set(mention.publishedAt, (byDate.get(mention.publishedAt) ?? 0) + (mention.views ?? 0));
  }
  let total = 0;
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => {
      total += views;
      return { date, total };
    });
}

export function foundIn(mentions: Mention[]) {
  const counts = new Map<Channel, number>();
  for (const mention of mentions) {
    for (const channel of mention.channels) counts.set(channel, (counts.get(channel) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([channel, value]) => ({ label: CHANNEL_LABEL[channel], value }))
    .sort((a, b) => b.value - a.value);
}

/** Share of the total held by the largest values, as a whole percent. */
export function topShare(values: number[], count: number): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  const top = [...values].sort((a, b) => b - a).slice(0, count);
  return Math.round((top.reduce((sum, value) => sum + value, 0) / total) * 100);
}
