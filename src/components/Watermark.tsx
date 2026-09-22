/** Faint line-art of the Shruti logo, fixed behind every screen of the app. */
export const WATERMARK_URL = `${import.meta.env.BASE_URL}watermark.webp`;

export function Watermark() {
  return <img className="watermark" src={WATERMARK_URL} alt="" aria-hidden="true" decoding="async" draggable={false} />;
}
