// Security-rules test against the Firebase emulators.
// Run: npx firebase emulators:exec --only auth,firestore,storage --project demo-shruti "node test/rules.test.mjs"
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { connectStorageEmulator, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const PROJECT = 'demo-shruti';
const HOST = '127.0.0.1';
let passed = 0;
let failed = 0;

async function reset() {
  await fetch(`http://${HOST}:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${HOST}:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

let n = 0;
function client() {
  const app = initializeApp({ apiKey: 'demo-key', projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com`, appId: 'demo' }, `c${n++}`);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, HOST, 9199);
  return { app, auth, db, storage };
}

async function expectOk(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok  ', name);
  } catch (e) {
    failed++;
    console.log('  FAIL', name, '→', e.code || e.message);
  }
}
async function expectDenied(name, fn) {
  try {
    await fn();
    failed++;
    console.log('  FAIL', name, '→ was allowed');
  } catch (e) {
    const code = e.code || '';
    if (/permission-denied|unauthorized|storage\/unauthorized/.test(code)) {
      passed++;
      console.log('  ok  ', name, `(denied)`);
    } else {
      failed++;
      console.log('  FAIL', name, '→ unexpected', code || e.message);
    }
  }
}

await reset();
const anon = client();
const a = client(); // will be the owner
const b = client(); // a listener
const { user: ua } = await createUserWithEmailAndPassword(a.auth, 'owner@test.dev', 'secret123');
const { user: ub } = await createUserWithEmailAndPassword(b.auth, 'listener@test.dev', 'secret123');

console.log('profiles');
await expectOk('user creates own profile', () => setDoc(doc(a.db, 'users', ua.uid), { name: 'Owner', email: 'owner@test.dev', photoURL: null, createdAt: 1, lastSeen: 1 }));
await expectOk('listener creates own profile', () => setDoc(doc(b.db, 'users', ub.uid), { name: 'Listener', email: 'listener@test.dev', photoURL: null, createdAt: 1, lastSeen: 1 }));
await expectDenied('profile with extra fields', () => setDoc(doc(b.db, 'users', ub.uid), { name: 'x', role: 'admin' }, { merge: true }));
await expectDenied('write someone else’s profile', () => setDoc(doc(b.db, 'users', ua.uid), { name: 'hacked' }));

console.log('ownership');
const claim = (c, uid, email) => {
  const batch = writeBatch(c.db);
  batch.set(doc(c.db, 'config', 'owner'), { uid, email, claimedAt: 1 });
  batch.set(doc(c.db, 'admins', uid), { email, name: email, addedAt: 1, addedBy: uid });
  return batch.commit();
};
await expectDenied('claim admin without owner doc', () => setDoc(doc(b.db, 'admins', ub.uid), { email: 'x' }));
await expectOk('first user claims ownership', () => claim(a, ua.uid, 'owner@test.dev'));
await expectDenied('second user cannot claim', () => claim(b, ub.uid, 'listener@test.dev'));
await expectDenied('listener makes self admin', () => setDoc(doc(b.db, 'admins', ub.uid), { email: 'x' }));

console.log('catalogue');
await expectOk('admin adds published story', () => setDoc(doc(a.db, 'tracks', 't1'), { title: 'Pub', published: true }));
await expectOk('admin adds draft story', () => setDoc(doc(a.db, 'tracks', 't2'), { title: 'Draft', published: false }));
await expectDenied('listener adds a story', () => setDoc(doc(b.db, 'tracks', 't3'), { title: 'x', published: true }));
await expectDenied('listener edits a story', () => setDoc(doc(b.db, 'tracks', 't1'), { title: 'x', published: true }));
await expectOk('listener reads published stories', async () => {
  const s = await getDocs(query(collection(b.db, 'tracks'), where('published', '==', true)));
  if (s.size !== 1) throw new Error(`expected 1, got ${s.size}`);
});
await expectDenied('listener reads a draft', () => getDoc(doc(b.db, 'tracks', 't2')));
await expectDenied('listener lists every story', () => getDocs(collection(b.db, 'tracks')));
await expectDenied('signed-out visitor reads stories', () => getDocs(query(collection(anon.db, 'tracks'), where('published', '==', true))));
await expectOk('admin lists every story', async () => {
  const s = await getDocs(collection(a.db, 'tracks'));
  if (s.size !== 2) throw new Error(`expected 2, got ${s.size}`);
});

console.log('listening data');
await expectOk('listener writes own progress', () => setDoc(doc(b.db, 'listening', ub.uid), { version: 1, progress: {}, bookmarks: {}, updatedAt: 1 }));
await expectDenied('listener reads someone else’s progress', () => getDoc(doc(b.db, 'listening', ua.uid)));
await expectDenied('admin reads a listener’s progress', () => getDoc(doc(a.db, 'listening', ub.uid)));

console.log('admins');
await expectDenied('listener lists admins', () => getDocs(collection(b.db, 'admins')));
await expectOk('admin promotes listener', () => setDoc(doc(a.db, 'admins', ub.uid), { email: 'listener@test.dev', addedBy: ua.uid }));
await expectOk('new admin adds a story', () => setDoc(doc(b.db, 'tracks', 't4'), { title: 'By B', published: true }));
await expectDenied('admin cannot remove the owner', () => deleteDoc(doc(b.db, 'admins', ua.uid)));
await expectOk('owner removes the other admin', () => deleteDoc(doc(a.db, 'admins', ub.uid)));
await expectDenied('demoted user edits stories again', () => setDoc(doc(b.db, 'tracks', 't1'), { title: 'x', published: true }));
await expectDenied('owner doc cannot be changed', () => setDoc(doc(a.db, 'config', 'owner'), { uid: ub.uid }));

console.log('storage');
const mp3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 0, 0, 0]);
await expectOk('admin uploads audio', () => uploadBytes(ref(a.storage, 'audio/t1/a.mp3'), mp3, { contentType: 'audio/mpeg' }));
await expectDenied('admin uploads non-audio into audio/', () => uploadBytes(ref(a.storage, 'audio/t1/x.txt'), mp3, { contentType: 'text/plain' }));
await expectDenied('listener uploads audio', () => uploadBytes(ref(b.storage, 'audio/t9/b.mp3'), mp3, { contentType: 'audio/mpeg' }));
await expectOk('listener gets a stream URL', () => getDownloadURL(ref(b.storage, 'audio/t1/a.mp3')));
await signOut(anon.auth);
await expectDenied('signed-out visitor gets a stream URL', () => getDownloadURL(ref(anon.storage, 'audio/t1/a.mp3')));

await Promise.all([anon, a, b].map((c) => deleteApp(c.app)));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
