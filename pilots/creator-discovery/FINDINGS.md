# Creator discovery pilot findings

This file is the output of `python3 -m creator_discovery` on the captures in this directory.
The process did not call Oriane and did not call GMI. It did not add a backend or frontend route.

The earlier Ryanair cross-creator sample was not loaded. That sample starts from a known brand. These captures do not.

No accuracy, precision, or recall is stated. The supplied-string section is a quote check of names passed in by the caller. It is not a list of every brand and it is not ground truth.

## What ran

- `cheapholidayexpert` on `tiktok`: brand_filter `None`, HTTP 206, 5 returned posts, indexed totalCount 24, page covers that total: False.
  Nonempty transcript posts: 4. Nonempty OCR posts: 5. Posts with frames: 5. Frame count: 169.
  Media transcript states: `{'empty': 1, 'present': 4}`. Media OCR states: `{'present': 5}`.
  Frame objects with an id: 169. Placeholder frame objects skipped: 1.
  Rows dropped for author, platform, or duplicate id: 0.
  The stored capture records 6 on-screen-text strings removed before commit because they matched a membership-card pattern. Frame-region text in this file did not match that pattern. Those strings are not quoted below.
  Baseline candidates:
  - `Cal Sleeper` is `brand_candidate` (possible_person_or_alias) on 7699054624178785558 (views 9674).
  - `James Robinson` is `brand_candidate` (possible_person_or_alias) on 7699054624178785558 (views 9674).
  - `caledonian` is `brand_candidate` (unconfirmed_hashtag) on 7699054624178785558 (views 9674), 7699480431510523158 (views 57900).
  - `caledoniansleeper` is `brand_candidate` (account_may_be_person, unconfirmed_hashtag) on 7699054624178785558 (views 9674), 7699480431510523158 (views 57900).
  - `sleepertrain` is `brand_candidate` (unconfirmed_hashtag) on 7699054624178785558 (views 9674).
  - `uksleepertrain` is `brand_candidate` (unconfirmed_hashtag) on 7699054624178785558 (views 9674), 7699480431510523158 (views 57900).
  - `cumbrianjames` is `brand_candidate` (account_may_be_person) on 7699054624178785558 (views 9674).
  - `stanstedairport` is `brand_candidate` (unconfirmed_hashtag) on 7699815257883151638 (views 8016), 7700919307861200130 (views 80000).
  - `stanstedairportlounge` is `brand_candidate` (unconfirmed_hashtag) on 7699815257883151638 (views 8016).
  Supplied strings with an exact quote that the baseline did not emit as the same name: Ryanair, AJet, A-Jet, easyJet, Priority Pass, Escape Lounge, The Camden, Spoons, Guinness, Wetherspoons, ARRAN.
  Supplied strings with no exact substring on this creator's returned posts: Apple, iPhone, iMac, OPPO, Hasselblad, Huawei, Everyman, KIA, Porsche, Lamborghini, Ferrari, TAG Heuer, TAGHEUER, Mobil, ORACLE, MW4, GTA, PS5, Top Gear.
  Every returned post has a viewsCount.
  Sum of non-null viewsCount on this page: 166890. Sum of viewsCount on returned posts that have a number. Not unique reach, not a lifetime total, and not a valuation.
  Model experiment: unrun. missing GMI_API_KEY and GMI_MODEL

