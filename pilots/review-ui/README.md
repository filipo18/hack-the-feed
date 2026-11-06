# Who owes you — local pilot

A narrow, synthetic pilot for a creator hackathon. It reviews brand appearances in one creator's videos, then shows a fictional illustration and a factual sponsorship pitch.

The page name is a joke. The pilot does not calculate a debt, send anything, or call Oriane.

## Run

```bash
npm install
npm test
npm run dev
```

The dev server is [http://127.0.0.1:47321](http://127.0.0.1:47321).

## What is in the box

- Rule-based brand matching, including homonyms (apple the fruit, a person named Stanley) and text versus visual evidence.
- A tri-state sponsorship check: `disclosed`, `review`, `creator_confirmed_organic`. Silence is never organic.
- Valuation that dedupes on platform + platform id, splits views when several brands share a video, and leaves missing views unknown.
- Placeholder CPM assumptions ($5 / $15 / $40). Those numbers and the pitch sentences are for the teammate who owns pricing and copy to replace.

The hackathon handoff, Oriane field map, and Lovable secret rules are in [docs/PILOT.md](docs/PILOT.md).

No API key is stored here. No live Oriane request is made.
