import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CounterDashboard from './pages/CounterDashboard';
import BaseData from './pages/BaseData';
import ZoneManagement from './pages/admin/ZoneManagement';
import GroupManagement from './pages/admin/GroupManagement';
import CounterManagement from './pages/admin/CounterManagement';
import ServiceManagement from './pages/admin/ServiceManagement';
import UserManagement from './pages/admin/UserManagement';
import TicketManagement from './pages/TicketManagement';
import PublicDisplay from './pages/PublicDisplay';
import Reports from './pages/Reports';
import Kiosk from './pages/Kiosk';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <SocketProvider>
            <Toaster 
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  theme: {
                    primary: 'green',
                    secondary: 'black',
                  },
                },
              }}
            />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/kiosk" element={<Kiosk />} />
              <Route path="/display/:zoneId" element={<PublicDisplay />} />
              <Route path="/counter/:counterId" element={<CounterDashboard />} />
              
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/tickets" element={<TicketManagement />} />
                  <Route path="/base-data" element={<BaseData />} />
                  <Route path="/zones" element={<ZoneManagement />} />
                  <Route path="/groups" element={<GroupManagement />} />
                  <Route path="/counters" element={<CounterManagement />} />
                  <Route path="/services" element={<ServiceManagement />} />
                  <Route path="/users" element={<UserManagement />} />
                  <Route path="/reports" element={<Reports />} />
                </Route>
              </Route>
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;