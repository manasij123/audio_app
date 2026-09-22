/** Deterministic artwork colours for tracks without embedded cover art. */
export function hashHue(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return Math.abs(h) % 360;
}

/** First visible letter (a whole Bengali grapheme cluster, not half a conjunct). */
export function initialOf(title: string): string {
  const clean = title.replace(/^[\s\d#.\-–—:|()[\]]+/, '');
  try {
    const seg = new Intl.Segmenter('bn', { granularity: 'grapheme' });
    const first = seg.segment(clean)[Symbol.iterator]().next().value;
    return first?.segment.toUpperCase() ?? '♪';
  } catch {
    return clean.charAt(0).toUpperCase() || '♪';
  }
}

/** Average colour of an image, nudged to be vivid enough to tint a background. */
export async function dominantColor(url: string): Promise<[number, number, number] | null> {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      // Weight saturated pixels more so a grey border doesn't wash the colour out.
      const w = 1 + (max - min) / 32;
      r += d[i] * w;
      g += d[i + 1] * w;
      b += d[i + 2] * w;
      n += w;
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  } catch {
    return null;
  }
}
