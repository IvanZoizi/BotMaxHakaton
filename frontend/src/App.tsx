import { useSyncExternalStore } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import { AppRoutes } from './routes/AppRoutes';
import { DevRoleSwitcher } from './components/DevRoleSwitcher';
import { getTheme, subscribeTheme } from './context/themeStore';

function App() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);

  return (
    <MaxUI colorScheme={theme}>
      <BrowserRouter>
        <div className="app-shell">
          <AppRoutes />
        </div>
        <DevRoleSwitcher />
      </BrowserRouter>
    </MaxUI>
  );
}

export default App;
