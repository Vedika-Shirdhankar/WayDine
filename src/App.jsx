import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { JourneyProvider } from './context/JourneyContext.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { PitstopsPage } from './pages/PitstopsPage.jsx';
import { RestaurantDetailPage } from './pages/RestaurantDetailPage.jsx';
import { SimulatorPage } from './pages/SimulatorPage.jsx';
import { AnalyticsPage } from './pages/AnalyticsPage.jsx';
import { PreferencesPage } from './pages/PreferencesPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { DijkstraLab } from './pages/DijkstraLab.jsx';

/** Root app shell: providers → layout → routes */
function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background text-textMain">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pitstops" element={<PitstopsPage />} />
              <Route path="/restaurant/:id" element={<RestaurantDetailPage />} />
              <Route path="/simulator" element={<SimulatorPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/preferences" element={<PreferencesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dijkstra" element={<DijkstraLab />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
      <BrowserRouter>
        <AuthProvider>
          <JourneyProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/*" element={<AppLayout />} />
            </Routes>
          </JourneyProvider>
        </AuthProvider>
      </BrowserRouter>
    </ToastProvider>
    </ErrorBoundary>
  );
}
