import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  HomeIcon,
  TicketIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userCounter, setUserCounter] = useState(null);

  useEffect(() => {
    if (user?.counter) {
      fetchUserCounter();
    }
  }, [user]);

  const fetchUserCounter = async () => {
    try {
      const response = await api.get(`/counters/${user.counter}`);
      setUserCounter(response.data.counter);
    } catch (error) {
      console.error('Failed to fetch user counter:', error);
    }
  };

  // Base navigation - keeping your original structure
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Tickets', href: '/tickets', icon: TicketIcon },
    { name: 'Base Data', href: '/base-data', icon: Squares2X2Icon },
    { name: 'Users', href: '/users', icon: UsersIcon },
    { name: 'Reports', href: '/reports', icon: ChartBarIcon },
  ];

  // Create navigation with My Counter added for officers
  const getNavigation = () => {
    // Check if user is an officer (Verifier, Cashier, Validator, Authorizer) and has a counter
    const isOfficer = ['Verifier', 'Cashier', 'Validator', 'Authorizer'].includes(user?.role);
    
    if (isOfficer && userCounter) {
      // Insert My Counter after Dashboard, before Tickets
      const officerNav = [
        { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
        { name: 'My Counter', href: `/counter/${userCounter._id}`, icon: ComputerDesktopIcon },
        { name: 'Tickets', href: '/tickets', icon: TicketIcon },
        { name: 'Base Data', href: '/base-data', icon: Squares2X2Icon },
        { name: 'Users', href: '/users', icon: UsersIcon },
        { name: 'Reports', href: '/reports', icon: ChartBarIcon },
      ];
      return officerNav;
    }
    
    return navigation;
  };

  const currentNavigation = getNavigation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex flex-col w-64 bg-white h-full">
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">QMS</h1>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 p-4">
            {currentNavigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.href);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-2 mt-2 text-sm font-medium rounded-lg ${
                  location.pathname === item.href
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r">
          <div className="flex items-center justify-center h-16 px-4 border-b">
            <h1 className="text-xl font-bold text-blue-600">Queue Management System</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {currentNavigation.map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-lg ${
                  location.pathname === item.href
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-gray-500 lg:hidden"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-4 ml-auto">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
                {userCounter && (
                  <p className="text-xs text-blue-600 mt-1">
                    {userCounter.name || `Counter ${userCounter.counterNumber}`}
                  </p>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:text-red-600"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;