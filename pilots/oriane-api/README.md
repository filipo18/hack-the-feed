# Oriane capability probe

Research pilot for the 6 Nov 2026 creator hackathon (build window 2:00–5:30 PM PT). This is not a product. It pins the public OpenAPI document, checks the keyless gate, and ranks a 3.5-hour build from documented fields.

No authenticated call was made. No creator catalog was returned. The object in `fixtures/synthetic_content_full.json` is synthetic and is not a live Oriane result.

## Verdict

Do not build **Who Owes You** as the hackathon bet. Build **Beside the Caption**.

Creator-scoped post search is a documented query. `viewsCount`, thumbnails, captions, transcripts, on-screen text, and timed frames are documented fields. A brand ledger, a paid-versus-unpaid flag, and a canonical post URL are not properties of this schema. The invoice and the sponsorship pitch were sitting on fields the API does not have.

**Beside the Caption** uses the part Oriane actually documents and other social tools usually do not: for one of a creator's recent videos, show the caption, the timestamped transcript, the on-screen text, and the frame at the spoken second. Words that were said or burned into the frame and never written in the caption are the demo. Payment stays a question for the creator, asked outside this API.

That recommendation is a documentation judgment for a two-person, 3.5-hour build. It is not a measured score, and it is not proof the live index returns those fields populated.

## Evidence classes

