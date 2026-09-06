export const MAX_SUBSCRIBE_PROMPTS_PER_FEED = 3;
export const POSTS_BETWEEN_SUBSCRIBE_PROMPTS = 2;

export type SubscribePromptCandidate = {
  id: string;
  creatorId: string;
  isFree: boolean;
  isEligible: boolean;
};

/**
 * Keeps subscription invitations useful without making the feed feel promotional.
 * Spacing is based on free posts because premium posts are not rendered in For You.
 */
export function selectSubscribePromptPostIds(
  posts: SubscribePromptCandidate[],
): Set<string> {
  const selected = new Set<string>();
  const promptedCreators = new Set<string>();
  let freePostIndex = -1;
  let lastPromptIndex = -(POSTS_BETWEEN_SUBSCRIBE_PROMPTS + 1);

  for (const post of posts) {
    if (!post.isFree) continue;
    freePostIndex += 1;

    if (selected.size >= MAX_SUBSCRIBE_PROMPTS_PER_FEED) break;
    if (!post.isEligible || promptedCreators.has(post.creatorId)) continue;
    if (freePostIndex - lastPromptIndex <= POSTS_BETWEEN_SUBSCRIBE_PROMPTS) continue;

    selected.add(post.id);
    promptedCreators.add(post.creatorId);
    lastPromptIndex = freePostIndex;
  }

  return selected;
}
