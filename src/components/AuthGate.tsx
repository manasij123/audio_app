import type { User } from 'firebase/auth';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { getOwner, isAdmin as checkAdmin, touchUser, type AppUser } from '../lib/catalog';
import { describeAuthError, firebase, logOut, onUser, resetPassword, saveFirebaseConfig, signInEmail, signInGoogle, signUpEmail } from '../lib/firebase';
import { GoogleIcon } from './Icons';
import { LoginArt } from './Verse';

export interface Account {
  user: AppUser;
  isAdmin: boolean;
  isOwner: boolean;
  /** False until someone has claimed the installation. */
  ownerExists: boolean;
  refreshRole(): Promise<void>;
  signOut(): Promise<void>;
}

const toAppUser = (u: User): AppUser => ({
  uid: u.uid,
  name: u.displayName || u.email?.split('@')[0] || 'শ্রোতা',
  email: u.email ? u.email.toLowerCase() : null,
  photoURL: u.photoURL,
});

/** Login is required: renders the login screen until a listener is signed in, then `children`. */
export function AuthGate({ children }: { children: (account: Account) => ReactNode }) {
  const configured = firebase() != null;
  const [user, setUser] = useState<AppUser | null | undefined>(undefined);
  const [role, setRole] = useState<{ isAdmin: boolean; ownerUid: string | null } | null>(null);

  useEffect(() => {
    if (!configured) return;
    return onUser((u) => {
      setRole(null);
      setUser(u ? toAppUser(u) : null);
    });
  }, [configured]);

  const refreshRole = useCallback(async () => {
    if (!user) return;
    const [admin, owner] = await Promise.all([checkAdmin(user.uid), getOwner()]);
    setRole({ isAdmin: admin, ownerUid: owner?.uid ?? null });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    touchUser(user).catch((e) => console.warn('[shruti] profile', e));
    void refreshRole();
  }, [user, refreshRole]);

  if (!configured) return <SetupScreen />;
  if (user === undefined || (user && !role)) return <div className="gate" aria-busy="true" />;
  if (!user) return <LoginScreen />;

  return (
    <>
      {children({
        user,
        isAdmin: role!.isAdmin,
        isOwner: role!.ownerUid === user.uid,
        ownerExists: role!.ownerUid != null,
        refreshRole,
        signOut: async () => {
          await logOut();
        },
      })}
    </>
  );
}

function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok?: boolean } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'login') await signInEmail(email, password);
      else if (mode === 'signup') await signUpEmail(name, email, password);
      else {
        await resetPassword(email);
        setMessage({ text: 'পাসওয়ার্ড বদলানোর লিঙ্ক ইমেলে পাঠানো হয়েছে · Check your email for a reset link.', ok: true });
        setMode('login');
      }
    } catch (err) {
      setMessage({ text: describeAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signInGoogle();
    } catch (err) {
      setMessage({ text: describeAuthError(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-brand">
        <LoginArt />
      </div>
      <form className="gate-card login-card" onSubmit={submit}>
        <h1>{mode === 'signup' ? 'নতুন অ্যাকাউন্ট' : mode === 'reset' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'স্বাগতম'}</h1>
        <p className="gate-sub">
          {mode === 'reset' ? 'আপনার ইমেল দিন, পাসওয়ার্ড বদলানোর লিঙ্ক পাঠাব।' : 'গল্প শুনতে লগইন করুন। আপনার প্রিয়, অগ্রগতি আর বুকমার্ক যেকোনো ডিভাইসে পাবেন।'}
        </p>

        {mode !== 'reset' && (
          <div className="segmented wide" role="tablist" aria-label="Login or sign up">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
              লগইন
            </button>
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>
              নতুন অ্যাকাউন্ট
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <label className="field">
            <span>নাম · Name</span>
            <input id="signup-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={60} required />
          </label>
        )}
        <label className="field">
          <span>ইমেল · Email</span>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        {mode !== 'reset' && (
          <label className="field">
            <span>পাসওয়ার্ড · Password</span>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>
        )}

        {message && <p className={message.ok ? 'gate-ok' : 'gate-notice'}>{message.text}</p>}

        <button type="submit" className="btn primary wide" disabled={busy}>
          {busy ? 'অপেক্ষা করুন…' : mode === 'signup' ? 'অ্যাকাউন্ট খুলুন' : mode === 'reset' ? 'লিঙ্ক পাঠান' : 'লগইন করুন'}
        </button>

        {mode === 'login' && (
          <button type="button" className="btn ghost" onClick={() => setMode('reset')}>
            পাসওয়ার্ড ভুলে গেছেন?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className="btn ghost" onClick={() => setMode('login')}>
            ফিরে যান
          </button>
        )}

        {mode !== 'reset' && (
          <>
            <div className="or-line">
              <span>অথবা</span>
            </div>
            <button type="button" className="btn google wide" onClick={google} disabled={busy}>
              <GoogleIcon /> Google দিয়ে চালিয়ে যান
            </button>
          </>
        )}
      </form>
    </div>
  );
}

/** Shown only before the app has a Firebase project (first-time setup by the owner). */
function SetupScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="gate">
      <div className="gate-brand">
        <LoginArt />
      </div>
      <form
        className="gate-card"
        onSubmit={(e) => {
          e.preventDefault();
          const err = saveFirebaseConfig(text);
          setError(err);
          if (!err) location.reload();
        }}
      >
        <h1>সেটআপ</h1>
        <p className="gate-sub">শ্রুতি এখনও কোনো সার্ভারের সাথে যুক্ত নয়। Firebase console → Project settings → Your apps থেকে firebaseConfig এখানে পেস্ট করুন (README-তে ধাপগুলো আছে)।</p>
        <label className="field">
          <span>firebaseConfig</span>
          <textarea id="setup-config" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'{ apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", appId: "…" }'} spellCheck={false} />
        </label>
        {error && <p className="gate-notice">{error}</p>}
        <button type="submit" className="btn primary wide">
          সেভ করে চালু করুন
        </button>
      </form>
    </div>
  );
}
