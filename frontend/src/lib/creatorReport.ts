/** View counts belong to distinct posts, not to each extracted mention. */
export function postViews(posts: { platformId: string; views: number | null }[]) {
  const distinct = [...new Map(posts.map((post) => [post.platformId, post])).values()];
  const known = distinct.filter((post) => post.views != null);
  return {
    total: known.length ? known.reduce((sum, post) => sum + post.views!, 0) : null,
    incomplete: known.length < distinct.length,
  };
}
