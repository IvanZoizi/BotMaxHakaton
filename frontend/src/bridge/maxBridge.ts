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

/** Реальные статусы BiometricManager.authenticate() (dev.max.ru/docs/webapps/bridge) —
 * успех резолвится как 'authorized' + token, отказ/ошибка — это reject, а не
 * резолв с 'cancelled'. 'cancelled' и 'unavailable' здесь — наша интерпретация
 * (см. maxBridge.biometric.authenticate ниже), не поле из бриджа. */
export type BiometricAuthResult =
  | { status: 'authorized'; token: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' };

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

/** init() — реально возвращает больше полей (type, accessRequested,
 * tokenSaved, deviceId), но нам достаточно available/accessGranted, чтобы
 * решить, вызывать ли requestAccess() перед authenticate(). */
interface BiometryInfo {
  available: boolean;
  accessGranted: boolean;
}

interface BiometricManager {
  init: () => Promise<BiometryInfo>;
  requestAccess: (reason?: string) => Promise<void>;
  authenticate: (reason?: string) => Promise<{ status: 'authorized'; token: string }>;
}

interface WebAppBridge {
  initData: string;
  initDataUnsafe: unknown;
  platform: MaxPlatform;
  deviceName?: string;
  BiometricManager: BiometricManager;
  HapticFeedback: HapticFeedback;
  shareMaxContent: (params: ShareMaxContentParams) => Promise<{ status: 'shared' | 'cancelled' }>;
  shareContent: (params: ShareMaxContentParams) => Promise<{ status: 'shared' | 'cancelled' }>;
  downloadFile: (url: string, filename: string) => Promise<{ status: 'downloading' | 'cancelled' }>;
  openCodeReader: (fileSelect?: boolean) => Promise<{ value: string }>;
  requestContact: () => Promise<{ phone: string }>;
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
    init: () => delay({ available: true, accessGranted: true }, 0),
    requestAccess: () => delay(undefined, 0),
    authenticate: () => delay({ status: 'authorized' as const, token: 'dev-token' }),
  },
  HapticFeedback: {
    impactOccurred: () => {
      /* no-op outside MAX */
    },
  },
  shareMaxContent: async (params) => {
    console.info('[dev] shareMaxContent', params);
    return { status: 'shared' as const };
  },
  shareContent: async (params) => {
    console.info('[dev] shareContent', params);
    return { status: 'shared' as const };
  },
  downloadFile: async (url, filename) => {
    console.info('[dev] downloadFile', { url, filename });
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener';
    link.click();
    return { status: 'downloading' as const };
  },
  openCodeReader: async () => {
    console.info('[dev] openCodeReader — no camera in dev mock');
    return Promise.reject(new Error('no camera in dev mock'));
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
    /** Полный флоу из upstream-документации: init() -> при !accessGranted
     * запросить requestAccess() -> authenticate(). Раньше здесь просто
     * дважды дёргали init()+authenticate() и сверяли результат с полем
     * 'success', которого в реальном бридже не существует (там 'authorized')
     * — из-за этого успешная биометрия ВСЕГДА считалась неуспехом и тихо
     * скатывалась на ручное подтверждение, даже когда пользователь реально
     * приложил палец/лицо. requestAccess() тоже не вызывался вовсе — без
     * него authenticate() на первом запуске может отклоняться, т.к. доступ
     * ещё не запрошен.
     */
    authenticate: async (reason?: string): Promise<BiometricAuthResult> => {
      const info = await safeCallWithTimeout(
        () => getBridge().BiometricManager.init(),
        { available: false, accessGranted: false },
        1000,
      );
      if (!info.available) return { status: 'unavailable' };

      if (!info.accessGranted) {
        const granted = await safeCall(
          () => getBridge().BiometricManager.requestAccess(reason).then(() => true),
          false,
        );
        if (!granted) return { status: 'unavailable' };
      }

      return safeCallWithTimeout(
        () =>
          getBridge()
            .BiometricManager.authenticate(reason)
            .then((r): BiometricAuthResult => r),
        { status: 'cancelled' },
        3000,
      );
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