| Claim | Class | Where |
| --- | --- | --- |
| Three POST routes, filters, projections, frames, chunks | Pinned OpenAPI 3.0 snapshot | `schema/openapi.snapshot.json`, extracted 2026-11-06 from the Scalar page embedded at [connect.oriane.xyz/rest/docs](https://connect.oriane.xyz/rest/docs), linked by iframe from [www.oriane.xyz/api](https://www.oriane.xyz/api) |
| Key required, header name unknown | Live keyless POST, not a content proof | `evidence/unauthenticated-routes.json` |
| 3-month window, 5,000-follower floor, CSV `Video URL` | Product help, not restated as OpenAPI rules | [www.oriane.xyz/how-to-search](https://www.oriane.xyz/how-to-search), read 2026-11-06 |
| Credits depend on projection | Pricing page prose; the numeric table was not in the static HTML | [www.oriane.xyz/pricing](https://www.oriane.xyz/pricing) |
| MCP and "API access live" | Marketing copy. The OpenAPI document has no MCP surface and no server URL for one | [www.oriane.xyz](https://www.oriane.xyz/) and the enterprise page |
| Caption-gap tokens and frame alignment | Client plumbing on a synthetic fixture | `fixtures/synthetic_content_full.json` |

Info version in the snapshot is `0.0.1`. Server URL is `https://connect.oriane.xyz`. `components` contains `schemas` only. `securitySchemes` is absent. No operation declares `security`.

## Live gate

One keyless POST to each documented path, synthetic body, no retries:

| Path | When (UTC) | Status |
| --- | --- | --- |
| `POST /rest/contents/search` | 2026-11-06T08:36:46Z | 401 |
| `POST /rest/profiles/search` | 2026-11-06T08:40:03Z | 401 |
| `POST /rest/assets` | 2026-11-06T08:40:03Z | 401 |

Each body is `operation: AUTHENTICATION`, `code: UNAUTHORIZED`, `message: "Authorization failed."`, `context: {}`. No `WWW-Authenticate` header. The word "Authorization" in that sentence does not name a header or a scheme. `Authorization: Bearer` and `x-api-key` were not tried.

`executionTime` on those errors was 0–2 ms. There was no `data` payload and no 400, so the server did not confirm that the query shape is accepted. These calls are not creator results and they are not a credit-price measurement.

The docs info block links key issuance to `https://app.oriane.xyz/billing/subscription?tab=api`. This pilot did not sign up or open that billing page.

## Who Owes You

What the schema supports as a request, still unverified against a 200:

- `POST /rest/contents/search` with `profileHandle.exactMatch.values = [handle]`, `operator: or` inside that operand, and `platform.includes` of `instagram`, `tiktok`, or `youtube`.
- Query `offset`, `limit` 1–100, `projection` `basic` | `default` | `full`, `sort` including `publishedAt` and `viewsCount` with `:asc` or `:desc`.
- `basic` results already include `id` (32-character string, examples use a `cnt_` prefix), `platform`, `platformId` (described as the external platform id; the example is a numeric string, not a shortcode), `thumbnailMediaUrl` (nullable), `viewsCount` (nullable), `caption`, `hashtags`, and `mentions`.
- Pagination metadata documents `offset`, `limit`, `totalCount`, and `aiSearchAnchor`. The anchor description says it is required on later pages of a **visual similarity** search. A handle enumeration does not send it.
- `default` and `full` aggregations are `SearchContentsResponse.DefaultAggregation.Body`. `totalViewsCount` is described as the sum of views of **matched contents**, ignoring rows with no value, null when none have one. The sentence does not say whether "matched" is the page or the whole query. Do not treat it as a creator's lifetime stats until a live page is compared with `totalCount`.

What full projection adds on each media object, and default does not: `transcriptChunks`, `frames`, `transcriptLanguage`. Default media still has `caption`, `transcript`, `onScreenText`, and `tags`. Basic media is `type`, `duration`, and `caption`.

`transcriptChunks` are `{startSeconds, endSeconds, text}`. Frames require `id`, `position`, `timestampSeconds`, `onScreenTextRegions`, and `url`. Region polygons are normalized 0–1. `onScreenText` is described as recognized words: empty when none were found, null when not processed. `transcript` is nullable and its description is empty, so null is not documented as "not spoken."

`frames.visualSimilarityScore` is a 0–1 number with no description. It is not a brand score.

Open-ended brand discovery is a client problem, not a response field:

- Structured text the schema already splits: caption, hashtags, mentions, co-author handles, and media tags (`positionX` / `positionY` are account-tag coordinates).
- Speech and OCR are strings. A gazetteer or a model can match them. This repo only diffs tokens of length 4 or more so a synthetic fixture can show the plumbing. `includesFuzzy` is described as matching all words in any order, **including partial words**. Do not use it for names.
- Frames are unlabeled image URLs. `POST /rest/assets` plus `visualSimilarity` compares a text or image asset you already created (at most 10 values across the query). That finds similarity to a known asset. It does not list unknown logos.
- No property in the snapshot is named like a brand, logo, sponsorship, or disclosure flag. Descriptions in the snapshot do not contain the words brand, sponsor, paid, disclosure, permalink, or postUrl.

`viewsCount` can be null. This probe does not turn it into money. An illustrative media number, if the teammate still wants one on a later screen, has to show the formula and has to survive null views. It is not a debt.

Canonical links: unresolved. Example thumbnail URLs in the schema use a path segment like `C_abc123`, while the `platformId` example is `18000000000000000`. Those examples are not a mapping, and this client does not invent `tiktok.com` or `instagram.com` URLs. The product-help export column list includes **Video Code** and **Video URL**. That is a different surface from this REST schema.

Product-help limits that may still empty a live demo, and that are **not** written on `publishedAt` in the OpenAPI file:

- Search UI window is the last 3 months.
- Accounts under 5,000 followers are not indexed.
- Indexing can lag up to a week.
- CSV export stops at 10,000 rows.

YouTube is in the platform enum. The how-to-search platform section talks about TikTok and Instagram. The demo requests default to those two.

## Primitives worth a hackathon hour

Strong, because they are unusual and explicitly shaped in the schema:

- Separate caption, transcript, and on-screen-text channels, with speech chunks and frame OCR tied to seconds.
- Exact handle, mention, hashtag, and transcript operands (`exactMatch`, `includesExactly`, `excludesExactly`), plus a warning on fuzzy partial words.
- Visual similarity against a reusable asset, with `aiSearchAnchor` so later pages keep the same scoring.
- Profile search by exact handle, including `followersCount` and `postsCount`, and `publicEmail` on the full profile projection. This probe does not use `publicEmail`. It is not an outreach tool.
- Aggregations over matched contents. Useful only after a live response shows whether they are page-scoped.

Weak as a product center, even though the fields exist: view and like totals, follower counts, and a yes/no quote check. Those collapse into tools the creator already has, or into a false "no" when a nullable transcript is empty.

## Alternatives

### 1. Beside the Caption — build this

Creator problem: the caption is the only text that travels into a media kit, a stitch, or a brand email. The video often says and shows other words. The creator can see that gap with a still at the spoken second.

60-second demo, once a key exists: resolve the handle, take the five highest-view recent posts, open the first one whose transcript is present, and show three columns plus one frame. On the synthetic fixture the caption is "Morning routine. Link below." The chunk at 4.2–6.0 seconds says "silverpool", and the frame at 4.8 seconds has that word on screen. The caption tokens do not. That fixture is labeled synthetic. Do not narrate it as a real creator.

Minimum flow, all documented, none of it live-proven:

1. `POST /rest/profiles/search`, `handle.exactMatch`, platforms Instagram and TikTok, `projection=basic`, `limit=1`. Empty `results` means this exact handle is not in the index. It does not say why.
2. `POST /rest/contents/search`, `profileHandle.exactMatch`, `projection=default`, `limit=5`, `sort=viewsCount:desc`. Default media has caption, transcript, and onScreenText, and does not download frames.
3. `POST /rest/contents/search`, `id.includes` of the chosen 32-character content id, `projection=full`, `limit=1`. Full adds `transcriptChunks` and `frames`. Align each chunk to the frame whose `timestampSeconds` falls inside it.

Build split: Filip owns those three requests, the token diff, and the frame join. The teammate owns one screen and the spoken demo. No invoice, no named-entity model, no second data vendor. That fits 3.5 hours if the header and key are known before 2 PM. It does not fit if the team spends the window guessing auth.

Robustness against index limits: a creator who posts often is a better stage subject than a specific sentence or a lookalike frame, because any recent indexed video with a transcript can carry the demo. Skip a row when `transcript` is null. If all five are null, say the payload had no transcript. The 5,000-follower floor and the 3-month window are still untested against this API. Keep YouTube out of the request until a live row proves coverage.

Unknowns that can still break it: credit cost of `default` versus `full` (402 is a documented status, codes are not enumerated; the schema's sample code `NOT_ENOUGH_HONEY` is flavor text), whether frame and thumbnail URLs fetch without another credential, how many frames a full video contains (the array has no max), permalink still missing, and aggregation scope.

### 2. Untagged in the Transcript — stronger magic, easier empty stage

One full-projection search: `transcript.includesExactly` a distinctive phrase, `profileHandle.excludesExactly` the creator, `mentionHandles.excludesExactly` the creator, `limit=5`, `sort=viewsCount:desc`. Then the same chunk-to-frame join.

Creator problem: someone else's indexed video said your name or handle and the mention list does not include you.

Documented, and more brittle. A hit has to exist in the index. Exact transcript match misses paraphrases and ASR errors. `includesFuzzy` will false-positive partial words, so leave it off. Excluding a handle is not the same thing as "they did not say a display name." A common phrase returns noise. Ranked second because the 60-second demo dies on an empty page more readily than Beside the Caption.

### 3. Frame Echo — real primitive, worst stage risk

`POST /rest/assets` with `{type: text, text}` up to 300 characters, or an image URL, base64, or multipart file. Then `visualSimilarity.includes` on that asset id. The schema example uses `minScore` 0.3 and `maxScore` 0.9. Those are examples, not a cutoff this pilot has calibrated. Sort `visualSimilarity`. Page 2 and after must send `aiSearchAnchor`. `visualSimilarityScore` on frames has no description, so do not render it as a copy-confidence percentage until a live visual search shows the field.

Two authenticated calls, an unknown score, and a high chance of an empty page. Ranked third for a 3.5-hour demo. It is the right follow-on if Beside the Caption is done and the key still has budget.

### Rejected as the pitch

**Did They Actually Say That?** uses a real primitive (`transcriptChunks`) and should appear inside Beside the Caption as the chunk text at a timestamp. As a yes/no product it is weak. A null transcript is not documented as "they did not say it." Fuzzy match is partial-word match. There is no post URL to open the moment on TikTok or Instagram. A stage demo also requires a sentence already known to be inside the index, which this team cannot check before the key arrives.

**Who Owes You** asks the API for brands and unpaid deals. The schema can list a creator's indexed posts and a nullable view count. It cannot confirm a brand appearance or a missing payment. Guessing brands from tokens, then printing an invoice, would present a client heuristic as Oriane's catalog.

## Sponsor request

The minimum ask, before 2 PM PT:

1. A key for this team, from the billing URL in the API info block, without making the team create the account during the build.
2. The exact header name and scheme. The 401 body does not provide it.
3. Whether `profileHandle.exactMatch` returns that account's indexed posts, and whether the help-page rules apply to the API: last 3 months, under 5,000 followers excluded, up to a week of lag.
4. Whether a live content object includes a canonical post URL or video code. The REST schema does not. The CSV help page lists both.
5. Credit cost of `projection=default` and `projection=full`, and a prepaid hackathon budget so a demo cannot hit 402.
6. Whether `thumbnailMediaUrl` and `frames[].url` are fetchable without a second credential.
7. Whether `aggregations.totalViewsCount` covers the whole match set or only the returned page.

## If the key is late

Stay on Oriane.

- Run `python3 -m oriane_probe` and the unit tests. Put the synthetic fixture on one screen with the fixture label visible. That dry run shows the interaction. It is not a creator result.
- If a logged-in Oriane web session already exists, export one creator CSV from the product and diff caption against the Audio Transcript column by hand. The help page says that CSV has Video URL. That is product UI, not this REST client.
- Do not replace Oriane with another social API. Firecrawl's public Alexandria pages describe an Oriane provider that includes `postUrl` and per-call credit prices. Those claims are not in this OpenAPI document. This probe does not call Firecrawl.

`execute()` in this package raises even if a key is passed in. Wiring a real send is a separate step after the header name is known, and it can spend credits.

## Run

```bash
python3 -m unittest discover -s tests -v
python3 -m oriane_probe
```

`evidence/unittest.txt` is the saved run: 13 tests, OK. `evidence/capability-report.json` is the machine-readable summary. Refresh the snapshot from the public docs page with `python3 scripts/refresh_openapi_snapshot.py` if the docs change. That script does not send a key.
