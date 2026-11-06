# Pilot handoff — 2:00 to 5:30 PM PT, 6 Nov 2026

Two people. Filip: Oriane request, paid-deal filter, Lovable UI. Teammate: pricing numbers, pitch and invoice sentences, demo brand list. Do not overwrite the teammate's final numbers or sentences. The code marks those slots with `owner: "teammate"` and keeps the wording in `src/domain/copy.ts`.

This repo is a local rules prototype on synthetic rows. It is not the Lovable app. No key was tried against Oriane.

## What the public schema actually gives

Read on 6 Nov 2026 from the OpenAPI document embedded in [https://connect.oriane.xyz/rest/docs](https://connect.oriane.xyz/rest/docs). Server URL in that document: `https://connect.oriane.xyz`. Info text points at a key page, [https://app.oriane.xyz/billing/subscription?tab=api](https://app.oriane.xyz/billing/subscription?tab=api). The document has no `securitySchemes` entry. Do not guess a header.

Use `POST /rest/contents/search`.

Query parameters that matter:

- `projection=full` when the review needs transcript chunks and frames. `default` returns a transcript string and `onScreenText`, but not `transcriptChunks` or `frames`. `basic` has no transcript.
- `limit` is 1–100, default 20. `offset` pages with `metadata.pagination.totalCount`.
- `sort=publishedAt:desc` is enough for a creator pass.
- `aiSearchAnchor` is for later pages of a visual-similarity search, not for a handle search.

Creator filter, exact handle, no leading `@`:

```json
{
  "operator": "and",
  "name": "creator",
  "filters": {
    "profileHandle": {
      "exactMatch": { "values": ["their_handle"], "operator": "or" }
    }
  }
}
```

Fields this pilot maps (`src/domain/mapOriane.ts`):

| Need | Documented field |
| --- | --- |
| Identity | `id`, `platform`, `platformId`, `profileHandle`, `publishedAt` |
| Views | `viewsCount` (nullable; null is not zero) |
| Thumbnail | `thumbnailMediaUrl` (nullable) |
| Caption | `caption`, `hashtags` |
| Speech | `media[].transcript`, else `media[].transcriptChunks[]` |
| On-screen text | `media[].onScreenText`, plus `media[].frames[].onScreenTextRegions[].text` |
| Frames | `full` only: `frames[].id`, `timestampSeconds`, `url` |

Documented gaps, so the product has to own them:

- No brand list. A caption search for "Apple" or "Stanley" is not a brand appearance.
- No paid-partnership, branded-content, or disclosure field. Sponsorship is inferred from text we can see, then confirmed by the creator.
- No canonical post URL. Show platform + `platformId`. Do not build an Instagram or TikTok URL by guessing.
- `locationCompleteAddress` and profile location are a tagged place, not the audience country.
- Aggregations such as `totalViewsCount` sum views and skip nulls. Ignore them. A test plants `9999999` and checks the illustration does not move.
- HTTP 206, 402, 404, and 416 are listed with empty descriptions. Example error codes in the schema are placeholders (`NOT_ENOUGH_HONEY`). Do not branch on those example strings.
- `POST /rest/assets` creates a visual-search asset. The pilot does not call it. A visual hit in the fixtures is an asset id we mapped to a brand ourselves. The frame score is not a brand label.

Searching Oriane by brand name is the wrong first step. Fetch the creator's contents, then run our matcher.

## Sponsorship rules

`src/domain/classifyDisclosure.ts`

| State | When |
| --- | --- |
| `disclosed` | Explicit tag or phrase: `#ad`, `#sponsored`, `#paidpartnership`, `#paidpartner`, `#advertisement`, `#paidpromotion`, "paid partnership", "paid promotion", "sponsored by", "includes paid promotion", "this is an ad", "this is a paid ad". Also when that text is in the transcript or on-screen text. |
| `review` | Everything else, including no text at all, `#adapt`, a denial ("not sponsored"), `#gifted` / PR, affiliate / commission, `#partner` `#collab` `#sp` `#ambassador`. |
| `creator_confirmed_organic` | Creator mark is `organic`, and the row is not `disclosed`. |

An explicit disclosure stays `disclosed` even if the creator clicks Organic. Absence of a disclosure never proves the mention was unpaid. The source paid flag is always `not_in_oriane_schema`.

## Brand rules

`src/domain/extractBrands.ts` and `src/domain/lexicon.ts`

| Resolution | Meaning |
| --- | --- |
| `rejected_homonym` | Held out. Apple the fruit, "my friend Stanley". Not an appearance. |
| `ambiguous_homonym` | Bare "Stanley" / bare "Apple". Stays ineligible after an Organic click. |
| `text_only` | Name or product phrase in caption, transcript, hashtag, or on-screen text. Not a claim the product is on screen. |
| `visual_only` | Our asset map hit a frame. Oriane did not name the brand. A camping kettle can false-hit. |
| `text_and_visual` | Both, kept as separate evidence. |

Eligible for a number only when the mark is `organic`, the resolution is `text_only`, `visual_only`, or `text_and_visual`, and the disclosure state is `creator_confirmed_organic`. Paid deal and "not this brand" exclude the row. "Not this brand" also drops that brand from the view split. A paid co-mention still takes an equal share, so the unpaid line does not inherit the whole video.

## Valuation contract

`src/domain/value.ts`

- Dedupe key: `platform + platformId`. Same video from two search tabs counts once. A cross-post on another platform is a different view counter and is not merged. If duplicate rows disagree on views, views become unknown.
- Split: equal share of that video's views across resolved brands that were not marked "not this brand".
- Missing views stay null. They are not zero. If any included line lacks views, `sumComplete` is false. A partial sum of the known lines is still on `scenarios[].illustrativeCents` and must be labeled incomplete.
- CPM placeholders: $5, $15, $40. `illustrative cents = round(allocatedViews * cpmUsd * 100 / 1000)`.
- Geography is the literal `"unknown"`. No country multiplier.
- The object has `notUniqueReach`, `notADebt`, and `notPurchasedMedia`. It has no unique-reach or amount-owed field.
- Gross known views are counted once per video. The number multiplied by CPM is the allocated share. Those two figures are both shown so a split cannot be hidden.

Joke invoice and pitch copy live in `src/domain/copy.ts`. The invoice banner is "Not a bill. Not a request for payment. Do not send this." There is no amount due, no pay action, and no single debt total.

## Lovable, when Filip builds the UI

Official pages, read 6 Nov 2026:

- [Integrate any API](https://docs.lovable.dev/integrations/any-api)
- [Secrets](https://docs.lovable.dev/features/secrets)
- [Create a custom connector](https://docs.lovable.dev/integrations/create-connector)
- [Security best practices](https://docs.lovable.dev/tips-tricks/security-best-practices)
- [Edge functions](https://docs.lovable.dev/features/edge-functions)

The key stays server-side.

- Apps created from 13 May 2026 (22 June 2026 on Enterprise) get a server function. Older React + Vite apps need the built-in backend and an edge function.
- Put the key in the secret form, not in chat. Name it `ORIANE_API_KEY`. Secrets are write-only and are injected into server code. They are not copied on remix.
- Do not create `VITE_ORIANE_API_KEY`. Lovable rejects `VITE_` names in Secrets, and a `VITE_` value is compiled into the browser bundle. Do not gitignore `.env` in a Lovable project; that file is for public `VITE_` values, which this key is not.
- A custom connector stores the credential in Lovable's gateway and is the documented preference, but creating one needs a workspace admin, and the auth method has to match the API. The public spec does not say which header to use. Do not publish a connector with a guessed header. Until Filip has read the key screen, use a server function and one constant for the header name.
- The browser calls the server function. The server function calls `https://connect.oriane.xyz/rest/contents/search`. The response sent back to the browser is the pilot contract (appearances, held-out homonyms, valuation), not the raw Oriane payload and not the key.
- A server function is still callable by a client. For this hackathon, accept only the demo handle or a handle the creator typed, and do not log the key or the raw response.

Minimal prompt, after the header name is known:

```text
Add a server function that reads the secret ORIANE_API_KEY. I will type the key in the secret form, not in chat. Never put it in client code, a VITE_ variable, or a response.

POST https://connect.oriane.xyz/rest/contents/search?projection=full&limit=100&offset=0&sort=publishedAt:desc
Auth header: <FILIP FILLS THIS>. Do not invent a different scheme.
Body: { "operator": "and", "name": "creator", "filters": { "profileHandle": { "exactMatch": { "values": [handle], "operator": "or" } } } }

Page with offset until totalCount is covered. Ignore aggregation totals. Map only the fields in docs/PILOT.md. Leave post URL null. Run the brand and disclosure rules from this repo; do not invent a paid-partnership field. If the secret is missing, show the synthetic fixture path instead of calling the API.
```

UI to ask Lovable for, matching `src/App.tsx`:

1. Handle, then a review list. Each row: platform, platform id, brand, text or visual evidence, disclosure state, views or "unknown", and three marks: Organic, Paid deal, Not this brand.
2. A held-out list for rejected homonyms, separate from the review list.
3. An illustrated range that prints the CPM assumptions and the formula. No KPI tiles.
4. A joke invoice with the not-a-bill banner, and a separate sponsorship pitch.
5. Empty copy when nothing is creator-confirmed: a missing disclosure is not a reason to add a line.

Teammate replaces the sentences in `src/domain/copy.ts` and the three CPM numbers. Filip should not rephrase those after they are locked.

## Decisions

Filip needs to make these. Defaults already in the prototype are listed so the UI is not blocked.

| Decision | Default already used |
| --- | --- |
| Auth header | Unknown. No live call. Server function, header name as one constant, secret `ORIANE_API_KEY`. |
| Call Oriane during the window, or stay on fixtures | Stay on fixtures until one server-side page returns 200. The UI must still render the synthetic path. |
| `projection=full` vs `default` | `full`, so frame text is not dropped. Drop to `default` only if the response is too large to review. |
| Visual asset upload (`POST /rest/assets`) | Out. Fixtures inject asset hits. Skip unless a real frame review is required for the demo. |
| Organic click on a row that also has `#ad` | Stay `disclosed`. Not eligible. |
| View split | Equal across resolved brands on that video. A paid co-mention keeps a share. "Not this brand" loses its share. |
| Dedupe | `platform + platformId` only. |
| Which demo brands | Paper Kettle and Lumen Soap, plus Apple and Stanley as homonym traps. Teammate may rename the two fictional brands. |

Teammate owns, and this pass did not lock:

- The three CPM dollars and their labels.
- Invoice and pitch sentences, as long as they stay a joke invoice and a pitch: no amount due, no debt, no unique reach, no "free ads" equivalence, unknown country stated, shared views stated.
- Which creator handle is typed in the live demo.

## 3.5 hour sequence

The window is 2:00–5:30 PM PT. Times below are that clock, not an estimate of how hard the work is.

| Clock | Filip | Teammate |
| --- | --- | --- |
| 2:00–2:20 | Read the key screen and write down the header name. Do not paste the key into chat. | Lock three CPM numbers and the pitch paragraph, or accept the placeholders. |
| 2:20–3:10 | Lovable server function with the secret and the creator search. Map `full` results through `mapOrianeFullResult`. If the call fails, keep the synthetic fixtures on screen. | Replace `CPM_SCENARIOS` and the strings in `copy.ts`. Do not change eligibility. |
| 3:10–4:10 | Port `extractBrands` and `classifyDisclosure` unchanged. Wire Organic / Paid deal / Not this brand. | Watch one synthetic pass and strike any sentence that sounds like a bill or a guaranteed ad rate. |
| 4:10–5:00 | Dedupe and the shared-view split. Confirm a planted aggregate total does not appear. | One demo script: disclosed row, apple-the-fruit holdout, visual-only row, missing views, then the pitch. |
| 5:00–5:30 | One real handle only if the server call already works. Otherwise ship the synthetic path. | Read the pitch aloud once. Cut anything that is not on the review list. |

Cut line if the clock slips: no asset upload, no second platform, no saved accounts, no sending.

## Tests

`npm test` covers the fixtures. Failures belong in the hackathon notes before anyone treats a row as unpaid.
