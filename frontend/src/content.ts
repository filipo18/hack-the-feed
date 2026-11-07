export const PRODUCT_NAME = "Unpaid";

export type Audience = "brands" | "creators";

export const SCAN_STAGES: Record<Audience, string[]> = {
  brands: ["Reading captions", "Listening to speech", "Reading on-screen text", "Checking the visuals", "Ranking creators by impressions"],
  creators: ["Finding Instagram posts", "Reading captions and transcripts", "Reading on-screen text", "Matching brands", "Preparing your report"],
};

export interface Copy {
  path: string;
  resultsPath: string;
  lineOne: string;
  lineTwo: string;
  lede: string;
  placeholder: string;
  inputLabel: string;
  action: string;
  examples: string[];
  stepsTitle: [string, string];
  steps: { name: string; text: string; panel: { label: string; value: string; note: string }[] }[];
  compareTitle: [string, string];
  compareOld: string;
  compareRows: { label: string; old: string; next: string }[];
  crossTitle: string;
  crossText: string;
  crossAction: string;
  frame: { caption: string; toastTitle: string; toastText: string; valueLabel: string; value: string; image: string };
}

export const COPY: Record<Audience, Copy> = {
  brands: {
    path: "/for-brands",
    resultsPath: "/brands",
    lineOne: "Your best creators",
    lineTwo: "already post you.",
    lede: "Stop searching for creators who might fit. Find the ones already showing your brand, see how their videos did, and turn one-off posts into paid collabs.",
    placeholder: "Your brand, like Birkenstock",
    inputLabel: "Your brand",
    action: "Find creators",
    examples: ["Birkenstock", "Starbucks", "Ryanair"],
    stepsTitle: ["Stop looking", "for strangers."],
    steps: [
      {
        name: "Search",
        text: "Type your brand. We read captions, speech and on-screen text in short videos.",
        panel: [
          { label: "Videos read", value: "883", note: "Illustrative sample" },
          { label: "Ad posts removed", value: "41", note: "Marked #ad or paid partnership" },
        ],
      },
      {
        name: "Rank",
        text: "See every creator with no ad marker on the post, sorted by impressions.",
        panel: [
          { label: "Top creator", value: "4.1M", note: "Impressions across 2 videos" },
          { label: "All creators", value: "30.1M", note: "Impressions you didn’t know about" },
        ],
      },
      {
        name: "Reach out",
        text: "Open a creator and send a message that names the video they already made.",
        panel: [
          { label: "Opening line", value: "“Let’s do a paid collab.”", note: "Written from the video they already made" },
          { label: "Proof attached", value: "Link and views", note: "No cold pitch" },
        ],
      },
      {
        name: "Keep them",
        text: "Turn one-off posts from creators who already love you into regular partnerships.",
        panel: [
          { label: "Next step", value: "Monthly collab", note: "Start with your top 10" },
          { label: "New mentions", value: "Every week", note: "Search again as new videos land" },
        ],
      },
    ],
    compareTitle: ["Cold lists guess.", "Their videos prove it."],
    compareOld: "Creator database",
    compareRows: [
      { label: "Who you contact", old: "Strangers", next: "People already posting you" },
      { label: "Proof they fit", old: "Follower count", next: "Their own video" },
      { label: "First message", old: "Would you try us?", next: "We saw your video" },
      { label: "Price talk", old: "Their rate card", next: "Real impressions on your brand" },
    ],
    crossTitle: "Creator?",
    crossText: "Find the brands in your videos and see what those mentions are worth.",
    crossAction: "See your mentions",
    frame: {
      image: "/ugc/starbucks/1.jpg",
      caption: "“my Starbucks order, every single morning”",
      toastTitle: "Spoken at 0:14",
      toastText: "Starbucks found. No ad marker on this post.",
      valueLabel: "Impressions on this video",
      value: "3.2M",
    },
  },
  creators: {
    path: "/for-creators",
    resultsPath: "/creators",
    lineOne: "You post them.",
    lineTwo: "Now get paid.",
    lede: "Find the brands in your videos, see what those mentions are worth, and pitch a paid collab with your own numbers.",
    placeholder: "Your handle, like yourname",
    inputLabel: "Your handle",
    action: "Find my mentions",
    examples: ["sample.sofia", "sample.kenji"],
    stepsTitle: ["You already", "did the work."],
    steps: [
      {
        name: "Search",
        text: "Type your handle. We read your captions, speech and on-screen text.",
        panel: [
          { label: "Brands found", value: "4", note: "Including ones you never tagged" },
          { label: "Ad posts removed", value: "3", note: "Deals you already have" },
        ],
      },
      {
        name: "Value",
        text: "See what each mention would cost the brand to buy, based on your views, market, account size and past brand deals.",
        panel: [
          { label: "Best mention", value: "3.2M views", note: "Spoken at 0:14" },
          { label: "Cost to buy that reach", value: "$57,240", note: "An estimate, not money owed" },
        ],
      },
      {
        name: "Pitch",
        text: "Send the brand a short message with the video and the numbers.",
        panel: [
          { label: "Opening line", value: "“You’re in my videos.”", note: "Written from your real post" },
          { label: "Proof attached", value: "Link and views", note: "They can check it" },
        ],
      },
      {
        name: "Get paid",
        text: "Turn one free mention into a regular deal.",
        panel: [
          { label: "Next step", value: "Monthly collab", note: "Start with your top brand" },
          { label: "New mentions", value: "Every week", note: "Search again as you post" },
        ],
      },
    ],
    compareTitle: ["Cold pitches beg.", "Your videos prove it."],
    compareOld: "Cold pitch",
    compareRows: [
      { label: "What you send", old: "A media kit", next: "A video already live" },
      { label: "Your proof", old: "Follower count", next: "Views on their product" },
      { label: "Your price", old: "A guess", next: "What that reach costs to buy" },
      { label: "Their first thought", old: "Who is this?", next: "They already use us" },
    ],
    crossTitle: "Brand?",
    crossText: "Find the creators already showing your product and work with the best ones.",
    crossAction: "Find your creators",
    frame: {
      image: "/ugc/birkenstock/3.jpg",
      caption: "“Packing list: Birkenstock, passport, nothing else”",
      toastTitle: "On screen at 0:22",
      toastText: "Birkenstock found. You never tagged it.",
      valueLabel: "Worth to the brand",
      value: "$13,005",
    },
  },
};
