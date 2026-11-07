# Backend

One Python service for brand search and `POST /api/creator-report`. Brand search asks Oriane for a bounded sample, then asks GMI whether those posts are relevant. The creator report asks Oriane for one handle on one platform, with no brand filter, then asks GMI for grounded names only when a key and model are set. There is no database, queue, account system, or second service. Live GMI inference is not claimed from tests that inject a fake response.

`Dockerfile` in this directory is the API-only image. The image that also serves `frontend/` is the Dockerfile at the repo root. See [DEPLOY.md](DEPLOY.md).

The browser never receives `ORIANE_API_KEY` or `GMI_API_KEY`.

The production UI is the self-hosted app in this repo's `frontend/` directory. Hosted, it is served by this process from `STATIC_DIR` so the page and `/api/search` share an origin. Provider keys stay in this process.

## Run

From this directory, with Python 3.12:

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Tests use a fake HTTP client. They do not call Oriane or GMI:

```bash
pip install -r requirements-dev.txt
python -m pytest
```

`GET /health` returns `status`, `orianeConfigured`, and `gmiConfigured`. It does not call either provider.

## Environment

| Name | Required | Purpose |
| --- | --- | --- |
| `ORIANE_API_KEY` | For a live search | Sent only as `Authorization: Bearer` to `https://connect.oriane.xyz`. |
| `GMI_API_KEY` | For a model judgment | Sent only as `Authorization: Bearer` to the GMI chat endpoint. |
| `GMI_MODEL` | For a model judgment | Model id. This service does not pick one. |
| `GMI_BASE_URL` | No | Default `https://api.gmi-serving.com/v1`, the public OpenAI-compatible base. |
| `ORIANE_BASE_URL` | No | Default `https://connect.oriane.xyz`. |
| `CORS_ORIGINS` | No | Comma-separated allowlist. Default `http://localhost:5173,http://127.0.0.1:5173`. Read when the process starts. |
| `HTTP_TIMEOUT_SECONDS` | No | Default 20. No retries. |
| `SEARCH_CACHE_TTL_SECONDS` | No | Default 600. Caches a finished search in this process only. |
| `ASSET_CACHE_TTL_SECONDS` | No | Default 3600. Reuses one Oriane reference asset. |
| `RATE_LIMIT_PER_MINUTE` | No | Default 30, per process. `0` turns it off. |

Public GMI docs (checked 6 Nov 2026) describe `POST /v1/chat/completions` with `model` and `messages`. One table says `max_tokens` is 1–128, while the example uses 2000. This service sends `max_tokens: 2000` and `response_format: json_object`. If the chosen model rejects that, the search still returns and the assessment is `unassessed`.

## What a search does

`POST /api/search` takes a brand, optional aliases, and platforms. Instagram and TikTok are the default. YouTube is accepted when the caller lists it.

Four Oriane calls run, each `projection=full`, `limit=10`, `offset=0`:

| Channel | Sort | Filter |
| --- | --- | --- |
| `written` | `viewsCount:desc` | platform AND (caption OR hashtags OR mentionHandles) `includesExactly` the terms |
| `transcript` | `viewsCount:desc` | `transcript.includesExactly` |
| `ocr` | `viewsCount:desc` | `onScreenText.includesExactly` |
| `visual` | `visualSimilarity:desc` | one reference asset, `minScore` 0.9 |

HTTP 200 and 206 are both a page of results. 206 does not mean the rows are complete. There is no second page. Channel `indexCandidateCount` values overlap, so they are not added together.

Posts merge on `platform` + `platformId`. A creator is `platform` + Oriane `profilePlatformId`, or `platform` + handle when that id is missing. The same handle on Instagram and TikTok stays two creators.

GMI then sees the excerpts once. A post counts toward reach only when the model says `relevant` and sets no holdout. Creators sort by the sum of `viewsCount` on those distinct posts, highest first. One relevant post is enough. A missing view stays null and sets `viewsIncomplete`. It is not stored as zero.

