import images from './image-assets.json' with { type: 'json' };
export const STAGING_ORIGIN = 'https://velocitymarketing-v2.vercel.app';
export const DEFAULT_SOCIAL_IMAGE = '/ogimage-v2.png';

// Older saved drafts reference the original default card. Display the refreshed
// brand asset without rewriting their content or replacing custom uploads.
export function imageSource(source) {
  return source === '/ogimage.png' ? DEFAULT_SOCIAL_IMAGE : images[source]?.src || source;
}

// Keep unknown/custom uploads intact. A replacement must never inherit the
// default portrait's srcset, or the browser would keep showing the old image.
export function responsiveImage(source) {
  return images[source] || { src: imageSource(source) };
}
