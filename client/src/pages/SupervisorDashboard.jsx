import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';
import { 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ArrowPathIcon,
  UserIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  BuildingStorefrontIcon,
  QueueListIcon,
  XCircleIcon,
  StarIcon
} from '@heroicons/react/24/outline';

const SupervisorDashboard = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission, isAdmin, isSupervisor } = usePermissions();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState(null);
  const [escalatedTickets, setEscalatedTickets] = useState([]);
  const [counters, setCounters] = useState([]);
  const [stats, setStats] = useState({ total: 0, escalated: 0, resolved: 0, completed: 0 });
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Get supervisor's zone from user data if no zoneId in URL
  useEffect(() => {
    const fetchSupervisorZone = async () => {
      if (isSupervisor && !zoneId) {
        try {
          const response = await api.get('/auth/me');
          const userData = response.data.user;
          
          if (userData.counter) {
            const counterResponse = await api.get(`/counters/${userData.counter}`);
            const zoneFromCounter = counterResponse.data.counter?.group?.zone?._id;
            if (zoneFromCounter) {
              navigate(`/supervisor/${zoneFromCounter}`, { replace: true });
              return;
            }
          }
          
          const zonesResponse = await api.get('/zones');
          const zones = zonesResponse.data.zones || [];
          if (zones.length > 0) {
            navigate(`/supervisor/${zones[0]._id}`, { replace: true });
          }
        } catch (error) {
          console.error('Failed to fetch supervisor zone:', error);
          toast.error('Could not determine your zone');
        }
      }
    };
    
    fetchSupervisorZone();
  }, [isSupervisor, zoneId, navigate]);

  // Check if user has access
  useEffect(() => {
    if (!isAdmin && !isSupervisor) {
      toast.error('You do not have permission to access this page');
      navigate('/dashboard');
      return;
    }
  }, [isAdmin, isSupervisor, navigate]);

  useEffect(() => {
    if (zoneId && (isAdmin || isSupervisor)) {
      fetchDashboard();
    }
    
    const interval = setInterval(() => {
      if (autoRefresh && (isAdmin || isSupervisor)) {
        fetchDashboard();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [zoneId, autoRefresh, isAdmin, isSupervisor]);

  const fetchDashboard = async () => {
    try {
      const response = await api.get(`/tickets/supervisor/${zoneId}/dashboard`);
      setZone(response.data.zone);
      setEscalatedTickets(response.data.escalatedTickets);
      setCounters(response.data.counters);
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view this dashboard');
        navigate('/dashboard');
      } else {
        toast.error('Failed to load supervisor dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (ticketId, action, resolution) => {
    setActionLoading(true);
    try {
      const response = await api.post(`/tickets/${ticketId}/resolve-escalation`, {
        resolution: resolution,
        action: action
      });
      
      if (response.data.success) {
        toast.success(response.data.message);
        fetchDashboard();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to resolve escalation');
    } finally {
      setActionLoading(false);
    }
  };

  const showResolveDialog = (ticket) => {
    const resolution = prompt(
      `Resolving escalation for ticket #${ticket.displayNumber}\n\n` +
      `Escalation Reason: ${ticket.escalationReason || ticket.reason || 'N/A'}\n\n` +
      `Enter resolution notes:`,
      'Issue resolved successfully'
    );
    if (resolution !== null && resolution.trim() !== '') {
      handleResolve(ticket._id, 'resolved', resolution);
    } else if (resolution !== null) {
      toast.error('Resolution notes are required');
    }
  };

  const showReturnDialog = (ticket) => {
    const priorityOption = window.confirm(
      `Return ticket #${ticket.displayNumber} to original counter?\n\n` +
      `Click "OK" for PRIORITY return (ticket will go to front of queue)\n` +
      `Click "Cancel" for normal return`
    );
    
    const notes = prompt(
      `Returning ticket #${ticket.displayNumber} to original counter\n\n` +
      `Original Counter: ${ticket.originalCounterNumber}\n` +
      `Original Officer: ${ticket.originalVerifierName || 'N/A'}\n\n` +
      `Enter return notes:`,
      priorityOption ? 'Returning with PRIORITY status' : 'Returning to original counter'
    );
    
    if (notes !== null && notes.trim() !== '') {
      const action = priorityOption ? 'priority_return' : 'return';
      handleResolve(ticket._id, action, notes);
    } else if (notes !== null) {
      toast.error('Return notes are required');
    }
  };

  const viewReason = (ticket) => {
    setSelectedTicket(ticket);
    setShowReasonModal(true);
  };

  if (!isAdmin && !isSupervisor) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading supervisor dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supervisor Dashboard</h1>
              <p className="text-gray-500 mt-1">Zone: {zone?.name} ({zone?.code})</p>
              <p className="text-sm text-gray-400 mt-1">Manage escalated tickets and monitor operations</p>
            </div>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-500">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>Auto-refresh (10s)</span>
              </label>
              <button
                onClick={fetchDashboard}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                <ArrowPathIcon className="h-5 w-5 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rest of your JSX remains the same */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-500">Total Tickets</p>
          </div>
          <div className="bg-red-50 rounded-xl p-6 border border-red-100">
            <p className="text-2xl font-bold text-red-600">{stats.escalated}</p>
            <p className="text-sm text-red-500">Escalated Tickets</p>
          </div>
          <div className="bg-yellow-50 rounded-xl p-6 border border-yellow-100">
            <p className="text-2xl font-bold text-yellow-600">{stats.resolved}</p>
            <p className="text-sm text-yellow-500">Resolved</p>
          </div>
          <div className="bg-green-50 rounded-xl p-6 border border-green-100">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-green-500">Completed</p>
          </div>
        </div>

        {/* Escalated Tickets Section - Same as before */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="bg-red-600 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Escalated Tickets ({escalatedTickets.length})
            </h2>
            <p className="text-red-100 text-sm mt-1">Requires immediate attention</p>
          </div>
          <div className="p-6">
            {escalatedTickets.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-gray-500">No escalated tickets</p>
                <p className="text-sm text-gray-400">All tickets are being handled normally</p>
              </div>
            ) : (
              <div className="space-y-4">
                {escalatedTickets.map((ticket) => (
                  <div key={ticket._id} className="border border-gray-100 rounded-xl p-5 hover:shadow-md transition">
                    {/* Ticket content - same as before */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <div className="text-2xl font-bold text-red-600">
                            #{ticket.displayNumber}
                          </div>
                          {ticket.isPriority && (
                            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full flex items-center">
                              <StarIcon className="h-3 w-3 mr-1" />
                              Priority
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {ticket.service?.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          Escalated: {new Date(ticket.escalatedAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          By: {ticket.escalatedBy?.fullName}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-red-50 rounded-xl p-4 mb-4 border-l-4 border-red-500">
                      <div className="flex items-start">
                        <ChatBubbleLeftRightIcon className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-800 mb-1">Escalation Reason:</p>
                          <p className="text-sm text-red-700">{ticket.escalationReason || ticket.reason || 'No reason provided'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                      <div>
                        <span className="text-gray-500">Original Counter:</span>
                        <p className="font-medium text-gray-900 mt-1">{ticket.originalCounterNumber || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Original Officer:</span>
                        <p className="font-medium text-gray-900 mt-1">{ticket.originalVerifierName || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Step:</span>
                        <p className="font-medium text-gray-900 mt-1 capitalize">{ticket.currentStep}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Customer:</span>
                        <p className="font-medium text-gray-900 mt-1 truncate">{ticket.customerInfo?.name || 'Walk-in'}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => showResolveDialog(ticket)}
                        disabled={actionLoading}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center justify-center"
                      >
                        <CheckCircleIcon className="h-5 w-5 mr-2" />
                        Resolve & Return to Queue
                      </button>
                      <button
                        onClick={() => showReturnDialog(ticket)}
                        disabled={actionLoading}
                        className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition flex items-center justify-center"
                      >
                        <ArrowUturnLeftIcon className="h-5 w-5 mr-2" />
                        Return to Original Counter
                      </button>
                      <button
                        onClick={() => viewReason(ticket)}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center justify-center"
                      >
                        <DocumentTextIcon className="h-5 w-5 mr-2" />
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reason Modal */}
      {showReasonModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Escalation Details</h2>
              <button
                onClick={() => setShowReasonModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Ticket Number</p>
                <p className="text-2xl font-bold text-gray-900">#{selectedTicket.displayNumber}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm font-medium text-red-800 mb-2">Escalation Reason</p>
                <p className="text-red-700">{selectedTicket.escalationReason || selectedTicket.reason || 'No reason provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Escalated By</p>
                <p className="text-gray-900">{selectedTicket.escalatedBy?.fullName}</p>
                <p className="text-xs text-gray-500">{selectedTicket.escalatedBy?.role}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Escalated At</p>
                <p className="text-gray-900">{new Date(selectedTicket.escalatedAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Original Counter</p>
                <p className="text-gray-900">{selectedTicket.originalCounterNumber || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Original Officer</p>
                <p className="text-gray-900">{selectedTicket.originalVerifierName || 'N/A'}</p>
              </div>
            </div>
            <div className="border-t px-6 py-4">
              <button
                onClick={() => setShowReasonModal(false)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorDashboard;