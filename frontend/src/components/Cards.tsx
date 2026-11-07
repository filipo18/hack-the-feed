import { compact, money } from "../lib/format";
import type { RankedBrand, RankedCreator } from "../lib/rank";
import { whereOf, type CardItem } from "../lib/view";
import { VideoCard } from "./VideoCard";

export function Cards({
  items,
  action,
  onAction,
  testId,
}: {
  items: CardItem[];
  action: string;
  onAction: (id: string) => void;
  testId?: string;
}) {
  return (
    <div className="cards" data-testid={testId}>
      {items.map((item, index) => (
        <VideoCard key={item.id} index={index} item={item} action={action} onAction={() => onAction(item.id)} />
      ))}
    </div>
  );
}

export function creatorItem(creator: RankedCreator): CardItem {
  return {
    id: creator.handle,
    title: `@${creator.handle}`,
    subtitle: `${compact(creator.followers)} followers, ${creator.market}`,
    amount: compact(creator.views),
    amountNote: "total",
    quote: creator.top.snippet,
    where: whereOf(creator.top),
    views: creator.top.views,
    unit: "impressions",
    postUrl: creator.top.postUrl,
    thumbnail: creator.top.thumbnail,
    highlight: creator.top.brand,
  };
}

export function brandItem(entry: RankedBrand): CardItem {
  return {
    id: entry.brand,
    title: entry.brand,
    subtitle: `${compact(entry.views)} views, ${entry.mentions.length} ${entry.mentions.length === 1 ? "video" : "videos"}`,
    amount: money(entry.value),
    quote: entry.top.snippet,
    where: whereOf(entry.top),
    views: entry.top.views,
    unit: "views",
    postUrl: entry.top.postUrl,
    thumbnail: entry.top.thumbnail,
    highlight: entry.top.brand,
  };
}

export function CreatorCards({ creators, onContact }: { creators: RankedCreator[]; onContact: (creator: RankedCreator) => void }) {
  return (
    <Cards
      items={creators.map(creatorItem)}
      action="Reach out"
      onAction={(id) => {
        const creator = creators.find((item) => item.handle === id);
        if (creator) onContact(creator);
      }}
    />
  );
}

export function BrandCards({ brands, onPitch }: { brands: RankedBrand[]; onPitch: (entry: RankedBrand) => void }) {
  return (
    <Cards
      items={brands.map(brandItem)}
      action="Pitch"
      onAction={(id) => {
        const entry = brands.find((item) => item.brand === id);
        if (entry) onPitch(entry);
      }}
    />
  );
}