- `developeradam` on `instagram`: brand_filter `None`, HTTP 206, 5 returned posts, indexed totalCount 59, page covers that total: False.
  Nonempty transcript posts: 3. Nonempty OCR posts: 5. Posts with frames: 5. Frame count: 100.
  Media transcript states: `{'empty': 6, 'null': 10, 'present': 3}`. Media OCR states: `{'empty': 4, 'present': 15}`.
  Rows dropped for author, platform, or duplicate id: 0.
  Baseline candidates:
  - `everymandriving` is `brand_candidate` (account_may_be_person) on DewXQhhs5vX (views 57739).
  - `oppouk` is `brand_candidate` (account_may_be_person) on DezYvKqDPdv (views None).
  Supplied strings with an exact quote that the baseline did not emit as the same name: Apple, iPhone, iMac, OPPO, Hasselblad, Everyman, KIA, Porsche, Lamborghini, Ferrari, TAG Heuer, Mobil, ORACLE, MW4, GTA, PS5, Top Gear.
  Supplied strings with no exact substring on this creator's returned posts: Ryanair, AJet, A-Jet, easyJet, Priority Pass, Escape Lounge, The Camden, Spoons, Guinness, Wetherspoons, Caledonian Sleeper, ARRAN, Huawei, TAGHEUER.
  Null viewsCount on returned posts: DezYvKqDPdv.
  Sum of non-null viewsCount on this page: 810506. Sum of viewsCount on returned posts that have a number. Not unique reach, not a lifetime total, and not a valuation.
  Model experiment: unrun. missing GMI_API_KEY and GMI_MODEL

Across these pages: 10 posts, 7 with a nonempty transcript, 10 with nonempty OCR, 10 with frames, 269 frame objects with an id. Media transcript states {'empty': 7, 'present': 7, 'null': 10}. Media OCR states {'present': 20, 'empty': 4}.

## Grounded strings the baseline did not emit

Each line is a bounded exact substring from the caller-supplied list. The baseline did not emit that same name. This is not a complete brand list.

- `Ryanair` on `7699815257883151638` views 8016, field `caption`, timestamp None: ...not available for passengers flying with Ryanair, AJet or easyJet because it’s in a differ...
- `AJet` on `7699815257883151638` views 8016, field `caption`, timestamp None: ...lable for passengers flying with Ryanair, AJet or easyJet because it’s in a different pa...
- `A-Jet` on `7699815257883151638` views 8016, field `transcript_chunk`, timestamp 0: ...but the problem is it is not for Ryanair, A-Jet or EasyJet flight, and there literally is...
- `easyJet` on `7699815257883151638` views 8016, field `caption`, timestamp None: ...r passengers flying with Ryanair, AJet or easyJet because it’s in a different part of the a...
- `Priority Pass` on `7699815257883151638` views 8016, field `caption`, timestamp None: ...wever if you usually get free access with Priority Pass, there is another option… You can head t...
- `Escape Lounge` on `7699815257883151638` views 8016, field `caption`, timestamp None: ...LOUNGE UPDATE 🚨 You may have spotted that Escape Lounge at Stansted Airport has closed 😭 So here’...
- `The Camden` on `7700919307861200130` views 80000, field `caption`, timestamp None: ...pint with a view! 🍺 SO WHERE IS IT? 📍The Camden I’ve actually walked past this pub load...
- `Spoons` on `7700919307861200130` views 80000, field `caption`, timestamp None: ...viewing area - and after seeing how busy Spoons was, I was hopeful that this was going to...
- `Guinness` on `7700919307861200130` views 80000, field `on_screen_text`, timestamp None: GUINNESS
- `Wetherspoons` on `7700919307861200130` views 80000, field `on_screen_text`, timestamp None: Is this better than Wetherspoons? bar restaurant the Windmill Wetherspoons...
- `ARRAN` on `7699480431510523158` views 57900, field `on_screen_text`, timestamp None: ARRAN
- `Apple` on `De37AwzsDIC` views 92454, field `caption`, timestamp None: Apple IPhone Duo 🤩🤩
- `iPhone` on `De37AwzsDIC` views 92454, field `caption`, timestamp None: Apple IPhone Duo 🤩🤩
- `iMac` on `De37AwzsDIC` views 92454, field `on_screen_text`, timestamp None: iMac G3
- `OPPO` on `DezYvKqDPdv` views None, field `caption`, timestamp None: Little dump from the OPPO Find X10 Series launch in Mallorca ☀️ 🇪🇸...
- `Hasselblad` on `DezYvKqDPdv` views None, field `on_screen_text`, timestamp None: Hasselblad verter Case
- `Everyman` on `DewXQhhs5vX` views 57739, field `caption`, timestamp None: Now this was a sick day!! Everyman driving experiences invited me out to the...
- `KIA` on `DewXQhhs5vX` views 57739, field `caption`, timestamp None: ...passenger rides and then fully sending a KIA around the figure of 8 track for a timed...
- `Porsche` on `DewXQhhs5vX` views 57739, field `transcript_chunk`, timestamp 13.36: some very sexy supercars, including a Porsche 911 GT3 RS, a Lamborghini Huracan and a F...
- `Lamborghini` on `DewXQhhs5vX` views 57739, field `transcript_chunk`, timestamp 13.36: ...ercars, including a Porsche 911 GT3 RS, a Lamborghini Huracan and a Ferrari
- `Ferrari` on `DewXQhhs5vX` views 57739, field `transcript_chunk`, timestamp 13.36: ...e 911 GT3 RS, a Lamborghini Huracan and a Ferrari
- `TAG Heuer` on `DewXQhhs5vX` views 57739, field `on_screen_text`, timestamp None: TAG HEUER Mobil 1 ORACLE CARLYLE
- `Mobil` on `DewXQhhs5vX` views 57739, field `on_screen_text`, timestamp None: TAG HEUER Mobil 1 ORACLE CARLYLE
- `ORACLE` on `DewXQhhs5vX` views 57739, field `on_screen_text`, timestamp None: TAG HEUER Mobil 1 ORACLE CARLYLE
- `MW4` on `De65olDMifM` views 255144, field `caption`, timestamp None: Sunday Funday 🤙🏼 Enjoying MW4 multiplayer right now however I’m far bet...
- `GTA` on `DerVinws0-K` views 405169, field `caption`, timestamp None: GTA 6 IS ONLY ONE MONTH AWAY AND I AM READY...
- `PS5` on `DerVinws0-K` views 405169, field `caption`, timestamp None: ...😍😍😍😍 No PC at launch so I will be on the PS5 Pro 👀
- `Top Gear` on `DewXQhhs5vX` views 57739, field `caption`, timestamp None: ...ing experiences invited me out to the old Top Gear test track for an action-packed day! Dr...

