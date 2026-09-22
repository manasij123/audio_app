/**
 * The Shruti rhyme, shown under the logo on the login screen. Each couplet ends on
 * one of the five words painted on the logo, which are picked out in the brand red.
 */
const COUPLETS: [string, string, string][] = [
  ['ভূতের গল্প, প্রেতের গল্প, আসবে সবাই খুললে দ্বার,', 'এসব শুনে জমবে এবার, করে চারিদিক ', 'অন্ধকার'],
  ['রাতের নীরব পথে জাগে প্রশ্ন সহস্র,', 'উত্তর খুঁজতে গিয়ে খুলে যায় নতুন ', 'রহস্য'],
  ['গল্পের মাঝে লুকিয়ে থাকে অজানা কত গুণ,', 'শুনতে শুনতে হঠাৎ সামনে এসে দাঁড়ায় ', 'খুন'],
  ['সূত্র মেলাও, ছায়া ধরো, মনটা রাখো শক্ত,', 'খুনির ফেলে যাওয়া চিহ্নে, লেগে আছে ', 'রক্ত'],
  ['উঠবে জেগে নরকের কীট, ফুঁড়ে দিয়ে পাতাল,', 'সামনে পড়লে সাড় থাকে না, শিরদাঁড়া ', 'হিমশীতল'],
];

export function Verse() {
  return (
    <div className="verse" lang="bn">
      {COUPLETS.map(([first, second, word]) => (
        <p key={word}>
          {first}
          <br />
          {second}
          <em>{word}</em>।
        </p>
      ))}
    </div>
  );
}
