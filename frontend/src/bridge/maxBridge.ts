/**
 * Typed wrapper around the global `window.WebApp` object injected by
 * https://st.max.ru/js/max-web-app.js (MAX Bridge — see dev.max.ru/docs/webapps/bridge).
 *
 * Outside the MAX client (plain browser dev/preview) `window.WebApp` never
 * appears, so every method below falls back to a mock implementation that
 * resolves with plausible data — this keeps every screen fully clickable
 * during development without needing the MAX host app.
 */

export type MaxPlatform = 'ios' | 'android' | 'desktop' | 'web';

export type BiometricAuthResult = { status: 'success' } | { status: 'cancelled' } | { status: 'fallback' };

interface ShareMaxContentParams {
  title?: string;
  text?: string;
  url?: string;
}

interface HapticFeedback {
  impactOccurred: (style: 'soft' | 'light' | 'medium' | 'heavy' | 'rigid') => void;
}

interface BiometricManager {
  init: () => Promise<{ available: boolean }>;
  authenticate: () => Promise<BiometricAuthResult>;
}

interface WebAppBridge {
  initData: string;
  initDataUnsafe: unknown;
  platform: MaxPlatform;
  deviceName?: string;
  BiometricManager: BiometricManager;
  HapticFeedback: HapticFeedback;
  shareMaxContent: (params: ShareMaxContentParams) => Promise<void>;
  shareContent: (params: ShareMaxContentParams) => Promise<void>;
  downloadFile: (url: string, filename: string) => Promise<void>;
  openCodeReader: () => Promise<{ data: string } | null>;
  requestContact: () => Promise<{ phone: string } | null>;
}

declare global {
  interface Window {
    WebApp?: WebAppBridge;
  }
}

const DEV_INIT_DATA =
  'user=%7B%22id%22%3A%22dev-user%22%7D&auth_date=0&hash=dev-mock-hash';

function isRealBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.WebApp;
}

function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

const mockBridge: WebAppBridge = {
  initData: DEV_INIT_DATA,
  initDataUnsafe: { user: { id: 'dev-user' } },
  platform: 'web',
  deviceName: 'Dev Browser',
  BiometricManager: {
    init: () => delay({ available: true }, 0),
    authenticate: () => delay({ status: 'success' }),
  },
  HapticFeedback: {
    impactOccurred: () => {
      /* no-op outside MAX */
    },
  },
  shareMaxContent: async (params) => {
    console.info('[dev] shareMaxContent', params);
  },
  shareContent: async (params) => {
    console.info('[dev] shareContent', params);
  },
  downloadFile: async (url, filename) => {
    console.info('[dev] downloadFile', { url, filename });
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
  },
  openCodeReader: async () => {
    console.info('[dev] openCodeReader — no camera in dev mock');
    return null;
  },
  requestContact: async () => delay({ phone: '+70000000000' }),
};

function getBridge(): WebAppBridge {
  return isRealBridgeAvailable() ? window.WebApp! : mockBridge;
}

/**
 * The real `max-web-app.js` script defines `window.WebApp` even when loaded
 * outside the actual MAX client (e.g. this project previewed in a plain
 * desktop browser) — so `isRealBridgeAvailable()` alone isn't a reliable
 * "are we really inside MAX" check. Its methods can then reject for reasons
 * that have nothing to do with the user (no biometry hardware, not
 * initialized, unsupported in this host). Every call here is wrapped so a
 * rejection degrades the UI (e.g. biometric → confirm fallback) instead of
 * crashing it.
 */
async function safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[maxBridge] call failed, falling back', err);
    return fallback;
  }
}

export const maxBridge = {
  isNative: isRealBridgeAvailable,
  get platform(): MaxPlatform {
    return getBridge().platform;
  },
  get initData(): string {
    return getBridge().initData;
  },
  biometric: {
    init: () => safeCall(() => getBridge().BiometricManager.init(), { available: false }),
    authenticate: async (): Promise<BiometricAuthResult> => {
      await safeCall(() => getBridge().BiometricManager.init(), { available: false });
      return safeCall(() => getBridge().BiometricManager.authenticate(), { status: 'fallback' });
    },
  },
  haptics: {
    impact: (style: Parameters<HapticFeedback['impactOccurred']>[0] = 'medium') => {
      try {
        getBridge().HapticFeedback.impactOccurred(style);
      } catch (err) {
        console.warn('[maxBridge] haptics failed', err);
      }
    },
  },
  shareMaxContent: (params: ShareMaxContentParams) => safeCall(() => getBridge().shareMaxContent(params), undefined),
  shareContent: (params: ShareMaxContentParams) => safeCall(() => getBridge().shareContent(params), undefined),
  downloadFile: (url: string, filename: string) =>
    safeCall(() => getBridge().downloadFile(url, filename), undefined),
  openCodeReader: () => safeCall(() => getBridge().openCodeReader(), null),
  requestContact: () => safeCall(() => getBridge().requestContact(), null),
};
