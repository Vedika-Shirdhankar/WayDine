import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { EngineLab } from './pages/EngineLab.jsx';
import { RoadGraphViewer } from './pages/RoadGraphViewer.jsx';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/engine-lab" element={<EngineLab />} />
          <Route path="/road-graph" element={<RoadGraphViewer />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
