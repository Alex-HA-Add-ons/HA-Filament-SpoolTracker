import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import TabNav from '@components/TabNav';
import DashboardPage from '@pages/Dashboard';
import SpoolsPage from '@pages/Spools';
import SpoolDetailPage from '@pages/SpoolDetail';
import PrintHistoryPage from '@pages/PrintHistory';
import PrintersPage from '@pages/Printers';
import SettingsPage from '@pages/Settings';
import './App.css';

const TABS = [
  { id: 'dashboard', path: '/dashboard', label: 'Dashboard' },
  { id: 'spools', path: '/spools', label: 'Spools' },
  { id: 'printers', path: '/printers', label: 'Printers' },
  { id: 'history', path: '/history', label: 'Print History' },
  { id: 'settings', path: '/settings', label: 'Settings' },
];

function getActiveTab(pathname: string): string {
  for (const tab of TABS) {
    if (pathname === tab.path || pathname.startsWith(tab.path + '/')) return tab.id;
  }
  return 'dashboard';
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname || '/dashboard';
  const activeTab = getActiveTab(pathname);
  const version = __ADDON_VERSION__;

  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    // Close mobile nav when route changes
    // Schedule the state update to avoid synchronous state updates during render/effect phases.
    setTimeout(() => setNavOpen(false), 0);
  }, [pathname]);

  const handleTabChange = (tabId: string) => {
    const tab = TABS.find((t) => t.id === tabId);
    if (tab) {
      navigate(tab.path);
      setNavOpen(false);
    }
  };

  return (
    <div className="app">
      <header className={`app-header ${navOpen ? 'nav-open' : ''}`}>
        <div className="header-content">
          <button
            type="button"
            className="app-logo"
            onClick={() => handleTabChange('dashboard')}
            aria-label="Go to Dashboard"
          >
            <img src="favicon.svg" alt="SpoolTracker logo" className="app-logo-mark" />
            <span className="app-logo-text">SpoolTracker</span>
          </button>
          <div className="header-center">
            <TabNav tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange} />
          </div>
          <div className="header-right">
            {version && <div className="version-badge">v{version}</div>}
            <button
              type="button"
              className={`header-menu-toggle ${navOpen ? 'open' : ''}`}
              onClick={() => setNavOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/spools" element={<SpoolsPage />} />
          <Route path="/spools/:id" element={<SpoolDetailPage />} />
          <Route path="/printers" element={<PrintersPage />} />
          <Route path="/history" element={<PrintHistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>
          <a
            href="https://community.home-assistant.io/t/add-on-ha-filament-spooltracker-filament-print-job-tracker-for-bambu-lab-octoprint-planned/994230"
            target="_blank"
            rel="noreferrer"
          >
            HA Filament SpoolTracker – Home Assistant community discussion
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
