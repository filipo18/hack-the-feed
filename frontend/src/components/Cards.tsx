import { compact, money } from "../lib/format";
import type { RankedBrand, RankedCreator } from "../lib/rank";
import { VideoCard } from "./VideoCard";

export function CreatorCards({ creators, onContact }: { creators: RankedCreator[]; onContact: (creator: RankedCreator) => void }) {
  return (
    <div className="cards">
      {creators.map((creator, index) => (
        <VideoCard
          key={creator.handle}
          index={index}
          mention={creator.top}
          title={`@${creator.handle}`}
          subtitle={`${compact(creator.followers)} followers, ${creator.market}`}
          amount={money(creator.cost)}
          action="Reach out"
          actionLabel={`Reach out to @${creator.handle}`}
          onAction={() => onContact(creator)}
        />
      ))}
    </div>
  );
}

export function BrandCards({ brands, onPitch }: { brands: RankedBrand[]; onPitch: (entry: RankedBrand) => void }) {
  return (
    <div className="cards">
      {brands.map((entry, index) => (
        <VideoCard
          key={entry.brand}
          index={index}
          mention={entry.top}
          title={entry.brand}
          subtitle={`${compact(entry.views)} views, ${entry.mentions.length} ${entry.mentions.length === 1 ? "video" : "videos"}`}
          amount={money(entry.value)}
          action="Pitch"
          actionLabel={`Pitch ${entry.brand}`}
          onAction={() => onPitch(entry)}
        />
      ))}
    </div>
  );
}
