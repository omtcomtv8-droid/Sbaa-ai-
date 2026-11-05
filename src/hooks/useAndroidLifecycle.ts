import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

interface AndroidLifecycleOptions {
  onBackPress?: () => boolean; // return true if handled, false to let app exit
  onUpdateAvailable?: (info: any) => void;
}

export function useAndroidLifecycle({ onBackPress, onUpdateAvailable }: AndroidLifecycleOptions = {}) {
  useEffect(() => {
    // 1. Configure Native Android System UI if running inside Capacitor
    if (Capacitor.isNativePlatform()) {
      const configureSystemUI = async () => {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#05070B' });
          await StatusBar.setOverlaysWebView({ overlay: false });
        } catch (e) {
          // StatusBar might not be supported in some environments
          console.debug('[AndroidLifecycle] StatusBar config:', e);
        }

        try {
          await SplashScreen.hide();
        } catch (e) {
          console.debug('[AndroidLifecycle] SplashScreen hide:', e);
        }
      };

      configureSystemUI();

      // 2. Hardware Back Button Listener on Android
      const backListenerPromise = CapApp.addListener('backButton', ({ canGoBack }: any) => {
        if (onBackPress) {
          const handled = onBackPress();
          if (handled) return;
        }

        if (canGoBack) {
          window.history.back();
        } else {
          CapApp.exitApp();
        }
      });

      return () => {
        backListenerPromise.then((handle: any) => handle?.remove?.()).catch(console.warn);
      };
    }
  }, [onBackPress]);
}
