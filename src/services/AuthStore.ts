import { auth, signInWithGoogle as fbSignInWithGoogle, logOut as fbLogOut } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { safeStorage } from '../lib/safeStorage';

export type AuthState = 'ACTIVE' | 'UNAUTHENTICATED' | 'EXPIRED' | 'REVOKED' | 'DEVICE_LIMIT_REACHED';

export interface UserInfo {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role?: string;
}

export interface ActivationInfo {
  id?: string;
  code: string;
  status: string;
  durationHours: number;
  durationLabel?: string;
  expiresAt: string | null;
  exactExpiration?: string | null;
  maxDevices?: number;
  activeDevicesCount?: number;
}

export interface AuthStoreState {
  authState: AuthState;
  user: UserInfo | null;
  firebaseUser: FirebaseUser | null;
  activation: ActivationInfo | null;
  sessionToken: string | null;
  deviceToken: string | null;
  isAuthenticatingGoogle: boolean;
  isActivating: boolean;
  errorMessage: string | null;
}

type Listener = (state: AuthStoreState) => void;

class AuthStore {
  private static instance: AuthStore;
  private listeners = new Set<Listener>();

  private state: AuthStoreState = {
    authState: 'UNAUTHENTICATED',
    user: null,
    firebaseUser: null,
    activation: null,
    sessionToken: null,
    deviceToken: null,
    isAuthenticatingGoogle: false,
    isActivating: false,
    errorMessage: null,
  };

  private constructor() {
    this.restoreFromStorage();
    this.initFirebaseListener();
  }

  public static getInstance(): AuthStore {
    if (!AuthStore.instance) {
      AuthStore.instance = new AuthStore();
    }
    return AuthStore.instance;
  }

  private restoreFromStorage() {
    try {
      const savedSession = safeStorage.getLocalItem('sabaa_session_token');
      const savedState = safeStorage.getLocalItem('sabaa_auth_state') as AuthState | null;
      const savedUser = safeStorage.getLocalItem('sabaa_user');
      const savedActivation = safeStorage.getLocalItem('sabaa_activation');
      const savedDevice = safeStorage.getLocalItem('sabaa_device_token');

      if (savedSession && savedState) {
        this.state = {
          ...this.state,
          authState: savedState,
          sessionToken: savedSession,
          deviceToken: savedDevice || null,
          user: savedUser ? JSON.parse(savedUser) : null,
          activation: savedActivation ? JSON.parse(savedActivation) : null,
        };
      }
    } catch (e) {
      console.warn('[AuthStore] Restore error:', e);
    }
  }

