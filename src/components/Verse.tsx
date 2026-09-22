/**
 * Login artwork: the Shruti logo surrounded by the five couplets of the Shruti
 * rhyme, each in its own illustrated cloud. The rhyme is repeated as alt text so
 * screen readers get the words the picture shows.
 */
export const LOGIN_ART_URL = `${import.meta.env.BASE_URL}login-art.webp`;

const RHYME = [
  'ভূতের গল্প, প্রেতের গল্প, আসবে সবাই খুললে দ্বার, এসব শুনে জমবে এবার, করে চারিদিক অন্ধকার।',
  'রাতের নীরব পথে জাগে প্রশ্ন সহস্র, উত্তর খুঁজতে গিয়ে খুলে যায় নতুন রহস্য।',
  'গল্পের মাঝে লুকিয়ে থাকে অজানা কত গুণ, শুনতে শুনতে হঠাৎ সামনে এসে দাঁড়ায় খুন।',
  'সূত্র মেলাও, ছায়া ধরো, মনটা রাখো শক্ত, খুনির ফেলে যাওয়া চিহ্নে, লেগে আছে রক্ত।',
  'উঠবে জেগে নরকের কীট, ফুঁড়ে দিয়ে পাতাল, সামনে পড়লে সাড় থাকে না, শিরদাঁড়া হিমশীতল।',
].join(' ');

export function LoginArt() {
  return <img className="login-art" src={LOGIN_ART_URL} width={1000} height={1000} alt={`শ্রুতি — ${RHYME}`} decoding="async" fetchPriority="high" />;
}
