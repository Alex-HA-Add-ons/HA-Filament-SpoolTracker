import { useWebSocket, WebSocketProvider } from '@hooks/useWebSocket';
import DashboardPage from '@pages/Dashboard';
import './App.css';

function AppContent() {
  const { connectionStatus } = useWebSocket();
  const version = __ADDON_VERSION__;

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'green';
      case 'connecting': return 'orange';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">HA Add-on Boilerplate</h1>
          <div className="header-right">
            {version && <div className="version-badge">v{version}</div>}
            <div className="connection-status">
              <span className="status-dot" style={{ backgroundColor: getStatusColor() }}></span>
              {getStatusText()}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <DashboardPage />
      </main>

      <footer className="app-footer">
        <p>Home Assistant Add-on Boilerplate</p>
      </footer>
    </div>
  );
}

function App() {
  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port;
    const isIngress = window.location.pathname.includes('/api/hassio_ingress/');

    if (isIngress) {
      const ingressPath = window.location.pathname.replace('/api/hassio_ingress/', '');
      return `${protocol}//${host}:${port}/api/hassio_ingress/${ingressPath}`;
    }
    return `${protocol}//${host}:3001`;
  };

  return (
    <WebSocketProvider url={getWebSocketUrl()}>
      <AppContent />
    </WebSocketProvider>
  );
}

export default App;