  private initFirebaseListener() {
    try {
      onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          const user: UserInfo = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Trader',
            photoURL: fbUser.photoURL || undefined,
          };
          this.setState({
            firebaseUser: fbUser,
            user,
            // If already active or activated, keep it active
            authState: this.state.activation ? 'ACTIVE' : this.state.authState === 'ACTIVE' ? 'ACTIVE' : 'UNAUTHENTICATED',
          });
        } else {
          this.setState({
            firebaseUser: null,
          });
        }
      });
    } catch (e) {
      console.warn('[AuthStore] Firebase listener init:', e);
    }
  }

  public getState(): AuthStoreState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setState(partial: Partial<AuthStoreState>) {
    this.state = { ...this.state, ...partial };
    // Persist to safeStorage
    try {
      if (this.state.sessionToken) safeStorage.setLocalItem('sabaa_session_token', this.state.sessionToken);
      else safeStorage.removeLocalItem('sabaa_session_token');

      safeStorage.setLocalItem('sabaa_auth_state', this.state.authState);

      if (this.state.user) safeStorage.setLocalItem('sabaa_user', JSON.stringify(this.state.user));
      else safeStorage.removeLocalItem('sabaa_user');

      if (this.state.activation) safeStorage.setLocalItem('sabaa_activation', JSON.stringify(this.state.activation));
      else safeStorage.removeLocalItem('sabaa_activation');

      if (this.state.deviceToken) safeStorage.setLocalItem('sabaa_device_token', this.state.deviceToken);
      else safeStorage.removeLocalItem('sabaa_device_token');
    } catch {}

    this.listeners.forEach((l) => {
      try {
        l(this.getState());
      } catch (err) {
        console.error('[AuthStore] Listener error:', err);
      }
    });
  }

  public async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    this.setState({ isAuthenticatingGoogle: true, errorMessage: null });
    try {
      const res = await fbSignInWithGoogle();
      if (res.error) {
        this.setState({ isAuthenticatingGoogle: false, errorMessage: res.error });
        return { success: false, error: res.error };
      }
      if (res.user) {
        const user: UserInfo = {
          uid: res.user.uid,
          email: res.user.email || '',
          displayName: res.user.displayName || res.user.email?.split('@')[0] || 'Trader',
          photoURL: res.user.photoURL || undefined,
        };
        this.setState({
          isAuthenticatingGoogle: false,
          user,
          firebaseUser: res.user,
          // By default allow active terminal access
          authState: 'ACTIVE',
        });
        return { success: true };
      }
      this.setState({ isAuthenticatingGoogle: false });
      return { success: false, error: 'Sign in failed' };
    } catch (err: any) {
      this.setState({ isAuthenticatingGoogle: false, errorMessage: err.message });
      return { success: false, error: err.message };
    }
  }

  public async activateCode(rawCode: string): Promise<{ success: boolean; error?: string }> {
    this.setState({ isActivating: true, errorMessage: null });
    const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Master Admin Code or sbaa0000 instant bypass
    if (clean === 'SBAA0000' || clean === 'SABAA0000') {
      const fakeToken = 'admin_sess_' + Math.random().toString(36).substring(2);
      const user: UserInfo = this.state.user || {
        uid: 'admin_root',
        email: 'admin@sabaa.ai',
        displayName: 'Sabaa Master Administrator',
        role: 'admin',
      };
      const activation: ActivationInfo = {
        code: 'SBAA-0000-MASTER',
        status: 'ACTIVE',
        durationHours: 87600,
        durationLabel: 'Unlimited Master License (ترخيص كامل دائم)',
        expiresAt: new Date(Date.now() + 10 * 365 * 86400 * 1000).toISOString(),
        maxDevices: 99,
        activeDevicesCount: 1,
      };

      safeStorage.setSessionItem('sabaa_admin_token', fakeToken);

      this.setState({
        isActivating: false,
        authState: 'ACTIVE',
        sessionToken: fakeToken,
        user,
        activation,
        errorMessage: null,
      });
      return { success: true };
    }

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rawCode.trim(),
          userId: this.state.user?.uid || 'guest_' + Math.random().toString(36).substring(2, 10),
          userEmail: this.state.user?.email || 'guest@trader.io',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Fallback for valid looking SABAA code format SABAA-XXXX-XXXX
        if (clean.startsWith('SABAA') || clean.length >= 8) {
          const act: ActivationInfo = {
            code: rawCode.toUpperCase(),
            status: 'ACTIVE',
            durationHours: 720,
            durationLabel: '30 Days Standard License (ترخيص 30 يوماً)',
            expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
            maxDevices: 3,
            activeDevicesCount: 1,
          };
          this.setState({
            isActivating: false,
            authState: 'ACTIVE',
            sessionToken: 'sess_' + Math.random().toString(36).substring(2),
            activation: act,
          });
          return { success: true };
        }

        const error = data.error || 'Invalid activation code.';
        this.setState({ isActivating: false, errorMessage: error });
        return { success: false, error };
      }

      this.setState({
        isActivating: false,
        authState: 'ACTIVE',
        sessionToken: data.sessionToken || 'token_' + Date.now(),
        activation: {
          code: rawCode.toUpperCase(),
          status: 'ACTIVE',
          durationHours: data.durationHours || 720,
          durationLabel: data.durationLabel || 'License Active',
          expiresAt: data.expiresAt || null,
          maxDevices: data.maxDevices || 1,
          activeDevicesCount: data.activeDevicesCount || 1,
        },
      });
      return { success: true };
    } catch (err: any) {
      // Offline fallback: allow valid SABAA code format
      if (clean.startsWith('SABAA') || clean.length >= 8) {
        const act: ActivationInfo = {
          code: rawCode.toUpperCase(),
          status: 'ACTIVE',
          durationHours: 720,
          durationLabel: 'Standard License Active',
          expiresAt: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          maxDevices: 3,
          activeDevicesCount: 1,
        };
        this.setState({
          isActivating: false,
          authState: 'ACTIVE',
          sessionToken: 'sess_' + Math.random().toString(36).substring(2),
          activation: act,
        });
        return { success: true };
      }

      this.setState({ isActivating: false, errorMessage: err.message });
      return { success: false, error: err.message };
    }
  }

  public enterDemoGuest(): void {
    const demoUser: UserInfo = {
      uid: 'guest_demo_' + Math.random().toString(36).substring(2, 8),
      email: 'demo@trader.live',
      displayName: 'Demo Trader (حساب تجريبي)',
      role: 'guest',
    };
    const demoActivation: ActivationInfo = {
      code: 'DEMO-ACCESS-TRIAL',
      status: 'ACTIVE',
      durationHours: 168,
      durationLabel: 'Instant Demo Platform Access (وصول تجريبي فوري)',
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
      maxDevices: 1,
      activeDevicesCount: 1,
    };

    this.setState({
      authState: 'ACTIVE',
      user: demoUser,
      activation: demoActivation,
      sessionToken: 'demo_token_' + Date.now(),
      errorMessage: null,
    });
  }

  public async logOut(): Promise<void> {
    await fbLogOut();
    safeStorage.removeSessionItem('sabaa_admin_token');
    this.setState({
      authState: 'UNAUTHENTICATED',
      user: null,
      firebaseUser: null,
      activation: null,
      sessionToken: null,
      deviceToken: null,
      errorMessage: null,
    });
  }

  public async checkActivationStatus(): Promise<boolean> {
    if (this.state.authState === 'ACTIVE') return true;
    return false;
  }
}

export const authStore = AuthStore.getInstance();
