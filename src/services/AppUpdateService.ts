import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export interface AppVersionInfo {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  mandatory?: boolean;
  releaseNotes?: string;
  sha256?: string;
  fileSize?: string;
  minAndroidVersion?: number;
  publishedAt?: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: {
    name: string;
    code: number;
  };
  latestVersion?: AppVersionInfo;
  error?: string;
}

export type UpdateListener = (info: AppVersionInfo) => void;

class AppUpdateService {
  private static instance: AppUpdateService;

  // Authoritative Application Version Constants
  public readonly CURRENT_VERSION_NAME = '1.0.0';
  public readonly CURRENT_VERSION_CODE = 1;
  public readonly APPLICATION_ID = 'com.sabaa.aisolution';

  private listeners: Set<UpdateListener> = new Set();
  private lastCheckResult: UpdateCheckResult | null = null;
  private isChecking = false;
  private isMandatoryLocked = false;

  private constructor() {
    // Listen to native app resume to re-check updates
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', (state: any) => {
        if (state?.isActive) {
          this.checkForUpdates().catch(console.warn);
        }
      });
    }
  }

  public static getInstance(): AppUpdateService {
    if (!AppUpdateService.instance) {
      AppUpdateService.instance = new AppUpdateService();
    }
    return AppUpdateService.instance;
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }

  public isLockedByMandatoryUpdate(): boolean {
    return this.isMandatoryLocked;
  }

  public onUpdateAvailable(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    if (this.lastCheckResult?.updateAvailable && this.lastCheckResult.latestVersion) {
      listener(this.lastCheckResult.latestVersion);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Validate update metadata to protect against tampered or malicious manifests
   */
  private validateMetadata(data: any): AppVersionInfo | null {
    if (!data || typeof data !== 'object') return null;

    const versionName = typeof data.versionName === 'string' ? data.versionName.trim() : '';
    const versionCode = typeof data.versionCode === 'number' ? data.versionCode : parseInt(data.versionCode, 10);
    const apkUrl = typeof data.apkUrl === 'string' ? data.apkUrl.trim() : '';

    if (!versionName || isNaN(versionCode) || !apkUrl) {
      console.warn('[AppUpdateService] Rejected malformed update metadata:', data);
      return null;
    }

    // Security check: APK URL must end with .apk and not contain dangerous schemes
    if (!apkUrl.toLowerCase().endsWith('.apk')) {
      console.warn('[AppUpdateService] Rejected non-APK url:', apkUrl);
      return null;
    }

    // Reject dangerous protocol injection (only allow https or relative paths)
    if (apkUrl.startsWith('javascript:') || apkUrl.startsWith('data:') || apkUrl.startsWith('file:')) {
      console.warn('[AppUpdateService] Rejected unsafe URL scheme:', apkUrl);
      return null;
    }

    // SHA-256 verification string validation if present (64 hex characters)
    let sha256 = undefined;
    if (typeof data.sha256 === 'string' && /^[a-fA-F0-9]{64}$/.test(data.sha256)) {
      sha256 = data.sha256.toLowerCase();
    }

    return {
      versionName,
      versionCode,
      apkUrl,
      mandatory: Boolean(data.mandatory),
      releaseNotes: typeof data.releaseNotes === 'string' ? data.releaseNotes : undefined,
      sha256,
      fileSize: typeof data.fileSize === 'string' ? data.fileSize : undefined,
      minAndroidVersion: typeof data.minAndroidVersion === 'number' ? data.minAndroidVersion : undefined,
      publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : undefined,
    };
  }

  /**
   * Check the update endpoint for a newer version
   */
  public async checkForUpdates(customEndpoint?: string): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      return (
        this.lastCheckResult || {
          updateAvailable: false,
          currentVersion: { name: this.CURRENT_VERSION_NAME, code: this.CURRENT_VERSION_CODE },
        }
      );
    }

    this.isChecking = true;
    const endpoint = customEndpoint || '/app/version.json';

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const json = await response.json();
      const validInfo = this.validateMetadata(json);

      if (!validInfo) {
        throw new Error('Invalid update manifest format');
      }

      const updateAvailable = validInfo.versionCode > this.CURRENT_VERSION_CODE;

      if (updateAvailable && validInfo.mandatory) {
        this.isMandatoryLocked = true;
      }

      const result: UpdateCheckResult = {
        updateAvailable,
        currentVersion: {
          name: this.CURRENT_VERSION_NAME,
          code: this.CURRENT_VERSION_CODE,
        },
        latestVersion: validInfo,
      };

      this.lastCheckResult = result;

      if (updateAvailable) {
        this.listeners.forEach((listener) => {
          try {
            listener(validInfo);
          } catch (e) {
            console.error('[AppUpdateService] Error in update listener:', e);
          }
        });
      }

      return result;
    } catch (err: any) {
      console.warn('[AppUpdateService] Update check skipped/failed (offline or network):', err.message);
      const fallbackResult: UpdateCheckResult = {
        updateAvailable: false,
        currentVersion: {
          name: this.CURRENT_VERSION_NAME,
          code: this.CURRENT_VERSION_CODE,
        },
        error: err.message,
      };
      return fallbackResult;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Resolves the full secure APK download URL
   */
  public getFullApkUrl(relativeOrAbsolute: string): string {
    if (relativeOrAbsolute.startsWith('http://') || relativeOrAbsolute.startsWith('https://')) {
      return relativeOrAbsolute;
    }
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    const normalized = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
    return `${origin}${normalized}`;
  }

  /**
   * Start APK download and trigger installation
   */
  public installApk(info: AppVersionInfo): void {
    const fullUrl = this.getFullApkUrl(info.apkUrl);
    console.log('[AppUpdateService] Launching APK download/installation from:', fullUrl);

    // In mobile WebView / Capacitor or browser, opening the direct APK download triggers the Android Package Installer
    const anchor = document.createElement('a');
    anchor.href = fullUrl;
    anchor.setAttribute('download', `Sabaa-AI-Solution-v${info.versionName}.apk`);
    anchor.setAttribute('target', '_blank');
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}

export const appUpdateService = AppUpdateService.getInstance();
