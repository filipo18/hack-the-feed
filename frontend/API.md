# API the front end expects

Set `VITE_API_URL` to the backend's base URL. Without it the app runs on synthetic rows and shows a "Sample data" tag. Types are in `src/lib/types.ts`.

## `GET /brands/:brand/creators`

Creators who show this brand, with paid posts already removed.

```json
{
  "brand": "Owala",
  "paidPostsRemoved": 14,
  "creators": [
    {
      "handle": "sample.sofia",
      "platform": "instagram",
      "followers": 412000,
      "market": "US",
      "brandDeals": 2,
      "mentions": [
        {
          "postUrl": "https://example.com/post",
          "platform": "instagram",
          "publishedAt": "2026-10-04",
          "views": 3180000,
          "brand": "Owala",
          "channels": ["spoken", "caption"],
          "snippet": "I take my Owala everywhere, honestly",
          "timestamp": "0:14"
        }
      ]
    }
  ]
}
```

## `GET /creators/:handle/mentions`

Brands found in this creator's videos. `handle` has no leading `@`.

```json
{
  "creator": { "handle": "sample.sofia", "platform": "instagram", "followers": 412000, "market": "US", "brandDeals": 2 },
  "paidPostsRemoved": 3,
  "brands": [{ "brand": "Owala", "mentions": [] }]
}
```

## Field rules

- `channels`: any of `caption`, `hashtag`, `spoken`, `on_screen`
- `views`: `null` when unknown, never `0`
- `timestamp`: `null` when the mention has no time, such as a caption
- `brandDeals`: posts on the account with an ad marker
- `market`: `US`, `UK`, `CA`, `AU`, `DE`, `FR`, `ES` or `Other`
- Dedupe by `postUrl`, and exclude brand accounts and collaborators
- Send CORS headers for the front-end origin

The front end works out the dollar values from these fields in `src/lib/value.ts`. The backend does not price anything.

## Not needed for the demo

- Login is a demo: it stores the brand or handle in the browser and checks nothing. Real auth replaces `src/lib/session.ts`.
- The outreach and pitch stages are saved in the browser. To save them per account, the backend needs an endpoint for them.
