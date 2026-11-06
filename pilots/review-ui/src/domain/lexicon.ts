import type { LexiconEntry } from "./types";

/**
 * Demo lexicon only. Strong phrases are ours, not an Oriane brand list.
 * Apple and Stanley are included because the bare names are homonyms.
 * Teammate can swap the fictional brands; the homonym rules stay with the filter.
 */
export const DEMO_LEXICON: LexiconEntry[] = [
  {
    id: "paper-kettle",
    name: "Paper Kettle",
    strongPhrases: ["paper kettle"],
    ambiguousTokens: [],
    homonymRejections: [],
  },
  {
    id: "lumen-soap",
    name: "Lumen Soap",
    strongPhrases: ["lumen soap"],
    ambiguousTokens: [],
    homonymRejections: [],
  },
  {
    id: "apple",
    name: "Apple",
    strongPhrases: ["apple watch", "iphone", "macbook", "app store"],
    ambiguousTokens: ["apple"],
    homonymRejections: [
      "an apple",
      "the apple",
      "green apple",
      "apple pie",
      "apple juice",
      "apple orchard",
      "ate an apple",
      "eating an apple",
    ],
  },
  {
    id: "stanley",
    name: "Stanley",
    strongPhrases: ["stanley cup", "stanley tumbler", "stanley quencher"],
    ambiguousTokens: ["stanley"],
    homonymRejections: [
      "my friend stanley",
      "friend stanley",
      "named stanley",
      "uncle stanley",
      "stanley said",
      "stanley told me",
      "stanley came over",
    ],
  },
];
