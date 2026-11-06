# Oriane API pilot manifest

Exported for the parent integration agent. This archive is the reusable pilot.
Do not treat it as a live Oriane catalog.

## Test commands

From the extracted directory:

```bash
python3 -m unittest discover -s tests -v
python3 -m oriane_probe
```

Expected: 13 tests, OK. The second command rewrites `evidence/capability-report.json` from the pinned snapshot and the recorded gate files. It does not call Oriane.

`scripts/refresh_openapi_snapshot.py` fetches the public docs HTML only. It was not run for this export. Do not run it unless the docs page should replace the snapshot.

## Evidence classes

| Path | Class |
| --- | --- |
| `schema/openapi.snapshot.json` | Official OpenAPI 3.0 extracted from the public Scalar page at https://connect.oriane.xyz/rest/docs (iframe on https://www.oriane.xyz/api). Fetched 2026-11-06. Not a live search response. |
| `schema/PROVENANCE.json` | Hash and source of that snapshot. `live_authenticated_calls` is false. |
| `fixtures/synthetic_content_full.json` | Synthetic fixture. `_fixture` says SYNTHETIC. Not a creator result. |
| `evidence/unauthenticated-gate.json` | Live keyless POST to `/rest/contents/search` on 2026-11-06. HTTP 401. No content payload. |
| `evidence/unauthenticated-routes.json` | Live keyless POSTs to all three documented routes. All HTTP 401. No content payload. |
| `evidence/capability-report.json` | Machine summary generated offline from the snapshot plus those recorded 401s. |
| `evidence/unittest.txt` | Saved offline unit-test run. 13 tests, OK. |
| `README.md` | Research verdict. Separates schema, product help, marketing, the 401 gate, and the synthetic fixture. |
| `oriane_probe/` and `tests/` | Client plumbing. `execute()` refuses to send. |

No authenticated Oriane call is in this archive. No creator post list, view count, transcript, or frame was returned by Oriane.

## Scope update for the destination build

Brand-first target is Ryanair. Text mentions are the required signal, in the fields the creator or the index actually stores:

- caption (the OpenAPI name; product help labels the same text Caption / Description; there is no separate `description` property on the content schema)
- title, when present
- hashtags
- transcript and transcriptChunks
- onScreenText and frame onScreenTextRegions

A known Ryanair logo or livery image may be sent later as an optional `visualSimilarity` asset. Color match alone is weak evidence. Keep visual search optional. Do not block the text path on it.

This scope note is not implemented as a Ryanair query in the probe. The builders stay generic.

## Excluded from this zip

`.git`, `__pycache__`, `*.pyc`, `.env`, `node_modules`, virtualenvs, pytest cache, and `agent-tools/` page-fetch caches.