Supplied strings with no bounded exact substring on either returned page: Huawei, TAGHEUER. A glued OCR spelling is not counted, and a miss here is not a claim that the letters are absent in some other form.

## What this does not show

- The baseline does not find brands that are only written in a caption sentence, spoken, or burned into a frame. Those strings stay out until a model quote survives the exact-substring check or a person confirms a frame.
- A grounded supplied string is evidence the letters occur. It is not a confirmed brand, a paid deal, or a complete inventory.
- Empty, null, and missing transcripts are different field states. None of them means the video has no brand.
- Disclosure on a post is `disclosed` or `unknown`. Invitation language is a signal. It is not payment proof. A negation does not create an unpaid label.
- Views are the post `viewsCount` on matching returned posts. They are not added across names, not unique reach, and not a price.
- HTTP 206 and a totalCount larger than the page both mean this file is not the rest of the index. The help-center window, follower floor, and lag were not re-measured here.
- Five frames were inspected by the research notes that accompanied the capture. This process did not open those images and did not run a vision model.
- The partial manual annotations described with the capture are not loaded as a 32-row gold set. They were not in the capture file.
- Unit tests on `fixtures/synthetic_creator_posts.json` cover a mixed author and platform, a duplicate platform id, null versus missing versus empty transcript, a person/brand homonym, a disclosure tag, a negation that stays unknown, and a model quote that cannot confirm a name or set a payment label. Those rows are synthetic.

## Pending

- `gmi_inference`: GMI_API_KEY and GMI_MODEL were read from the environment passed to this process. A missing value leaves the model unrun. This pilot also refuses to send, so a present key would still not be a result. No accuracy is filled in.
- `vision_frame_model`: Frame URLs were not fetched. No vision model ran. visualSimilarity was not used.
- `exhaustive_human_gold`: Partial manual notes are not an exhaustive brand list. This report does not score the baseline against them.
- `remaining_indexed_pages`: Captures here are the first page only. Later offsets were not requested by this pilot.
- `production_creator_route`: No backend or frontend route was added. Integration is a later decision.
