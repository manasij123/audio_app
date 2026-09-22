import { useEffect, useState } from 'react';
import { Logo } from './Logo';

/**
 * The Shruti rhyme around the logo. Each couplet ends on one of the five words
 * painted on the logo and floats beside that word: খুন and অন্ধকার to the left,
 * রহস্য above-right, রক্ত and হিমশীতল to the right. On narrow screens there is no
 * room beside the logo, so the couplets float in one at a time beneath it.
 */
type Spot = 'khun' | 'andhakar' | 'rahasya' | 'rakta' | 'himsheetal';
const COUPLETS: { spot: Spot; first: string; second: string; word: string }[] = [
  { spot: 'andhakar', first: 'ভূতের গল্প, প্রেতের গল্প, আসবে সবাই খুললে দ্বার,', second: 'এসব শুনে জমবে এবার, করে চারিদিক ', word: 'অন্ধকার' },
  { spot: 'rahasya', first: 'রাতের নীরব পথে জাগে প্রশ্ন সহস্র,', second: 'উত্তর খুঁজতে গিয়ে খুলে যায় নতুন ', word: 'রহস্য' },
  { spot: 'khun', first: 'গল্পের মাঝে লুকিয়ে থাকে অজানা কত গুণ,', second: 'শুনতে শুনতে হঠাৎ সামনে এসে দাঁড়ায় ', word: 'খুন' },
  { spot: 'rakta', first: 'সূত্র মেলাও, ছায়া ধরো, মনটা রাখো শক্ত,', second: 'খুনির ফেলে যাওয়া চিহ্নে, লেগে আছে ', word: 'রক্ত' },
  { spot: 'himsheetal', first: 'উঠবে জেগে নরকের কীট, ফুঁড়ে দিয়ে পাতাল,', second: 'সামনে পড়লে সাড় থাকে না, শিরদাঁড়া ', word: 'হিমশীতল' },
];

const CYCLE_MS = 5000;

function Couplet({ c }: { c: (typeof COUPLETS)[number] }) {
  return (
    <>
      {c.first}
      <br />
      {c.second}
      <em>{c.word}</em>।
    </>
  );
}

export function LogoWithVerse() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % COUPLETS.length), CYCLE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="verse-stage" lang="bn">
      <Logo size={300} className="gate-logo" />
      {/* Wide screens: every couplet floats beside its word. Narrow screens keep it for screen readers only. */}
      <div className="verse-float">
        {COUPLETS.map((c) => (
          <p key={c.spot} className={`vf vf-${c.spot}`}>
            <Couplet c={c} />
          </p>
        ))}
      </div>
      {/* Narrow screens: one couplet at a time under the logo. */}
      <p className="verse-cycle" aria-hidden key={i}>
        <Couplet c={COUPLETS[i]} />
      </p>
    </div>
  );
}
