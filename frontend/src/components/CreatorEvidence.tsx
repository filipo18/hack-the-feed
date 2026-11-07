import { useState } from "react";
import { videoPreviewUrl } from "../lib/creatorReport";
import { compact } from "../lib/format";
import type { CreatorEntity, CreatorReport } from "../lib/types";

export function CreatorEvidence({ evidence, posts, confirmed = false }: {
  evidence: CreatorEntity["evidence"];
  posts: CreatorReport["posts"];
  confirmed?: boolean;
}) {
  const videos = new Map<string, CreatorEntity["evidence"]>();
  for (const item of evidence) videos.set(item.platformId, [...(videos.get(item.platformId) ?? []), item]);

  return (
    <ul className="mention-list creator-video-list">
      {[...videos].map(([platformId, mentions]) => {
        const post = posts.find((item) => item.platformId === platformId);
        const preview = videoPreviewUrl(mentions, post?.thumbnailUrl);
        const first = mentions[0];
        const date = first.publishedAt ?? post?.publishedAt;
        return (
          <li key={platformId} className="creator-video-evidence">
            <VideoPreview key={preview} src={preview} platformId={platformId} />
            <div className="creator-video-copy">
              <p className="sub">Instagram · {platformId}{date && <> · <time dateTime={date}>{date.slice(0, 10)}</time></>}</p>
              {mentions.map((item, index) => (
                <div className="creator-video-quote" key={`${item.field}-${index}`}>
                  <p>{item.snippet ? `“${item.snippet}”` : "Appearance in the video frame"}</p>
                  <p className="sub">{item.field.replaceAll("_", " ")}{item.timestampSeconds != null && ` at ${item.timestampSeconds}s`}</p>
                </div>
              ))}
              <p className="sub">
                {first.views == null ? "views unknown" : `${compact(first.views)} views`} · {confirmed ? "appearance confirmed" : "needs review"}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function VideoPreview({ src, platformId }: { src: string | null; platformId: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="creator-video-preview creator-preview-missing"><span>Preview unavailable</span></div>;
  }
  return (
    <a className="creator-video-preview" href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open preview for Instagram post ${platformId}`}>
      <img src={src} alt={`Video preview for Instagram post ${platformId}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      <span>Open preview</span>
    </a>
  );
}
