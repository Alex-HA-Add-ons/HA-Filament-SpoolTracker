import { useStoredState } from '@hooks/useStoredState';
import TabNav from '@components/TabNav';
import DashboardPage from '@pages/Dashboard';
import SpoolsPage from '@pages/Spools';
import PrintHistoryPage from '@pages/PrintHistory';
import SettingsPage from '@pages/Settings';
import './App.css';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'spools', label: 'Spools' },
  { id: 'history', label: 'Print History' },
  { id: 'settings', label: 'Settings' },
];

function App() {
  const [activeTab, setActiveTab] = useStoredState('activeTab', 'dashboard');
  const version = __ADDON_VERSION__;

  const renderPage = () => {
    switch (activeTab) {
      case 'spools': return <SpoolsPage />;
      case 'history': return <PrintHistoryPage />;
      case 'settings': return <SettingsPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">HA Filament SpoolTracker</h1>
          <div className="header-right">
            {version && <div className="version-badge">v{version}</div>}
          </div>
        </div>
      </header>

      <main className="app-main">
        <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
        {renderPage()}
      </main>

      <footer className="app-footer">
        <p>HA Filament SpoolTracker</p>
      </footer>
    </div>
  );
}

export default App;
