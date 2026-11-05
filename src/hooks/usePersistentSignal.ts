import { useState, useRef, useEffect, useCallback } from 'react';
import { Signal } from '../types';

const STORAGE_KEY = 'pocket_option_persisted_active_signal';

export interface UsePersistentSignalOptions {
  /** Key for session/local storage fallback (defaults to 'pocket_option_persisted_active_signal') */
  storageKey?: string;
  /** Whether to sync active signal with sessionStorage (default: true) */
  persistSession?: boolean;
}

/**
 * Signal Persistence Wrapper
 *
 * Ensures that `activeSignal` is only overwritten by an incoming signal if:
 * 1. Current activeSignal is null, OR
 * 2. Incoming signal belongs to a different asset/timeframe (market context switch), OR
 * 3. Incoming signal's `analysisVersion` is strictly newer (greater) than the current signal's `analysisVersion`, OR
 * 4. An explicit `force: true` flag is provided.
 *
 * Survives component re-renders using `useRef`, preventing stale closure issues
 * and race conditions from out-of-order WebSocket ticks / polling responses.
 */
export function usePersistentSignal(
  initialSignal: Signal | null = null,
  options: UsePersistentSignalOptions = {}
) {
  const { storageKey = STORAGE_KEY, persistSession = true } = options;

  // Initialize from sessionStorage if available to survive page reloads and remounts
  const [activeSignal, setActiveSignalState] = useState<Signal | null>(() => {
    if (initialSignal) return initialSignal;
    if (typeof window === 'undefined' || !persistSession) return null;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Signal;
        // Verify signal is still fresh/relevant if it has expiresAt
        if (!parsed.expiresAt || parsed.expiresAt > Date.now()) {
          return parsed;
        }
      }
    } catch {
      // Storage unavailable or parsing failed
    }
    return null;
  });

  // Persistent reference ensuring surviving component re-renders & avoiding stale closures
  const activeSignalRef = useRef<Signal | null>(activeSignal);
  const latestVersionRef = useRef<number>(activeSignal?.analysisVersion ?? -1);

  // Sync ref whenever state changes
  useEffect(() => {
    activeSignalRef.current = activeSignal;
    if (activeSignal?.analysisVersion !== undefined) {
      latestVersionRef.current = activeSignal.analysisVersion;
    }
  }, [activeSignal]);

  /**
   * Updates the active signal with strict analysisVersion validation.
   * Only overwrites if incoming version is strictly newer or market context changed.
   */
  const setActiveSignal = useCallback(
    (
      incoming: Signal | null | ((prev: Signal | null) => Signal | null),
      force: boolean = false
    ): boolean => {
      const current = activeSignalRef.current;
      const currentVersion = current?.analysisVersion ?? latestVersionRef.current ?? -1;

      // Resolve functional update if provided
      const newSignal = typeof incoming === 'function' ? incoming(current) : incoming;

      // Case 1: Clearing or resetting active signal
      if (!newSignal) {
        activeSignalRef.current = null;
        latestVersionRef.current = -1;
        setActiveSignalState(null);
        if (persistSession && typeof window !== 'undefined') {
          try {
            window.sessionStorage.removeItem(storageKey);
          } catch {
            // Ignore
          }
        }
        return true;
      }

      // Case 2: Explicit force update
      if (force) {
        activeSignalRef.current = newSignal;
        if (newSignal.analysisVersion !== undefined) {
          latestVersionRef.current = newSignal.analysisVersion;
        }
        setActiveSignalState(newSignal);
        if (persistSession && typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(newSignal));
          } catch {
            // Ignore
          }
        }
        return true;
      }

      // Case 3: Market context switch (different asset or timeframe)
      const isContextSwitch =
        current !== null &&
        (newSignal.asset !== current.asset || newSignal.timeframe !== current.timeframe);

      if (isContextSwitch) {
        activeSignalRef.current = newSignal;
        latestVersionRef.current = newSignal.analysisVersion ?? 0;
        setActiveSignalState(newSignal);
        if (persistSession && typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(newSignal));
          } catch {
            // Ignore
          }
        }
        return true;
      }

      // Case 4: First signal arriving
      if (!current) {
        activeSignalRef.current = newSignal;
        if (newSignal.analysisVersion !== undefined) {
          latestVersionRef.current = newSignal.analysisVersion;
        }
        setActiveSignalState(newSignal);
        if (persistSession && typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(newSignal));
          } catch {
            // Ignore
          }
        }
        return true;
      }

      // Case 5: analysisVersion comparison
      const incomingVersion = newSignal.analysisVersion;

      if (incomingVersion !== undefined) {
        // Strict version check: only overwrite if incoming is strictly newer
        if (incomingVersion > currentVersion) {
          activeSignalRef.current = newSignal;
          latestVersionRef.current = incomingVersion;
          setActiveSignalState(newSignal);
          if (persistSession && typeof window !== 'undefined') {
            try {
              window.sessionStorage.setItem(storageKey, JSON.stringify(newSignal));
            } catch {
              // Ignore
            }
          }
          return true;
        } else {
          // Stale version: ignore out-of-order update
          return false;
        }
      }

      // Case 6: Fallback for signals without explicit analysisVersion (compare timestamps)
      const incomingTime = newSignal.timestamp ?? newSignal.signalTimestamp ?? 0;
      const currentTime = current.timestamp ?? current.signalTimestamp ?? 0;
      if (incomingTime >= currentTime) {
        activeSignalRef.current = newSignal;
        setActiveSignalState(newSignal);
        if (persistSession && typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(storageKey, JSON.stringify(newSignal));
          } catch {
            // Ignore
          }
        }
        return true;
      }

      return false;
    },
    [persistSession, storageKey]
  );

  const clearActiveSignal = useCallback(() => {
    setActiveSignal(null, true);
  }, [setActiveSignal]);

  // Construct dual-accessible interface (array-like and object-like)
  const result = [activeSignal, setActiveSignal, activeSignalRef] as const;
  return Object.assign(result, {
    activeSignal,
    setActiveSignal,
    activeSignalRef,
    clearActiveSignal,
    analysisVersion: latestVersionRef.current,
  });
}

// Named alias
export const useSignalPersistence = usePersistentSignal;
