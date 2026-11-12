import React from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './ui.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import Privacy from './pages/Privacy.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Inbox from './pages/Inbox.jsx';
import Compose from './pages/Compose.jsx';
import Scheduled from './pages/Scheduled.jsx';
import Rules from './pages/Rules.jsx';
import Priority from './pages/Priority.jsx';
import AutoResponder from './pages/AutoResponder.jsx';
import Cleaner from './pages/Cleaner.jsx';
import Activity from './pages/Activity.jsx';
import Settings from './pages/Settings.jsx';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout><Outlet /></Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Landing login />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route element={<Protected />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/scheduled" element={<Scheduled />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/priority" element={<Priority />} />
        <Route path="/templates" element={<Navigate to="/auto-responder?tab=templates" replace />} />
        <Route path="/auto-responder" element={<AutoResponder />} />
        <Route path="/cleaner" element={<Cleaner />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<div className="center-screen"><div className="card" style={{ textAlign: 'center', minWidth: 300 }}><h2>We couldn't find that page</h2><p className="muted" style={{ margin: '0.4rem 0 1rem' }}>The link may be broken or the page may have moved.</p><a className="btn btn-primary" href="/">Back to home</a></div></div>} />
    </Routes>
  );
}
