import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import configJson from '../../firebase-applet-config.json';
import { safeStorage } from './safeStorage';

const app = getApps().length === 0 ? initializeApp(configJson) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let firestoreDb: any = null;
try {
  firestoreDb = getFirestore(app);
} catch (e) {
  console.warn('[Firebase] Firestore init warning:', e);
}

export const db = firestoreDb;

export async function signInWithGoogle(): Promise<{ user?: FirebaseUser; error?: string }> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user };
  } catch (err: any) {
    console.warn('[Firebase Auth] signInWithPopup error or popup closed:', err.message);
    return { error: err.message };
  }
}

export async function logOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('[Firebase Auth] signOut error:', err);
  }
}

export interface UserConnectionConfig {
  session?: string;
  isDemo?: boolean;
  endpoint?: string;
  poUid?: string;
  accountUid?: string;
  status?: string;
  [key: string]: any;
}

export async function saveUserConnectionConfig(
  uid: string,
  config: UserConnectionConfig
): Promise<void> {
  if (!uid) return;
  // Always persist locally
  safeStorage.setLocalItem(`po_config_${uid}`, JSON.stringify(config));
  if (!firestoreDb) return;
  try {
    const ref = doc(firestoreDb, 'user_configs', uid);
    await setDoc(
      ref,
      {
        ...config,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firebase] saveUserConnectionConfig fallback to local:', err);
  }
}

export async function getUserConnectionConfig(
  uid: string
): Promise<UserConnectionConfig | null> {
  if (!uid) return null;
  // Try local first
  const local = safeStorage.getLocalItem(`po_config_${uid}`);
  if (local) {
    try {
      return JSON.parse(local);
    } catch {}
  }
  if (!firestoreDb) return null;
  try {
    const ref = doc(firestoreDb, 'user_configs', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as any;
    }
  } catch (err) {
    console.warn('[Firebase] getUserConnectionConfig error:', err);
  }
  return null;
}

export async function saveTradeOrderToFirestore(uid: string, order: any): Promise<void> {
  if (!uid || !firestoreDb) return;
  try {
    const orderId = order.id || `order_${Date.now()}`;
    const ref = doc(firestoreDb, 'users', uid, 'orders', orderId);
    await setDoc(ref, {
      ...order,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[Firebase] saveTradeOrder error:', err);
  }
}
