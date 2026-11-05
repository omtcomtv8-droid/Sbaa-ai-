/**
 * Safe Storage Utility
 * Wraps window.localStorage and window.sessionStorage with try/catch
 * to prevent DOMException / SecurityError crashes in iframes or sandboxed environments.
 */

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Insecure or blocked iframe storage
    }
    return null;
  },

  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Insecure or blocked iframe storage
    }
  },

  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Insecure or blocked iframe storage
    }
  },

  getLocalItem: (key: string): string | null => {
    return safeStorage.getItem(key);
  },

  setLocalItem: (key: string, value: string): void => {
    safeStorage.setItem(key, value);
  },

  removeLocalItem: (key: string): void => {
    safeStorage.removeItem(key);
  },

  getSessionItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch {
      // Insecure or blocked iframe storage
    }
    return null;
  },

  setSessionItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
    } catch {
      // Insecure or blocked iframe storage
    }
  },

  removeSessionItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
    } catch {
      // Insecure or blocked iframe storage
    }
  },

  clearSession: (): void => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
      }
    } catch {
      // Insecure or blocked iframe storage
    }
  },
};
