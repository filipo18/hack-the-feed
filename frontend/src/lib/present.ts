import { compact } from "./format";
import type { SearchCreator, SearchResponse } from "./contract";

const EVIDENCE: Record<string, string> = {
  caption: "Caption",
  hashtag: "Hashtag",
  mention: "Mention",
  transcript: "Spoken",
  ocr: "On screen",
  visual: "Visual candidate",
};

const HOLDOUT: Record<string, string> = {
  owned_account: "Brand's own account",
  asr_false_positive: "Speech-to-text false positive",
  complaint: "Complaint",
  repost: "Repost",
  incidental: "Incidental",
  irrelevant: "Not relevant",
  uncertain: "Uncertain",
};

export function disclosureLabel(value: string | null | undefined): string {
  if (value === "disclosed") return "Disclosed";
  if (value === "unknown" || value == null || value === "") return "Disclosure unknown";
  return `Disclosure: ${value}`;
}

export function holdoutLabel(value: string | null | undefined): string {
  if (!value) return "Held out";
  return HOLDOUT[value] ?? value;
}

export function formatViews(sumViews: number | null | undefined, incomplete: boolean | undefined): string {
  if (typeof sumViews !== "number" || !Number.isFinite(sumViews)) return "Views unknown";
  const text = compact(sumViews);
  return incomplete ? `${text} (a relevant post is missing its view count)` : text;
}

export function evidenceLabels(creator: SearchCreator): string[] {
  const posts = creator.posts ?? [];
  const reaching = posts.filter((post) => post.countsTowardReach);
  const source = reaching.length > 0 ? reaching : posts;
  const labels: string[] = [];
  for (const post of source) {
    for (const label of post.evidenceLabels ?? []) {
      const text = EVIDENCE[label] ?? label;
      if (!labels.includes(text)) labels.push(text);
    }
  }
  return labels;
}

export function evidenceExcerpt(creator: SearchCreator): string | null {
  for (const post of (creator.posts ?? []).filter(item => item.countsTowardReach)) {
    if (post.caption?.trim()) return post.caption.trim();
    for (const media of post.media ?? []) {
      const transcript = media.transcript?.trim();
      if (transcript) return transcript;
      const screen = (media.onScreenText ?? []).map((item) => item.trim()).find(Boolean);
      if (screen) return screen;
    }
  }
  return null;
}

export function knownViewTotal(creators: SearchCreator[]): { text: string } {
  let known = 0;
  let sawNumber = false;
  let missing = false;
  for (const creator of creators) {
    if (typeof creator.sumViews === "number" && Number.isFinite(creator.sumViews)) {
      known += creator.sumViews;
      sawNumber = true;
    } else missing = true;
    if (creator.viewsIncomplete) missing = true;
  }
  if (!sawNumber) return { text: "Views unknown" };
  if (missing) return { text: `${compact(known)} known, some missing` };
  return { text: compact(known) };
}

export function assessmentCopy(reason: string | null): { title: string; text: string } | null {
  switch (reason) {
    case "oriane_not_configured":
      return {
        title: "Search did not run",
        text: "The server has no ORIANE_API_KEY. No posts were requested, and this is not an empty catalog.",
      };
    case "gmi_not_configured":
      return {
        title: "Nothing was ranked",
        text: "GMI_API_KEY or GMI_MODEL is missing, so the model did not judge relevance. Anyone listed below is unassessed, not approved or rejected.",
      };
    case "gmi_error":
      return {
        title: "The model call failed",
        text: "No relevance ranking was produced. Anyone listed below is unassessed.",
      };
    case "malformed_model_response":
      return {
        title: "The model reply could not be used",
        text: "The verdict was missing or malformed, so nobody was ranked. Anyone listed below stays unassessed.",
      };
    case "no_posts":
      return {
        title: "No posts in the retrieved sample",
        text: "The pages that succeeded did not include a post. That does not prove the brand is absent from the whole index.",
      };
    default:
      return null;
  }
}

export function draftNote(brand: string, creator: SearchCreator): { title: string; message: string } {
  const who = creator.handle ? `@${creator.handle}` : creator.creatorKey;
  const why = creator.why?.trim() || "The index did not include a written explanation.";
  return {
    title: `Draft a note to ${who}`,
    message: [
      `Hi ${creator.handle || "there"},`,
      "",
      `We saw a ${brand} mention on ${creator.platform || "a platform"}. ${why}`,
      "",
      `Relevant post views in this retrieved sample: ${formatViews(creator.sumViews, creator.viewsIncomplete)}. These are post views, not unique people.`,
      `Disclosure on the sample is ${disclosureLabel(creator.disclosure)}. That is not a finding that the post was unpaid.`,
      "",
      "This note was written in the browser and has not been sent.",
    ].join("\n"),
  };
}

export const HONESTY_NOTE =
  "Views are counts on the retrieved posts, not unique people. Disclosure is disclosed or unknown. Neither one means a post was unpaid. A ranked list is this sample, not the whole index.";

export function modelLabel(data: SearchResponse): string {
  return data.gmiModel ? `Model: ${data.gmiModel}.` : "No model id configured.";
}
