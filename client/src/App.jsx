import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { PermissionProvider, PERMISSIONS } from './context/PermissionContext';

import ProtectedRoute from './components/ProtectedRoute';
import ProtectedRouteWithPermission from './components/ProtectedRouteWithPermission';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CounterDashboard from './pages/CounterDashboard';
import SupervisorDashboard from './pages/SupervisorDashboard';
import PermissionManagement from './pages/admin/PermissionManagement';
import RolePermissionManagement from './pages/admin/RolePermissionManagement';

import BaseData from './pages/BaseData';
import ZoneManagement from './pages/admin/ZoneManagement';
import GroupManagement from './pages/admin/GroupManagement';
import CounterManagement from './pages/admin/CounterManagement';
import ServiceManagement from './pages/admin/ServiceManagement';
import UserManagement from './pages/admin/UserManagement';
import TicketManagement from './pages/TicketManagement';
import PublicDisplay from './pages/PublicDisplay';
import Reports from './pages/Reports';
import KioskSetup from './pages/KioskSetup';
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
          <PermissionProvider>
            <SocketProvider>

              {/* Toast Notifications */}
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
                    icon: '🎉',
                  },
                  error: {
                    duration: 4000,
                    icon: '❌',
                  },
                }}
              />

              <Routes>

                {/* 🌐 Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/kiosk-setup" element={<KioskSetup />} />
                <Route path="/kiosk" element={<Kiosk />} />
                <Route path="/display/:zoneId" element={<PublicDisplay />} />

                {/*  Special dashboards */}
                <Route path="/counter/:counterId" element={<CounterDashboard />} />

                {/*  Auth Protected Routes */}
                <Route element={<ProtectedRoute />}>

                  {/*  Layout Wrapper */}
                  <Route element={<Layout />}>

                    <Route path="/" element={<Navigate to="/dashboard" />} />

                    {/* Dashboard */}
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Tickets */}
                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.VIEW_TICKETS} />}>
                      <Route path="/tickets" element={<TicketManagement />} />
                    </Route>

                    {/* SUPERVISOR DASHBOARD - Updated with permission protection */}
                    <Route 
                      path="/supervisor/:zoneId" 
                      element={
                        <ProtectedRouteWithPermission permission={PERMISSIONS.VIEW_ESCALATIONS}>
                          <SupervisorDashboard />
                        </ProtectedRouteWithPermission>
                      } 
                    />

                    {/* Base Data */}
                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.MANAGE_ZONES} />}>
                      <Route path="/base-data" element={<BaseData />} />
                      <Route path="/zones" element={<ZoneManagement />} />
                    </Route>

                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.MANAGE_GROUPS} />}>
                      <Route path="/groups" element={<GroupManagement />} />
                    </Route>

                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.MANAGE_COUNTERS} />}>
                      <Route path="/counters" element={<CounterManagement />} />
                    </Route>

                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.MANAGE_SERVICES} />}>
                      <Route path="/services" element={<ServiceManagement />} />
                    </Route>

                    {/* Users */}
                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.MANAGE_USERS} />}>
                      <Route path="/users" element={<UserManagement />} />
                      <Route path="/permissions" element={<PermissionManagement />} />
                    </Route>

                    {/* Role Permissions */}
                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.MANAGE_USERS} />}>
                      <Route path="/role-permissions" element={<RolePermissionManagement />} />
                    </Route>

                    {/* Reports */}
                    <Route element={<ProtectedRouteWithPermission permission={PERMISSIONS.VIEW_REPORTS} />}>
                      <Route path="/reports" element={<Reports />} />
                    </Route>

                  </Route>
                </Route>

                {/* ❌ Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" />} />

              </Routes>

            </SocketProvider>
          </PermissionProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;