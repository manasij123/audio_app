/** The Shruti logo artwork (transparent background, white sticker outline — works on light and dark). */
export const LOGO_URL = `${import.meta.env.BASE_URL}logo.webp`;

export function Logo({ size, className = '' }: { size: number; className?: string }) {
  return <img className={`logo ${className}`} src={LOGO_URL} width={size} height={size} alt="শ্রুতি" decoding="async" />;
}
