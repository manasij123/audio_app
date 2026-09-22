import { useMemo } from 'react';
import { Cover } from '../components/Cover';
import { ImportButtons, ImportProgressBar } from '../components/ImportButtons';
import { PlayIcon } from '../components/Icons';
import { Logo } from '../components/Logo';
import { StatusLabel } from '../components/TrackRow';
import { dayKey } from '../hooks/useLibrary';
import { formatDuration, formatTime } from '../lib/format';
import { useShell } from '../shellContext';

const DAY_NAMES = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

function greeting(h: number) {
  if (h < 5) return 'শুভ রাত্রি';
  if (h < 12) return 'সুপ্রভাত';
  if (h < 17) return 'শুভ দুপুর';
  if (h < 21) return 'শুভ সন্ধ্যা';
  return 'শুভ রাত্রি';
}

export function HomeView() {
  const { lib, profile, play, openMenu, sorted, currentId } = useShell();
  const { tracks, coverUrls, stats } = lib;

  const continueList = useMemo(
    () =>
      tracks
        .filter((t) => !t.finished && t.position > 0)
        .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))
        .slice(0, 12),
    [tracks],
  );
  const recent = useMemo(() => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5), [tracks]);
  const nextUp = useMemo(() => sorted.find((t) => !t.finished && t.position === 0 && t.id !== currentId), [sorted, currentId]);

  const week = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const s = stats.get(dayKey(d));
      days.push({ key: dayKey(d), label: DAY_NAMES[d.getDay()], minutes: (s?.seconds ?? 0) / 60, today: i === 0 });
    }
    return days;
  }, [stats]);
  const today = week[6].minutes;
  const weekTotal = week.reduce((s, d) => s + d.minutes, 0);
  const maxMinutes = Math.max(30, ...week.map((d) => d.minutes));
  const streak = useMemo(() => {
    let n = 0;
    const d = new Date();
    if ((stats.get(dayKey(d))?.seconds ?? 0) < 60) d.setDate(d.getDate() - 1); // today not started yet doesn't break it
    while ((stats.get(dayKey(d))?.seconds ?? 0) >= 60) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }, [stats]);
  const allTime = useMemo(() => [...stats.values()].reduce((s, d) => s + d.seconds, 0), [stats]);
  const finishedCount = tracks.filter((t) => t.finished).length;

  if (lib.loaded && tracks.length === 0) {
    return (
      <div className="view home">
        <header className="view-head home-head">
          <div>
            <p className="eyebrow">{greeting(new Date().getHours())},</p>
            <h1>{profile.name}</h1>
          </div>
        </header>
        <section className="welcome">
          <Logo size={180} />
          <div className="waveform" aria-hidden>
            {Array.from({ length: 21 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${-((i * 137) % 900)}ms` }} />
            ))}
          </div>
          <h2>আপনার লাইব্রেরি এখনও খালি</h2>
          <p>
            যে ফোল্ডারে সানডে সাসপেন্স, ফেলুদা বা অন্য গল্পের MP3 আছে সেটা বেছে নিন। ফাইলগুলো এই ব্রাউজারের নিজস্ব স্টোরেজে কপি হবে, তাই পরের বার
            থেকে নেট ছাড়াই সরাসরি এখানে পাবেন। কিছুই কোথাও আপলোড হয় না।
          </p>
          <ImportButtons />
          <ImportProgressBar />
          <p className="hint">ফোন যদি ফোল্ডার বাছতে না দেয়, “ফাইল যোগ” চেপে ফোল্ডারের সব ফাইল একসাথে সিলেক্ট করুন।</p>
        </section>
      </div>
    );
  }

  return (
    <div className="view home">
      <header className="view-head home-head">
        <div>
          <p className="eyebrow">{greeting(new Date().getHours())},</p>
          <h1>{profile.name}</h1>
        </div>
        <Logo size={64} />
      </header>
      <ImportProgressBar />

      {continueList.length > 0 && (
        <section className="section">
          <h2 className="section-title">যেখানে থেমেছিলেন · Continue</h2>
          <div className="carousel">
            {continueList.map((t) => {
              const pct = t.duration ? (t.position / t.duration) * 100 : 0;
              return (
                <button key={t.id} type="button" className="resume-card" onClick={() => play(t.id)} onContextMenu={(e) => (e.preventDefault(), openMenu(t.id))}>
                  <span className="resume-art">
                    <Cover url={coverUrls.get(t.id)} title={t.title} size="lg" />
                    <span className="resume-play" aria-hidden>
                      <PlayIcon />
                    </span>
                  </span>
                  <span className="resume-title">{t.title}</span>
                  <span className="resume-bar" aria-hidden>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <span className="resume-meta">{t.duration ? `${formatDuration(t.duration - t.position)} বাকি` : formatTime(t.position)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {nextUp && continueList.length === 0 && (
        <section className="section">
          <h2 className="section-title">শুরু করুন · Start listening</h2>
          <button type="button" className="feature-card" onClick={() => play(nextUp.id)}>
            <Cover url={coverUrls.get(nextUp.id)} title={nextUp.title} size="md" />
            <span>
              <strong>{nextUp.title}</strong>
              <small>{[nextUp.trackNo != null ? `পর্ব ${nextUp.trackNo}` : null, formatTime(nextUp.duration)].filter(Boolean).join(' · ')}</small>
            </span>
            <span className="feature-play" aria-hidden>
              <PlayIcon />
            </span>
          </button>
        </section>
      )}

      <section className="section">
        <h2 className="section-title">শোনার হিসাব · Listening</h2>
        <div className="stats-card">
          <div className="stat-row">
            <div className="stat">
              <strong>{formatDuration(today * 60)}</strong>
              <span>আজ</span>
            </div>
            <div className="stat">
              <strong>{formatDuration(weekTotal * 60)}</strong>
              <span>এই সপ্তাহ</span>
            </div>
            <div className="stat">
              <strong>{streak}</strong>
              <span>দিনের ধারা</span>
            </div>
            <div className="stat">
              <strong>{finishedCount}</strong>
              <span>পর্ব শেষ</span>
            </div>
          </div>
          <div className="week-chart" role="img" aria-label={`Minutes listened in the last 7 days: ${week.map((d) => `${d.label} ${Math.round(d.minutes)}`).join(', ')}`}>
            {week.map((d) => (
              <div key={d.key} className={`week-col${d.today ? ' today' : ''}`} title={`${d.label}: ${Math.round(d.minutes)} min`}>
                <div className="week-bar-wrap">
                  {d.today && d.minutes >= 1 && <span className="week-val">{Math.round(d.minutes)}m</span>}
                  <div className="week-bar" style={{ height: `${Math.max(d.minutes > 0 ? 4 : 0, (d.minutes / maxMinutes) * 100)}%` }} />
                </div>
                <span className="week-day">{d.label}</span>
              </div>
            ))}
          </div>
          {weekTotal < 1 && <p className="chart-empty">এই সপ্তাহে এখনও শোনা হয়নি — একটা গল্প চালু করুন, এখানে হিসাব জমা হবে।</p>}
          <p className="stats-foot">মোট শোনা হয়েছে {formatDuration(allTime)} · All-time listening</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">নতুন যোগ হয়েছে · Recently added</h2>
          <ImportButtons compact />
        </div>
        <ul className="mini-list">
          {recent.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => play(t.id)}>
                <Cover url={coverUrls.get(t.id)} title={t.title} size="xs" />
                <span className="ml-title">{t.title}</span>
                <StatusLabel track={t} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
