/**
 * Telling social posts apart from disease archives.
 *
 * The posts API returns a mixed list, and the backend now labels each item
 * with `post_type` ('social' | 'archive' | 'unknown').
 *
 * Before that field existed the frontend guessed from "does it have a photo",
 * on the assumption that every social post has one. That assumption is usually
 * true, because an image is required when creating a post - but it silently
 * hid any social post whose image failed to upload, and it hides seeded or
 * imported content that has no image.
 *
 * The old heuristic is kept only as a fallback for payloads that predate
 * `post_type`, so the page still behaves sensibly against an older backend.
 */

export const POST_TYPE_SOCIAL = 'social';
export const POST_TYPE_ARCHIVE = 'archive';

/** True when `post` is a normal social post rather than a disease archive. */
export function isSocialPost(post) {
  if (!post) return false;

  if (typeof post.post_type === 'string' && post.post_type !== '') {
    return post.post_type === POST_TYPE_SOCIAL;
  }

  // Fallback: no post_type in this payload (older backend).
  return hasImages(post);
}

/** True when the post carries at least one image. */
export function hasImages(post) {
  return Boolean(post && Array.isArray(post.images) && post.images.length > 0);
}

export default isSocialPost;
