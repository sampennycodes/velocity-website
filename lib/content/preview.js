// Local-only image overlays are deliberately separate from the savable schema.
export function previewImageSource(images, key, origin) {
  if (!images || typeof images !== 'object' || Array.isArray(images)) return null;
  const source = images[key];
  if (typeof source !== 'string' || source.length > 200) return null;
  try {
    const url = new URL(source);
    return url.protocol === 'blob:' && url.origin === origin && !url.search && !url.hash
      && /^[0-9a-f-]{36}$/.test(source.split('/').at(-1)) ? source : null;
  } catch { return null; }
}