`sumViews` is only that relevant-post sum. Posts that are held out still carry their own `viewsCount`.

Disclosure on each post is `disclosed` or `unknown`. There is no unpaid value. A handle equal to the brand or an alias is `owned_account` from a rule, not from the model, and `partnershipEligible` is false.

Held out of the ranked list: owned accounts, ASR false positives, complaints, reposts, incidental mentions, irrelevant, and uncertain. The model writes one short `why` from the excerpts. It does not write outreach, an invoice, or a CPM.

`canonicalPostUrl` is null. `paidPartnership` is `not_in_oriane_schema`. Frame scores are copied through and are not a calibrated probability. `visionVerificationRun` is false. This service does not download frames.

If one Oriane channel fails, its `status` is `failed`, a warning is included, and the other channels are still returned. A failure is not reported as an empty catalog.

If GMI is unset, errors, times out, or returns JSON this service cannot use, `assessment` is `unassessed` and `rankedCreators` is empty. Those creators are in `unassessedCreators` with `judgmentSource: "pending"`. Nothing in that state is a verified model judgment.

## Contract

Request:

```json
{
  "brand": "Ryanair",
  "aliases": ["#Ryanair"],
  "platforms": ["instagram", "tiktok"],
  "visualText": "RYANAIR lettering on a fuselage",
  "visualImageUrl": null
}
```

`visualImageUrl`, when set, is an `https` URL with no userinfo. Oriane fetches it. This service does not. If both visual fields are omitted, the reference text is a generated line that asks for lettering or a logo and says a color match is not the brand.

A finished response looks like this. Counts here are illustrative, and `sampleNote` is abbreviated.

```json
{
  "brand": "Ryanair",
  "terms": ["ryanair"],
  "platforms": ["instagram", "tiktok"],
  "assessment": "complete",
  "assessmentReason": null,
  "gmiModel": "configured-by-env",
  "rankingBasis": "sum_of_views_on_distinct_relevant_posts_in_retrieved_sample",
  "visionVerificationRun": false,
  "visualScoresUncalibrated": true,
  "repeatedFootageNotDeduplicated": true,
  "viewsAreNotUniqueAudience": true,
  "disclosureValues": ["disclosed", "unknown"],
  "sampleNote": "Ranking uses this retrieved sample only, not the Oriane catalog.",
  "channels": [
    {
      "channel": "written",
      "status": "ok",
      "httpStatus": 206,
      "indexCandidateCount": 896,
      "retrieved": 10,
      "pageLimit": 10,
      "warning": null
    }
  ],
  "warnings": [],
  "retrievedRows": 10,
  "distinctPosts": 10,
  "visualReference": {"kind": "text", "text": "RYANAIR lettering on a fuselage"},
  "visualAssetReused": false,
  "cache": "miss",
  "rankedCreators": [
    {
      "creatorKey": "tiktok:123",
      "platform": "tiktok",
      "creatorId": "123",
      "handle": "example.creator",
      "sumViews": 1600000,
      "viewsIncomplete": false,
      "relevantPostCount": 1,
      "retrievedPostCount": 1,
      "disclosure": "unknown",
      "partnershipEligible": true,
      "holdoutReason": null,
      "why": "The transcript says they are taking Ryanair.",
      "whySource": "model",
      "judgmentSource": "model",
      "assessment": "complete",
      "posts": [
        {
          "postKey": "tiktok:123",
          "platform": "tiktok",
          "platformId": "123",
          "viewsCount": 1600000,
          "canonicalPostUrl": null,
          "paidPartnership": "not_in_oriane_schema",
          "retrievedBy": ["transcript"],
          "evidenceLabels": ["transcript"],
          "disclosure": "unknown",
          "countsTowardReach": true,
          "verdict": "relevant",
          "holdout": null,
          "assessment": "complete",
          "media": [
            {
              "transcript": "We're taking Ryanair.",
              "transcriptChunks": [{"startSeconds": 20.9, "endSeconds": 26.2, "text": "We're taking Ryanair."}],
              "onScreenText": [],
              "frames": []
            }
          ]
        }
      ]
    }
  ],
  "heldOut": [],
  "unassessedCreators": []
}
```

