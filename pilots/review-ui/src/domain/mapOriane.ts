import type { SourceContent, SourceFrame, TranscriptChunk } from "./types";

/**
 * Narrow shape of `SearchContentsResponse.FullResult` fields this pilot reads.
 * Documented at https://connect.oriane.xyz/rest/docs on 2026-11-06.
 * No auth call was made. Unknown extra fields are ignored on purpose.
 */
export type OrianeFullResultShape = {
  id: string;
  platform: "instagram" | "tiktok" | "youtube";
  platformId: string;
  profileHandle: string;
  caption: string | null;
  hashtags: string[];
  thumbnailMediaUrl: string | null;
  viewsCount: number | null;
  publishedAt: string;
  media: Array<{
    transcript: string | null;
    transcriptChunks: TranscriptChunk[] | null;
    onScreenText: string[] | null;
    frames?: Array<{
      id: string;
      timestampSeconds: number;
      url?: string | null;
      onScreenTextRegions: Array<{ text: string }> | null;
    }>;
  }>;
};

export function mapOrianeFullResult(row: OrianeFullResultShape): SourceContent {
  const chunks = row.media.flatMap((media) => media.transcriptChunks ?? []);
  const transcriptField = row.media
    .map((media) => media.transcript)
    .filter((transcript): transcript is string => Boolean(transcript && transcript.trim()))
    .join("\n");
  const transcript =
    transcriptField || (chunks.length > 0 ? chunks.map((chunk) => chunk.text).join(" ") : null);

  const frames: SourceFrame[] = row.media.flatMap((media) =>
    (media.frames ?? []).map((frame) => ({
      frameId: frame.id,
      timestampSeconds: frame.timestampSeconds,
      url: frame.url ?? null,
    })),
  );
  const frameText = row.media.flatMap((media) =>
    (media.frames ?? []).flatMap((frame) => (frame.onScreenTextRegions ?? []).map((region) => region.text)),
  );

  return {
    origin: "mapped_oriane_shape",
    syntheticLabel: null,
    contentId: row.id,
    platform: row.platform,
    platformId: row.platformId,
    profileHandle: row.profileHandle,
    caption: row.caption,
    hashtags: row.hashtags,
    thumbnailMediaUrl: row.thumbnailMediaUrl,
    viewsCount: row.viewsCount,
    publishedAt: row.publishedAt,
    transcript,
    transcriptChunks: chunks,
    onScreenText: row.media.flatMap((media) => media.onScreenText ?? []),
    frameText,
    frames,
    canonicalPostUrl: null,
    postUrlStatus: "not_in_oriane_schema",
    platformPaidPartnership: "not_in_oriane_schema",
  };
}
