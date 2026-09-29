import { useEffect, useState, useSyncExternalStore } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import { AppRoutes } from './routes/AppRoutes';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import { RoleSwitcher } from './components/RoleSwitcher';
import { SkeletonScreen } from './components/States';
import { maxBridge } from './bridge/maxBridge';
import { getMe } from './api/client';
import { ApiError } from './api/errors';
import { hydrateFromMe, markNotLinked } from './context/authStore';
import { getTheme, subscribeTheme } from './context/themeStore';

/** max-web-app.js выполняется синхронно (обычный <script> в index.html), но
 * внутри делает асинхронное рукопожатие с нативным MAX-хостом, прежде чем
 * определить window.WebApp — React стартует раньше, чем оно успевает
 * завершиться. Разовый вызов maxBridge.isNative() на первом рендере App()
 * ловит именно этот момент и навсегда решает «бриджа нет» (DEV-плашка тогда
 * остаётся висеть, хотя доли секунды спустя бридж уже готов и реальные
 * запросы через httpClient.ts им пользуются правильно — оттуда и 403
 * NOT_LINKED вместо 401 в реальном MAX, а не в браузерном превью). Поэтому
 * здесь не разовая проверка, а реактивное состояние с коротким переопросом:
 * если на старте бриджа не оказалось, продолжаем проверять ~1.5с — вдруг
 * появится — и тогда React перерисует зависящие от него места. */
function useIsNativeBridge(): boolean {
  const [isNative, setIsNative] = useState(() => maxBridge.isNative());

  useEffect(() => {
    if (isNative) return;
    const interval = setInterval(() => {
      if (maxBridge.isNative()) {
        setIsNative(true);
        clearInterval(interval);
      }
    }, 50);
    const giveUpAt = setTimeout(() => clearInterval(interval), 1500);
    return () => {
      clearInterval(interval);
      clearTimeout(giveUpAt);
    };
  }, [isNative]);

  return isNative;
}

/** Внутри реального MAX Bridge persona.role/isLinked изначально — моковые
 * дефолты (см. authStore.ts), а RootRedirect/RoleGate решают куда вести
 * пользователя именно по ним. Поэтому до первого реального GET /me нужно
 * придержать рендер маршрутов — иначе многоролевого или ещё не подключённого
 * сотрудника на долю секунды (или насовсем, пока не перезайдёт) закинет не
 * туда. В preview/dev-режиме бриджа нет — ждать нечего. */
function useMeBootstrap(isNative: boolean): boolean {
  const [ready, setReady] = useState(!isNative);

  useEffect(() => {
    if (!isNative) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    getMe()
      .then((me) => {
        if (!cancelled) hydrateFromMe(me.roles);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.code === 'NOT_LINKED') markNotLinked();
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isNative]);

  return ready;
}

function App() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);
  const isNative = useIsNativeBridge();
  const ready = useMeBootstrap(isNative);

  return (
    <MaxUI colorScheme={theme}>
      <BrowserRouter>
        <div className="app-shell">
          {ready ? <AppRoutes /> : <SkeletonScreen />}
        </div>
        {!isNative && <DevRoleSwitcher />}
        {isNative && <RoleSwitcher />}
      </BrowserRouter>
    </MaxUI>
  );
}

export default App;
