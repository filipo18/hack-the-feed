import { CHANNEL_LABEL } from "./format";
import type { Mention } from "./types";

/** One video card, whatever the data came from. */
export interface CardItem {
  id: string;
  title: string;
  subtitle: string;
  /** The model's reason, shown under the title on live data. */
  reason?: string;
  /** The big figure under the tile. */
  amount: string;
  amountNote?: string;
  /** The quoted evidence on the tile. */
  quote: string;
  /** Where the brand was found, like "Spoken at 0:14". */
  where: string;
  views: number | null;
  unit: string;
  postUrl: string | null;
  thumbnail?: string | null;
  /** The term to highlight inside the quote. */
  highlight: string;
  signals?: string[];
  depthLabel?: string;
  matches?: { id: string; thumbnail: string | null; context: string; why: string; views: number | null }[];
}

export function whereOf(mention: Mention): string {
  const labels = mention.channels.map((channel) => CHANNEL_LABEL[channel]).join(", ");
  return mention.timestamp ? `${labels} at ${mention.timestamp}` : labels;
}
