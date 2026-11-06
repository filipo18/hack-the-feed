# Scope note and test plan

First brand: **Ryanair**. Demo creator: Instagram [agatha.catchrain](https://www.instagram.com/agatha.catchrain/), handle `agatha.catchrain` (no leading `@` in an Oriane `profileHandle.exactMatch`).

Filip reported that this creator uses Ryanair hashtags. That report is **unverified**. No Oriane call was made for this handle. This file is the check to run after a real 200 exists. It is not a result.

The review lexicon in `pilots/review-ui/src/domain/lexicon.ts` is still the synthetic demo set (Paper Kettle, Lumen Soap, Apple, Stanley). Add a Ryanair entry when the build starts. Keep `test/pilot.test.ts` on those synthetic fixtures.

## What counts as a Ryanair text mention

An exact textual mention is a bounded, case-insensitive spelling of `Ryanair`. The review matcher already treats letters and digits as word characters, so `Ryanair's` and `#ryanair` can match the spelling `ryanair`, and `Ryanairline` must not. Hashtag matching uses the token after a leading `#` is stripped: `ryanair` hits, `ryanairsale` does not.

Read these fields when a content object actually returns them:

| Field | Where it lives in the pinned schema | How the review pilot holds it today |
| --- | --- | --- |
| Caption | `caption` (nullable). Product help may label the same text Caption / Description. There is no separate `description` property. | `SourceContent.caption` |
| Title, if returned | Content `title` (nullable string on basic, default, and full results). Distinct from `audioTitle`, which is the audio-track name and is out of this pass. | Not mapped yet. `mapOrianeFullResult` drops `title`. Map it before matching. Null stays null. |
| Hashtags | `hashtags` (array). A `#ryanair` written inside the caption counts as well. | `SourceContent.hashtags`, matched on the hashtag channel |
| Transcript | `media[].transcript`, otherwise `media[].transcriptChunks[].text` | `SourceContent.transcript` |
| On-screen text | `media[].onScreenText`, plus frame `onScreenTextRegions[].text` on `full` | `onScreenText` and `frameText`, joined into the on-screen channel |

A hit is tied to the channel that contained the spelling. Text in the caption is not evidence the logo is on screen. A null transcript, null on-screen text, or null title means that field was empty or unprocessed. It is not a finding that Ryanair is absent from the video.

## Logo, livery, and color

A known Ryanair logo or livery image may be uploaded later through `POST /rest/assets` and sent as `visualSimilarity`. That path is optional. It does not block the text pass. A visual hit stays `visual_only` until the creator confirms it. Oriane does not return a brand name for a frame.

Color alone is weak. Yellow, blue, navy, or any other palette does not resolve Ryanair. Do not add a color rule.

## Test plan

Run these as labeled synthetic rows (`origin: "synthetic"`). Do not paste them from a live account, and do not use `agatha.catchrain` as the fixture handle. Expected resolution for a spelling hit with no asset is `text_only`.

1. Caption `… flew Ryanair today` → caption channel.
2. Caption `… flew ryanair today` → same hit. Case does not matter.
3. Caption `Ryanairline timetable` → no hit.
4. Title `Ryanair seat` with caption and hashtags empty → title channel, once title is mapped. Before that mapping, this case is expected to miss, and the miss is a mapper gap.
5. Title `null` and caption with no spelling → no title hit. Do not invent one.
6. `hashtags: ["#Ryanair"]` and a caption with no spelling → hashtag channel.
7. `hashtags: ["#ryanairline"]` → no hit.
8. Caption `#ryanair` with an empty hashtag array → the spelling in the caption still counts.
9. Transcript `we flew Ryanair` and a caption with no spelling → transcript channel. When `transcript` is null and a chunk contains `Ryanair`, the mapped chunk text counts.
10. `onScreenText: ["RYANAIR"]` with empty caption → on-screen channel.
11. A frame region whose text is `Ryanair` (full projection) → on-screen channel, via frame text.
12. Caption `yellow and blue cabin` and no spelling anywhere → no hit.
13. Optional later: a mapped logo or livery asset id with no spelling → `visual_only`, with the note that visual similarity is not a brand label. Skip this until an asset exists.
14. Two resolved brands on one video, one of them Ryanair → the existing equal view split still applies. That split and the $5 / $15 / $40 CPM placeholders stay Tilen's prototype. This plan does not treat the illustrated cents as a price.

Also confirm, on any future live page for `agatha.catchrain`, and only after the header and key are known:

- The request is `profileHandle.exactMatch` with `agatha.catchrain`, platform `instagram`.
- Record whether each returned row has `title`, and whether any hashtag token is exactly `ryanair`. The current report that such hashtags exist stays unverified until that page returns them.
- If the index returns no row, say the exact handle was not in the page. Do not explain it as follower count, recency, or a missing hashtag.

`pilots/oriane-api` `execute()` still refuses to send. Wiring a live call is a separate step after the header name is known.
