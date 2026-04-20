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
  const [supervisorZoneId, setSupervisorZoneId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [loadingZone, setLoadingZone] = useState(true);
  const [redirected, setRedirected] = useState(false);

  // Fetch user's counter (for officers)
  useEffect(() => {
    if (user?.counter && isOfficer) {
      fetchUserCounter();
    }
  }, [user, isOfficer]);

  // Fetch supervisor's zone from their counter
  useEffect(() => {
    const fetchSupervisorZone = async () => {
      if (isSupervisor && user?.counter && !redirected) {
        setLoadingZone(true);
        console.log('=== Fetching Supervisor Zone for:', user.email);
        
        try {
          // Get counter ID properly
          let counterId = user.counter;
          if (typeof counterId === 'object' && counterId !== null) {
            counterId = counterId._id || counterId.toString();
          }
          
          console.log('Counter ID:', counterId);
          
          // Fetch counter with populated group
          const counterResponse = await api.get(`/counters/${counterId}`);
          const counter = counterResponse.data.counter;
          console.log('Counter:', { 
            id: counter._id, 
            number: counter.counterNumber, 
            name: counter.name,
            type: counter.type,
            group: counter.group 
          });
          
          let zoneId = null;
          
          // Check if group is populated with zone
          if (counter.group && typeof counter.group === 'object' && counter.group.zone) {
            // Group is populated, get zone from it
            if (typeof counter.group.zone === 'object' && counter.group.zone._id) {
              zoneId = counter.group.zone._id;
              console.log('Zone ID from populated group:', zoneId);
              console.log('Zone name:', counter.group.zone.name);
            } else {
              zoneId = counter.group.zone;
            }
          } 
          // If group is just an ID, fetch it
          else if (counter.group && typeof counter.group === 'string') {
            const groupResponse = await api.get(`/groups/${counter.group}`);
            const group = groupResponse.data.group;
            console.log('Group fetched:', { id: group._id, name: group.name, zone: group.zone });
            
            if (group && group.zone) {
              if (typeof group.zone === 'object' && group.zone._id) {
                zoneId = group.zone._id;
              } else {
                zoneId = group.zone;
              }
            }
          }
          
          if (zoneId) {
            // Fetch zone details
            const zoneResponse = await api.get(`/zones/${zoneId}`);
            const zone = zoneResponse.data.zone;
            console.log('Zone found:', { id: zone._id, name: zone.name, code: zone.code });
            
            if (zone && zone._id) {
              setSupervisorZoneId(zone._id);
              console.log('✅ Supervisor zone set to:', zone._id, zone.name);
              // Redirect to the correct zone if needed
              const targetUrl = `/supervisor/${zone._id}`;
              const currentPath = location.pathname;
              
              if (!currentPath.includes('/supervisor/')) {
                console.log('Redirecting to supervisor zone:', targetUrl);
                setRedirected(true);
                navigate(targetUrl, { replace: true });
              } else if (currentPath !== targetUrl) {
                console.log('Wrong supervisor zone, redirecting to:', targetUrl);
                setRedirected(true);
                navigate(targetUrl, { replace: true });
              }
            }
          } else {
            console.log('❌ Could not find zone for supervisor');
          }
        } catch (error) {
          console.error('Error fetching supervisor zone:', error);
        } finally {
          setLoadingZone(false);
        }
      } else {
        setLoadingZone(false);
      }
    };
    
    fetchSupervisorZone();
  }, [isSupervisor, user?.counter, user?.email, navigate, location.pathname, redirected]);

  const fetchUserCounter = async () => {
    try {
      let counterId = user.counter;
      if (typeof counterId === 'object' && counterId !== null) {
        counterId = counterId._id || counterId.toString();
      }
      const response = await api.get(`/counters/${counterId}`);
      setUserCounter(response.data.counter);
    } catch (error) {
      console.error('Failed to fetch user counter:', error);
    }
  };

  const getNavigation = () => {
    const nav = [];
    
    // FOR SUPERVISORS: ONLY SHOW ESCALATIONS and OFFICER PERFORMANCE
    if (isSupervisor) {
      if (supervisorZoneId) {
        console.log('Building navigation with zone ID:', supervisorZoneId);
        nav.push({ 
          name: 'Escalations', 
          href: `/supervisor/${supervisorZoneId}`, 
          icon: ExclamationTriangleIcon 
        });
        // Add Officer Performance link for supervisors
        nav.push({ 
          name: 'Officer Performance', 
          href: `/zone/${supervisorZoneId}/performance`, 
          icon: ChartBarIcon 
        });
      } else if (loadingZone) {
        nav.push({ 
          name: 'Loading...', 
          href: '#', 
          icon: ExclamationTriangleIcon,
          disabled: true
        });
      }
      return nav;
    }
    
    // FOR ADMINS: Full navigation
    if (isAdmin) {
      nav.push({ name: 'Dashboard', href: '/dashboard', icon: HomeIcon });
      nav.push({ name: 'Tickets', href: '/tickets', icon: TicketIcon });
      nav.push({ name: 'Base Data', href: '/base-data', icon: Squares2X2Icon });
      nav.push({ name: 'Users', href: '/users', icon: UsersIcon });
      nav.push({ name: 'Role Permissions', href: '/role-permissions', icon: ShieldCheckIcon });
      nav.push({ name: 'Performance', href: '/performance', icon: ChartBarIcon });
      nav.push({ name: 'Reports', href: '/reports', icon: ChartBarIcon });
      return nav;
    }
    
    // FOR OFFICERS (Verifier, Cashier, Validator, Authorizer)
    if (isOfficer) {
      nav.push({ name: 'Dashboard', href: '/dashboard', icon: HomeIcon });
      
      if (userCounter) {
        nav.push({ 
          name: 'My Counter', 
          href: `/counter/${userCounter._id}`, 
          icon: ComputerDesktopIcon 
        });
      }
      
      nav.push({ name: 'Tickets', href: '/tickets', icon: TicketIcon });
      return nav;
    }
    
    // Default navigation
    nav.push({ name: 'Dashboard', href: '/dashboard', icon: HomeIcon });
    if (hasPermission(PERMISSIONS.VIEW_TICKETS)) {
      nav.push({ name: 'Tickets', href: '/tickets', icon: TicketIcon });
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

  // Show loading while fetching supervisor's zone
  if (isSupervisor && loadingZone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

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