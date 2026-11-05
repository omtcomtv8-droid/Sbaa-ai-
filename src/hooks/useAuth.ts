import { useState, useEffect } from 'react';
import { authStore, AuthStoreState } from '../services/AuthStore';

export function useAuth(): AuthStoreState & {
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  activateCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  logOut: () => Promise<void>;
  checkActivationStatus: () => Promise<boolean>;
  enterDemoGuest: () => void;
} {
  const [state, setState] = useState<AuthStoreState>(() => authStore.getState());

  useEffect(() => {
    const unsub = authStore.subscribe((next: AuthStoreState) => {
      setState(next);
    });
    return unsub;
  }, []);

  return {
    ...state,
    signInWithGoogle: () => authStore.signInWithGoogle(),
    activateCode: (code: string) => authStore.activateCode(code),
    logOut: () => authStore.logOut(),
    checkActivationStatus: () => authStore.checkActivationStatus(),
    enterDemoGuest: () => authStore.enterDemoGuest(),
  };
}