`evidenceLabels` may include `caption`, `hashtag`, `mention`, `transcript`, `ocr`, and `visual`. `retrievedBy` is which channel query returned the post. Media keeps transcript, chunks, on-screen text, and frame url / timestamp / region text / `visualSimilarityScore` when Oriane sent them. Polygon points are not copied.

### Degraded states

Oriane key missing. No provider call. Ranked list empty.

```json
{
  "assessment": "unassessed",
  "assessmentReason": "oriane_not_configured",
  "channels": [
    {"channel": "written", "status": "not_configured", "httpStatus": null, "retrieved": 0, "warning": "ORIANE_API_KEY is not set. This channel was not called."}
  ],
  "rankedCreators": [],
  "unassessedCreators": []
}
```

One channel failed. Other channels still populate creators. `indexCandidateCount` on the failed channel is null.

```json
{
  "warnings": ["written: Oriane provider timed out. This channel has no rows."],
  "channels": [
    {"channel": "written", "status": "failed", "httpStatus": null, "indexCandidateCount": null, "retrieved": 0, "warning": "Oriane provider timed out. This channel has no rows."},
    {"channel": "transcript", "status": "ok", "httpStatus": 206, "indexCandidateCount": 527, "retrieved": 1, "warning": null}
  ]
}
```

GMI missing, HTTP error, timeout, or a body that is not usable JSON. Creators from Oriane are returned under `unassessedCreators`. `verdict` is null. This is not a relevance judgment. An owned-brand handle is still listed under `heldOut` with `judgmentSource: "rule"`.

```json
{
  "assessment": "unassessed",
  "assessmentReason": "gmi_not_configured",
  "rankedCreators": [],
  "unassessedCreators": [
    {"handle": "ufc", "judgmentSource": "pending", "partnershipEligible": false, "why": null}
  ]
}
```

`assessmentReason` for a failed model call is `gmi_error` or `malformed_model_response`.

No rows from the pages that succeeded:

```json
{"assessment": "not_run", "assessmentReason": "no_posts", "rankedCreators": [], "distinctPosts": 0}
```

Validation is HTTP 422. More than the process rate limit is HTTP 429 with detail `Too many searches from this process. Wait a minute.`

Held-out `holdoutReason` is one of `owned_account`, `asr_false_positive`, `complaint`, `repost`, `incidental`, `irrelevant`, `uncertain`.

## Limits that remain

The live Ryanair check on 6 Nov 2026 saw index counts of 896 written, 527 transcript, 1789 OCR, and 42 visual candidates, and 35 distinct posts in the top 10 of each channel. This service asks for that same page size and does not walk the rest of the index. Oriane's own how-to-search also describes about three months, accounts under 5,000 followers, and up to a week of lag. A ranked list is a sample, not every mention.

No canonical post URL and no paid-partnership field are invented. Hosting access to GMI is not verified here. Keys are not in this repo.

## Creator report visual analysis

The production frontend requests Instagram only for brand searches and creator reports. The API still accepts explicit platform requests from other clients.

Set `GMI_VISION_MODEL` on the server to an image-capable model available to your GMI account. This enables creator frame analysis independently of the text model in `GMI_MODEL`. Alternatively, `GMI_VISION=1` enables frame analysis with `GMI_MODEL` when that model supports image input. Both paths require the GMI key and text model configuration. Redeploy after changing hosted environment variables. No live vision validation is implied by mocked tests.

Reports distinguish disabled vision, unavailable frames, and failed analysis. `assessment.textReason` and `assessment.visionReason` keep separate model-call failures; `assessment.reason` remains for existing clients.

Creator cards show distinct post views. An optional `CREATOR_ILLUSTRATIVE_CPM` supplies an illustrative estimate after confirmation; no default price is assumed. People, teams, and distribution platforms remain in the response as contextual evidence and are collapsed in the frontend.
