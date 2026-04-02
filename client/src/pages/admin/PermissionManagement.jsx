import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { 
  ShieldCheckIcon, 
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  LockClosedIcon,
  LockOpenIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  UserIcon,
  CreditCardIcon,
  IdentificationIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

// Define all available permissions with categories
const AVAILABLE_PERMISSIONS = {
  // Dashboard
  view_dashboard: { name: 'View Dashboard', category: 'Dashboard', description: 'Access the main dashboard' },
  
  // Tickets
  view_tickets: { name: 'View Tickets', category: 'Tickets', description: 'View all tickets' },
  call_tickets: { name: 'Call Tickets', category: 'Tickets', description: 'Call next ticket' },
  complete_tickets: { name: 'Complete Tickets', category: 'Tickets', description: 'Complete or move tickets' },
  mark_absent: { name: 'Mark Absent', category: 'Tickets', description: 'Mark tickets as absent' },
  escalate_tickets: { name: 'Escalate Tickets', category: 'Tickets', description: 'Escalate tickets to supervisor' },
  
  // Counter
  view_counter_dashboard: { name: 'View Counter Dashboard', category: 'Counter', description: 'Access counter dashboard' },
  
  // Base Data Management
  manage_zones: { name: 'Manage Zones', category: 'Base Data', description: 'Create, edit, delete zones' },
  manage_groups: { name: 'Manage Groups', category: 'Base Data', description: 'Create, edit, delete groups' },
  manage_counters: { name: 'Manage Counters', category: 'Base Data', description: 'Create, edit, delete counters' },
  manage_services: { name: 'Manage Services', category: 'Base Data', description: 'Create, edit, delete services' },
  manage_users: { name: 'Manage Users', category: 'Users', description: 'Create, edit, delete users' },
  
  // Reports
  view_reports: { name: 'View Reports', category: 'Reports', description: 'Access reports and analytics' },
  
  // Escalations
  view_escalations: { name: 'View Escalations', category: 'Escalations', description: 'View escalated tickets' },
  manage_escalations: { name: 'Manage Escalations', category: 'Escalations', description: 'Resolve or return escalated tickets' }
};

// Role definitions with icons and colors
const ROLES = [
  { 
    name: 'Admin', 
    icon: ShieldCheckIcon, 
    color: 'purple',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    description: 'Full system access - manage everything'
  },
  { 
    name: 'Supervisor', 
    icon: AcademicCapIcon, 
    color: 'blue',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    description: 'Monitor operations and manage escalations'
  },
  { 
    name: 'Verifier', 
    icon: IdentificationIcon, 
    color: 'green',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    description: 'Verify customer documents'
  },
  { 
    name: 'Validator', 
    icon: CheckCircleIcon, 
    color: 'teal',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
    description: 'Validate processed documents'
  },
  { 
    name: 'Authorizer', 
    icon: LockOpenIcon, 
    color: 'indigo',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    description: 'Final authorization'
  },
  { 
    name: 'Cashier', 
    icon: CreditCardIcon, 
    color: 'yellow',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    description: 'Process payments'
  }
];

// Default permissions for each role
const DEFAULT_ROLE_PERMISSIONS = {
  Admin: Object.keys(AVAILABLE_PERMISSIONS),
  Supervisor: [
    'view_dashboard', 'view_tickets', 'view_reports', 'view_escalations', 
    'manage_escalations', 'call_tickets', 'complete_tickets', 'mark_absent', 
    'escalate_tickets', 'view_counter_dashboard'
  ],
  Verifier: [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 'mark_absent', 'escalate_tickets'
  ],
  Validator: [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 'mark_absent', 'escalate_tickets'
  ],
  Authorizer: [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 'mark_absent', 'escalate_tickets'
  ],
  Cashier: [
    'view_counter_dashboard', 'call_tickets', 'complete_tickets', 'mark_absent', 'escalate_tickets'
  ]
};

const RolePermissionManagement = () => {
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [editingPermissions, setEditingPermissions] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRolePermissions();
  }, []);

  const loadRolePermissions = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users/role-permissions');
      if (response.data.success) {
        setRolePermissions(response.data.permissions);
      } else {
        setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      }
    } catch (error) {
      console.error('Failed to load role permissions:', error);
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
      toast.error('Using default permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role) => {
    setSelectedRole(role);
    const permissionsMap = {};
    const rolePerms = rolePermissions[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
    rolePerms.forEach(perm => {
      permissionsMap[perm] = true;
    });
    setEditingPermissions(permissionsMap);
    setExpandedCategories({});
  };

  const handleTogglePermission = (permissionKey) => {
    setEditingPermissions(prev => {
      const newPermissions = { ...prev };
      if (newPermissions[permissionKey]) {
        delete newPermissions[permissionKey];
      } else {
        newPermissions[permissionKey] = true;
      }
      return newPermissions;
    });
  };

  const handleSelectAll = (category) => {
    const permissionsInCategory = Object.keys(AVAILABLE_PERMISSIONS).filter(
      key => AVAILABLE_PERMISSIONS[key].category === category
    );
    
    const allSelected = permissionsInCategory.every(p => editingPermissions[p]);
    
    setEditingPermissions(prev => {
      const newPermissions = { ...prev };
      permissionsInCategory.forEach(permission => {
        if (allSelected) {
          delete newPermissions[permission];
        } else {
          newPermissions[permission] = true;
        }
      });
      return newPermissions;
    });
  };

  const handleResetToDefault = () => {
    if (!selectedRole) return;
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[selectedRole] || [];
    const newPermissions = {};
    defaultPerms.forEach(perm => {
      newPermissions[perm] = true;
    });
    setEditingPermissions(newPermissions);
    toast.success(`Reset ${selectedRole} permissions to default`);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    
    setSaving(true);
    try {
      const permissionsArray = Object.keys(editingPermissions);
      
      await api.post('/users/role-permissions', {
        role: selectedRole,
        permissions: permissionsArray
      });
      
      setRolePermissions(prev => ({
        ...prev,
        [selectedRole]: permissionsArray
      }));
      
      toast.success(`Permissions updated for ${selectedRole} role`);
      setSelectedRole(null);
      setEditingPermissions({});
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const filterPermissions = (permissions) => {
    if (!searchTerm) return permissions;
    return permissions.filter(perm => 
      perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      perm.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const permissionsByCategory = {};
  Object.entries(AVAILABLE_PERMISSIONS).forEach(([key, value]) => {
    if (!permissionsByCategory[value.category]) {
      permissionsByCategory[value.category] = [];
    }
    permissionsByCategory[value.category].push({ key, ...value });
  });

  const filteredCategories = {};
  Object.entries(permissionsByCategory).forEach(([category, permissions]) => {
    const filtered = filterPermissions(permissions);
    if (filtered.length > 0) {
      filteredCategories[category] = filtered;
    }
  });

  const getRoleIcon = (roleName) => {
    const role = ROLES.find(r => r.name === roleName);
    return role?.icon || UserGroupIcon;
  };

  const getRoleColor = (roleName) => {
    const role = ROLES.find(r => r.name === roleName);
    return role || ROLES[0];
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading role permissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 rounded-xl shadow-lg">
              <ShieldCheckIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Role Permission Management</h1>
              <p className="text-gray-600 mt-1">Configure permissions for each user role</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Roles Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden sticky top-6">
              <div className="p-4 border-b bg-gradient-to-r from-gray-50 to-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <UserGroupIcon className="h-5 w-5 mr-2 text-purple-600" />
                  User Roles
                </h2>
                <p className="text-xs text-gray-500 mt-1">Select a role to edit permissions</p>
              </div>
              <div className="divide-y">
                {ROLES.map(role => {
                  const RoleIcon = role.icon;
                  const isSelected = selectedRole === role.name;
                  const permissionCount = rolePermissions[role.name]?.length || 0;
                  const totalPermissions = Object.keys(AVAILABLE_PERMISSIONS).length;
                  
                  return (
                    <button
                      key={role.name}
                      onClick={() => handleEditRole(role.name)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-all duration-200 ${
                        isSelected ? `${role.bgColor} border-l-4 ${role.borderColor}` : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg ${role.bgColor} flex items-center justify-center`}>
                          <RoleIcon className={`h-5 w-5 ${role.textColor}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold ${isSelected ? role.textColor : 'text-gray-900'}`}>
                            {role.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
                          <div className="flex items-center mt-1">
                            <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full bg-${role.color}-500`}
                                style={{ width: `${(permissionCount / totalPermissions) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 ml-2">
                              {permissionCount}/{totalPermissions}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Permission Editor */}
          <div className="lg:col-span-3">
            {selectedRole ? (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Role Header */}
                <div className={`p-6 border-b ${getRoleColor(selectedRole).bgColor}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 rounded-xl bg-white shadow-md flex items-center justify-center`}>
                        {React.createElement(getRoleIcon(selectedRole), { 
                          className: `h-7 w-7 ${getRoleColor(selectedRole).textColor}` 
                        })}
                      </div>
                      <div>
                        <h2 className={`text-2xl font-bold ${getRoleColor(selectedRole).textColor}`}>
                          {selectedRole} Role
                        </h2>
                        <p className="text-gray-600 mt-1">
                          {ROLES.find(r => r.name === selectedRole)?.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleResetToDefault}
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center"
                      >
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                        Reset to Default
                      </button>
                      <button
                        onClick={handleSavePermissions}
                        disabled={saving}
                        className="flex items-center px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 shadow-sm"
                      >
                        <ArrowPathIcon className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setSelectedRole(null)}
                        className="p-2 text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <div className="p-6">
                  {/* Search Bar */}
                  <div className="mb-6">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search permissions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Permission Summary */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Permission Summary</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {Object.keys(editingPermissions).length} of {Object.keys(AVAILABLE_PERMISSIONS).length} permissions granted
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <LockClosedIcon className="h-4 w-4 text-gray-400" />
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-600 rounded-full transition-all duration-300"
                            style={{ width: `${(Object.keys(editingPermissions).length / Object.keys(AVAILABLE_PERMISSIONS).length) * 100}%` }}
                          />
                        </div>
                        <LockOpenIcon className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* Permissions by Category */}
                  <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2">
                    {Object.entries(filteredCategories).map(([category, permissions]) => (
                      <div key={category} className="border rounded-lg overflow-hidden shadow-sm">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition"
                        >
                          <div className="flex items-center space-x-2">
                            <h4 className="font-semibold text-gray-900">{category}</h4>
                            <span className="text-xs text-gray-500">
                              ({permissions.filter(p => editingPermissions[p.key]).length}/{permissions.length})
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAll(category);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                            >
                              {permissions.every(p => editingPermissions[p.key]) ? 'Deselect All' : 'Select All'}
                            </button>
                            <svg className={`h-5 w-5 text-gray-500 transition-transform ${expandedCategories[category] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>
                        
                        {expandedCategories[category] && (
                          <div className="p-4 space-y-2 border-t">
                            {permissions.map(permission => (
                              <label 
                                key={permission.key} 
                                className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition group"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!editingPermissions[permission.key]}
                                  onChange={() => handleTogglePermission(permission.key)}
                                  className="mt-0.5 h-4 w-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-900 group-hover:text-purple-700 transition">
                                      {permission.name}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">{permission.key}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {Object.keys(filteredCategories).length === 0 && (
                    <div className="text-center py-12">
                      <ShieldCheckIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No permissions found matching your search</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheckIcon className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Role</h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Choose a role from the left sidebar to view and edit its permissions
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolePermissionManagement;