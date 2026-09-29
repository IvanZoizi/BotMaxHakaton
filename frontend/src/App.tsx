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

/** Внутри реального MAX Bridge persona.role/isLinked изначально — моковые
 * дефолты (см. authStore.ts), а RootRedirect/RoleGate решают куда вести
 * пользователя именно по ним. Поэтому до первого реального GET /me нужно
 * придержать рендер маршрутов — иначе многоролевого или ещё не подключённого
 * сотрудника на долю секунды (или насовсем, пока не перезайдёт) закинет не
 * туда. В preview/dev-режиме бриджа нет — ждать нечего. */
function useMeBootstrap(): boolean {
  const [ready, setReady] = useState(() => !maxBridge.isNative());

  useEffect(() => {
    if (!maxBridge.isNative()) return;
    let cancelled = false;
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
  }, []);

  return ready;
}

function App() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);
  const ready = useMeBootstrap();

  return (
    <MaxUI colorScheme={theme}>
      <BrowserRouter>
        <div className="app-shell">
          {ready ? <AppRoutes /> : <SkeletonScreen />}
        </div>
        {!maxBridge.isNative() && <DevRoleSwitcher />}
        {maxBridge.isNative() && <RoleSwitcher />}
      </BrowserRouter>
    </MaxUI>
  );
}

export default App;
