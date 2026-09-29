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

/** Реальная сигнатура WebApp.shareMaxContent/shareContent (dev.max.ru/docs/webapps/bridge) —
 * ровно text/link, один из двух обязателен; полей title/url в бридже нет.
 * Второй режим shareMaxContent (пересылка уже отправленного ботом сообщения
 * как вложения: { mid, chatType }) здесь не используется — требует, чтобы
 * бот сначала сам отправил документ через Bot API POST /messages. */
interface ShareMaxContentParams {
  text?: string;
  link?: string;
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

/**
 * Same as safeCall, but also races a timeout — the real bridge script can
 * take a while to internally reject (no biometry hardware, not the actual
 * MAX host, etc.), which made "Согласовать"/"Подписать" feel stuck for a
 * few seconds before the confirm-fallback sheet appeared. Biometric calls
 * should never make the user wait this long either way.
 */
async function safeCallWithTimeout<T>(fn: () => Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } catch (err) {
    console.warn('[maxBridge] call failed, falling back', err);
    return fallback;
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * `initData` — та же query-строка формата Telegram WebApp, что подписывает
 * бэкенд (см. api/app/auth.py._verify_init_data, комментарий там же: "аналог
 * Telegram WebApp initData"). Разбираем её тем же способом, чтобы достать:
 *  - `user.id` — реальный числовой MAX user id, нужен для bootstrap-вызовов
 *    (POST /companies, POST /employees/link), которые идут ДО того, как
 *    появляется привязанный сотрудник — им неоткуда взять identity иначе;
 *  - `start_param` — deeplink-payload (join_<code> / off_<id> / t7_<год>),
 *    тот же payload, что бот передаёт через OpenAppButton (см.
 *    bot/app/deeplinks.py). Название поля для MAX Bridge не подтверждено
 *    официальной документацией на момент написания — проверяем оба
 *    вероятных варианта (`start_param`, `startapp`) и деградируем в null.
 */
function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  return Object.fromEntries(params.entries());
}

function readMaxUserId(initData: string): string | null {
  try {
    const user = JSON.parse(parseInitData(initData).user ?? 'null') as { id?: string | number } | null;
    return user?.id != null ? String(user.id) : null;
  } catch {
    return null;
  }
}

function readStartParam(initData: string): string | null {
  const fields = parseInitData(initData);
  return fields.start_param ?? fields.startapp ?? null;
}

export const maxBridge = {
  isNative: isRealBridgeAvailable,
  get platform(): MaxPlatform {
    return getBridge().platform;
  },
  get initData(): string {
    return getBridge().initData;
  },
  get maxUserId(): string | null {
    return readMaxUserId(getBridge().initData);
  },
  get startParam(): string | null {
    return readStartParam(getBridge().initData);
  },
  biometric: {
    init: () => safeCallWithTimeout(() => getBridge().BiometricManager.init(), { available: false }, 1000),
    authenticate: async (): Promise<BiometricAuthResult> => {
      await safeCallWithTimeout(() => getBridge().BiometricManager.init(), { available: false }, 1000);
      return safeCallWithTimeout(() => getBridge().BiometricManager.authenticate(), { status: 'fallback' }, 1500);
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
