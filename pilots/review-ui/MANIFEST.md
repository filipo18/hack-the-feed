# Who owes you — review pilot handoff

Export for the integration agent. This archive is the reusable local pilot. It was not pushed to https://github.com/filipo18/hack-the-feed.git from the draft checkout, and that draft remote was not changed.

Snapshot commit on the draft branch: `1b9c4e1` (message: Add a synthetic review pilot for Who Owes You).

## Commands

```bash
npm install
npm test
npm run typecheck
npm run dev
```

`npm test` runs `vitest run` (`test/pilot.test.ts`). Last run in the draft workspace: 22 passed, 0 failed. `npm run dev` serves the review UI at http://127.0.0.1:47321.

Lockfile is `package-lock.json` (npm). Do not regenerate it unless a dependency must change.

## What is reusable, unchanged

Generic tested rules, not a Ryanair-specific build:

- `src/domain/classifyDisclosure.ts` — disclosed / review / creator-confirmed organic. Explicit disclosure flags the row. Absence of disclosure never becomes organic.
- `src/domain/extractBrands.ts` and `src/domain/lexicon.ts` — lexicon phrases, homonym rejections, text vs visual evidence.
- `src/domain/value.ts` — dedupe on platform + platform id, equal view split, missing views stay null.
- `src/domain/mapOriane.ts` — maps a full content-search result. No brand list, paid flag, or post URL is invented.
- `src/domain/copy.ts` and `CPM_SCENARIOS` — placeholder sentences and $5 / $15 / $40 rates.
- `src/App.tsx` and `src/demo/fixtures.ts` — synthetic review UI.
- `test/pilot.test.ts` — the contract tests. Keep them green.
- `docs/PILOT.md` — Oriane field map, Lovable secret rules, and the hackathon sequence.

## Synthetic-data labels

Every demo row is fake. Do not treat it as a creator, a Ryanair post, or a live Oriane response.

| Marker | Where |
| --- | --- |
| `origin: "synthetic"` | `src/demo/fixtures.ts` |
| `SYNTHETIC_LABEL` = `SYNTHETIC FIXTURE — not a live Oriane row` | same file, shown in the UI |
| Captions and transcripts prefixed `SYNTHETIC FIXTURE.` | same file |
| Handle `@sample.creator.demo` | `SAMPLE_HANDLE` |
| Ids `cnt_SYNTHETIC_*`, `plt_synth_*`, `ast_SYNTHETIC_*`, `frm_SYNTHETIC_*` | fixtures and visual hits |
| Thumbnail `synthetic://thumbnail/paper-kettle` | not fetched |
| Demo brands Paper Kettle and Lumen Soap | fictional |
| Apple and Stanley | homonym traps only (fruit, person, bare name, Apple Watch, visual asset) |

`mapped_oriane_shape` in tests is a hand-built shape with caption `SYNTHETIC SHAPE.`, not an API response.

## Ownership

Filip: Oriane request, paid-deal filter, Lovable UI, and these generic rules.

Tilen owns pricing and copy, and the final choices must not be overwritten:

- `src/domain/value.ts` — `CPM_SCENARIOS` (`owner: "teammate"`). Current placeholders are $5, $15, and $40.
- `src/domain/copy.ts` — reason sentences, joke-invoice wording, and the sponsorship pitch.
- Demo brand names Paper Kettle and Lumen Soap may be renamed. Homonym tests should stay.

The invoice is fictional. It is not a bill, not a debt, and not a claim that views were ads the brand would have bought.

## Next scope: Ryanair, without replacing these rules

The first real brand pass is Ryanair, using the existing lexicon and evidence channels.

Count explicit text mentions in:

- captions
- descriptions (map them to the caption field; Oriane's content schema has no separate description field)
- hashtags
- transcripts (`media.transcript`, otherwise transcript chunks)
- OCR (`onScreenText` and frame `onScreenTextRegions`)

A known Ryanair logo or livery asset is optional. If it is used, it stays `visual_only` until the creator confirms it. It is not required for the first pass.

Color alone is uncertain. Yellow, blue, or any other palette is not a brand match and must not resolve Ryanair.

Do not special-case Ryanair inside the disclosure or valuation rules. Add a lexicon entry for explicit spellings when integrating, and keep `test/pilot.test.ts` on the synthetic fixtures.

## Excluded from this zip

`.git`, `.env` and other secrets, `node_modules`, build caches (`.vite`, `dist`, `coverage`), and research scratch files.
