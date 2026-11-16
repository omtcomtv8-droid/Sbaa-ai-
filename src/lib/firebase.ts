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
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import configJson from '../../firebase-applet-config.json';
import { safeStorage } from './safeStorage';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const app = getApps().length === 0 ? initializeApp(configJson) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

let firestoreDb: Firestore | null = null;
try {
  const dbId =
    configJson.firestoreDatabaseId && configJson.firestoreDatabaseId !== '(default)'
      ? configJson.firestoreDatabaseId
      : undefined;
  firestoreDb = dbId ? getFirestore(app, dbId) : getFirestore(app);
} catch (e) {
  console.warn('[Firebase] Firestore init warning:', e);
}

export const db = firestoreDb;

export async function testConnection(): Promise<void> {
  if (!firestoreDb) return;
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
    }
  }
}

if (typeof window !== 'undefined') {
  void testConnection();
}

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
  const path = `users/${uid}/connections/pocket_option`;
  try {
    const ref = doc(firestoreDb, 'users', uid, 'connections', 'pocket_option');
    await setDoc(
      ref,
      {
        userId: uid,
        endpoint: String(
          config.endpoint || 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket'
        ),
        isDemo: false,
        accountUid: String(config.accountUid || ''),
        status: String(config.status || 'connected'),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
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
  const path = `users/${uid}/connections/pocket_option`;
  try {
    const ref = doc(firestoreDb, 'users', uid, 'connections', 'pocket_option');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserConnectionConfig;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
  return null;
}

export async function saveTradeOrderToFirestore(uid: string, order: any): Promise<void> {
  if (!uid || !firestoreDb) return;
  const orderId = String(order.id || order.orderId || `order_${Date.now()}`);
  const path = `users/${uid}/orders/${orderId}`;
  try {
    const ref = doc(firestoreDb, 'users', uid, 'orders', orderId);
    const cleanPayload: Record<string, any> = {
      orderId,
      userId: uid,
      symbol: String(order.symbol || order.asset || 'EURUSD_otc'),
      direction: String(order.direction || (order.action === 'put' ? 'SELL' : 'BUY')),
      amount: Number(order.amount || 1),
      status: String(order.status || 'EXECUTED'),
      timestamp: String(order.timestamp || new Date().toISOString()),
    };
    if (order.entryPrice !== undefined) cleanPayload.entryPrice = Number(order.entryPrice);
    if (order.timeframe !== undefined) cleanPayload.timeframe = Number(order.timeframe);
    await setDoc(ref, cleanPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
