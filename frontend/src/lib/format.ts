import type { Channel } from "./types";

export function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  caption: "Caption",
  hashtag: "Hashtag",
  spoken: "Spoken",
  on_screen: "On screen",
};
