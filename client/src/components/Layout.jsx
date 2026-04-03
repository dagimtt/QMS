import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { usePermissions, PERMISSIONS } from '../context/PermissionContext';
import api from '../services/api';
import logo from '../assets/ICS Logo.png';
import {
  HomeIcon,
  TicketIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  KeyIcon
} from '@heroicons/react/24/outline';

const Layout = () => {
  const { user, logout } = useAuth();
  const { hasPermission, isAdmin, isSupervisor, isOfficer } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userCounter, setUserCounter] = useState(null);
  const [availableZones, setAvailableZones] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (user?.counter) {
      fetchUserCounter();
    }
    if (isSupervisor || isAdmin) {
      fetchZones();
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

  const fetchZones = async () => {
    try {
      const response = await api.get('/zones');
      setAvailableZones(response.data.zones || []);
    } catch (error) {
      console.error('Failed to fetch zones:', error);
    }
  };

  const getNavigation = () => {
    const nav = [];
    nav.push({ name: 'Dashboard', href: '/dashboard', icon: HomeIcon });

    if (isOfficer && userCounter) {
      nav.push({ 
        name: 'My Counter', 
        href: `/counter/${userCounter._id}`, 
        icon: ComputerDesktopIcon 
      });
    }

    if (hasPermission(PERMISSIONS.VIEW_TICKETS)) {
      nav.push({ name: 'Tickets', href: '/tickets', icon: TicketIcon });
    }

    if (isSupervisor || isAdmin) {
      let zoneId = '';
      if (userCounter?.group?.zone?._id) {
        zoneId = userCounter.group.zone._id;
      } else if (availableZones.length > 0) {
        zoneId = availableZones[0]._id;
      }
      
      if (zoneId) {
        nav.push({ 
          name: 'Escalations', 
          href: `/supervisor/${zoneId}`, 
          icon: ExclamationTriangleIcon 
        });
      }
    }

    if (isAdmin) {
      nav.push({ name: 'Base Data', href: '/base-data', icon: Squares2X2Icon });
    }

    if (isAdmin && hasPermission(PERMISSIONS.MANAGE_USERS)) {
      nav.push({ name: 'Users', href: '/users', icon: UsersIcon });
    }


    if (isAdmin) {
      nav.push({ name: 'Role Permissions', href: '/role-permissions', icon: ShieldCheckIcon });
    }

    if (hasPermission(PERMISSIONS.VIEW_REPORTS)) {
      nav.push({ name: 'Reports', href: '/reports', icon: ChartBarIcon });
    }

    return nav;
  };

  const currentNavigation = getNavigation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavigate = (href, disabled) => {
    if (!disabled && href && href !== '#') {
      navigate(href);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${sidebarOpen ? 'visible' : 'invisible'}`}>
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex flex-col w-64 bg-white h-full shadow-2xl transform transition-transform duration-300 ease-in-out">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <img src={logo} alt="ICS Logo" className="h-8 w-auto object-contain" />
              <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                QMS
              </h1>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {currentNavigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  handleNavigate(item.href, item.disabled);
                  setSidebarOpen(false);
                }}
                disabled={item.disabled}
                className={`w-full flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                  item.disabled 
                    ? 'text-gray-300 cursor-not-allowed'
                    : location.pathname === item.href
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className={`h-4 w-4 mr-3 transition-all ${location.pathname === item.href ? 'text-white' : 'text-gray-400'}`} />
                {item.name}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{user?.fullName}</p>
                <p className="text-[11px] text-gray-500">{user?.role}</p>
                {userCounter && (
                  <p className="text-[10px] text-blue-600 mt-0.5 truncate">
                    {userCounter.name || `Counter ${userCounter.counterNumber}`}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-all duration-200"
            >
              <ArrowRightOnRectangleIcon className="h-3.5 w-3.5 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Desktop sidebar - Collapsible */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex lg:flex-col transition-all duration-300 ease-in-out z-20 ${collapsed ? 'lg:w-16' : 'lg:w-56'}`}>
        <div className="flex flex-col flex-1 bg-white shadow-xl">
          {/* Sidebar Header with Logo */}
          <div className="flex items-center justify-between h-14 px-3 border-b border-gray-100">
            {!collapsed && (
              <div className="flex items-center space-x-2 overflow-hidden transition-opacity duration-300">
                <img src={logo} alt="ICS Logo" className="h-7 w-auto object-contain" />
                <h1 className="text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap">
                  QMS
                </h1>
              </div>
            )}
            {collapsed && (
              <div className="w-full flex justify-center">
                <img src={logo} alt="ICS Logo" className="h-7 w-auto object-contain" />
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7M19 19l-7-7 7-7"} />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {currentNavigation.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigate(item.href, item.disabled)}
                disabled={item.disabled}
                className={`w-full flex items-center rounded-lg transition-all duration-200 group ${
                  collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
                } ${
                  item.disabled 
                    ? 'text-gray-300 cursor-not-allowed'
                    : location.pathname === item.href
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                title={collapsed ? item.name : ''}
              >
                <item.icon className={`h-4 w-4 transition-all flex-shrink-0 ${collapsed ? '' : 'mr-3'} ${location.pathname === item.href ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {!collapsed && (
                  <span className="text-xs font-medium truncate transition-opacity duration-300">
                    {item.name}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-3 border-t border-gray-100">
            {!collapsed ? (
              <>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                    {user?.fullName?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{user?.fullName}</p>
                    <p className="text-[10px] text-gray-500">{user?.role}</p>
                    {userCounter && (
                      <p className="text-[9px] text-blue-600 mt-0.5 truncate">
                        {userCounter.name || `Counter ${userCounter.counterNumber}`}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center px-2 py-1.5 text-[11px] font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-all duration-200"
                >
                  <ArrowRightOnRectangleIcon className="h-3.5 w-3.5 mr-1.5" />
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-[11px]">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-red-600 hover:text-red-700 rounded-lg hover:bg-red-50 transition-all duration-200"
                  title="Logout"
                >
                  <ArrowRightOnRectangleIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-300 ease-in-out ${collapsed ? 'lg:pl-16' : 'lg:pl-56'}`}>
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="flex items-center justify-between h-12 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 lg:hidden transition-all"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            
          </div>
        </div>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;