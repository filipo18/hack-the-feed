# Creator discovery pilot

A creator handle and one platform go in. The captured Oriane contents-search page for that author comes out as candidate names, each tied to an exact field snippet, a post id, and that post's `viewsCount`.

This directory does not call Oriane, does not call a model, and does not add a route to the production backend or frontend.

The question is the opposite of a known-brand search. The request that produced the live captures was `profileHandle.exactMatch` plus `platform.includes`, with no brand filter. The pinned document for that request is `pilots/oriane-api/schema/openapi.snapshot.json`. Content results have captions, hashtags, mentions, transcripts, chunks, on-screen text, and frames. They do not have a brands array or a paid flag. `aiSearchAnchor` belongs to visual-similarity paging, not to this handle query. `visualSimilarity` compares a known asset. It is not a detector for unknown logos.

## What the baseline does

It keeps rows whose `profileHandle` and `platform` match the capture scope, and it collapses duplicate `platform` + `platformId` pairs. It then emits:

- hashtags from the `hashtags` array
- mention handles
- co-author handles
- in-media account tags
- `@` names written in the caption

Platform tags such as `#onthisday` and disclosure tags such as `#ad` are recorded and are not brand candidates. A self-mention is not a brand candidate. Every other surface is a `brand_candidate` until a person confirms that same extracted name. Account handles and caption `@` names stay on human confirm because they may be a person. `jordan`, `apple`, and `stanley` are an ambiguity hold for tokens the baseline already extracted. That hold is not a list the scanner searches for in prose.

The baseline does not read caption sentences, speech, or OCR for brand names. A name that is only spoken or only on screen is a gap, not a silent miss that the report pretends to cover.

Disclosure is `disclosed` or `unknown`. An invitation ("invited me") is a signal. It is not proof of payment. "Not sponsored" does not become unpaid.

Views stay the post's `viewsCount`, including null. They are not added across names and they are not a price.

## Model adapter

`GMI_API_KEY`, `GMI_MODEL`, and optional `GMI_ENDPOINT` configure an OpenAI-compatible chat-completions request. The default URL is `https://api.gmi-serving.com/v1/chat/completions`, from the GMI Cloud LLM API reference. The adapter checks that a returned `quote` is an exact substring of the named field and that the name occurs inside that quote. It drops a confirmed or unpaid label if the model emits one. Transcript text is passed as data, not as instructions.

This process does not send the request. With either variable unset, the experiment is `unrun` and accuracy is null. A key in the environment would still not be sent, and it is not copied into the report.

## Vision

Frames are counted. They are not downloaded. A later design is: sample a frame, propose a name, keep it unconfirmed until the same name is an exact text quote or a person confirms that frame. Repeated frames are not extra exposures. That pass is not implemented.

## Run

```bash
cd pilots/creator-discovery
python3 -m unittest discover -s tests -v
python3 -m creator_discovery \
  --capture fixtures/live/creator-samples.json \
  --names fixtures/illustrative_names.json \
  --out evidence \
  --findings FINDINGS.md
```

`fixtures/synthetic_creator_posts.json` is labeled synthetic. `fixtures/live/creator-samples.json` is the 6 Nov 2026 creator-only capture after membership-card on-screen strings were removed. The quote-check names are the manual notes' spellings. They are not ground truth.

`evidence/` is produced by the command above. `FINDINGS.md` states what that command actually counted.
