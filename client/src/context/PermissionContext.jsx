import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const PermissionContext = createContext();

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};

// Define all available permissions
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_TICKETS: 'view_tickets',
  CALL_TICKETS: 'call_tickets',
  COMPLETE_TICKETS: 'complete_tickets',
  MARK_ABSENT: 'mark_absent',
  ESCALATE_TICKETS: 'escalate_tickets',
  VIEW_COUNTER_DASHBOARD: 'view_counter_dashboard',
  MANAGE_ZONES: 'manage_zones',
  MANAGE_GROUPS: 'manage_groups',
  MANAGE_COUNTERS: 'manage_counters',
  MANAGE_SERVICES: 'manage_services',
  MANAGE_USERS: 'manage_users',
  VIEW_REPORTS: 'view_reports',
  VIEW_ESCALATIONS: 'view_escalations',
  MANAGE_ESCALATIONS: 'manage_escalations',
};

// Role-based default permissions
const ROLE_DEFAULT_PERMISSIONS = {
  Admin: Object.values(PERMISSIONS),
  Supervisor: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TICKETS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_ESCALATIONS,
    PERMISSIONS.MANAGE_ESCALATIONS,
    PERMISSIONS.CALL_TICKETS,
    PERMISSIONS.COMPLETE_TICKETS,
    PERMISSIONS.MARK_ABSENT,
    PERMISSIONS.ESCALATE_TICKETS,
    PERMISSIONS.VIEW_COUNTER_DASHBOARD
  ],
  Verifier: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COUNTER_DASHBOARD,
    PERMISSIONS.CALL_TICKETS,
    PERMISSIONS.COMPLETE_TICKETS,
    PERMISSIONS.MARK_ABSENT,
    PERMISSIONS.ESCALATE_TICKETS
  ],
  Validator: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COUNTER_DASHBOARD,
    PERMISSIONS.CALL_TICKETS,
    PERMISSIONS.COMPLETE_TICKETS,
    PERMISSIONS.MARK_ABSENT,
    PERMISSIONS.ESCALATE_TICKETS
  ],
  Authorizer: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COUNTER_DASHBOARD,
    PERMISSIONS.CALL_TICKETS,
    PERMISSIONS.COMPLETE_TICKETS,
    PERMISSIONS.MARK_ABSENT,
    PERMISSIONS.ESCALATE_TICKETS
  ],
  Cashier: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COUNTER_DASHBOARD,
    PERMISSIONS.CALL_TICKETS,
    PERMISSIONS.COMPLETE_TICKETS,
    PERMISSIONS.MARK_ABSENT,
    PERMISSIONS.ESCALATE_TICKETS
  ]
};

export const PermissionProvider = ({ children }) => {
  const { user } = useAuth();

  const value = useMemo(() => {
    const userPermissions = user?.permissions || ROLE_DEFAULT_PERMISSIONS[user?.role] || [];
    
    const hasPermission = (permission) => {
      if (!user) return false;
      if (user.role === 'Admin') return true;
      return userPermissions.includes(permission);
    };

    const isAdmin = user?.role === 'Admin';
    const isSupervisor = user?.role === 'Supervisor';
    const isOfficer = ['Verifier', 'Validator', 'Authorizer', 'Cashier'].includes(user?.role);

    console.log('PermissionProvider:', { 
      role: user?.role, 
      isAdmin, 
      isSupervisor, 
      isOfficer,
      permissions: userPermissions 
    });

    return {
      permissions: userPermissions,
      hasPermission,
      isAdmin,
      isSupervisor,
      isOfficer,
    };
  }, [user]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
};