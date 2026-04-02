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
  XCircleIcon
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

  // Check if user has access to this page
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
    const notes = prompt(
      `Returning ticket #${ticket.displayNumber} to original counter\n\n` +
      `Original Counter: ${ticket.originalCounterNumber || ticket.escalationDetails?.originalCounter?.counterNumber || 'N/A'}\n` +
      `Original Officer: ${ticket.originalVerifierName || ticket.escalationDetails?.originalVerifier?.fullName || 'N/A'}\n\n` +
      `Enter return notes:`,
      'Returning to original counter for further handling'
    );
    if (notes !== null && notes.trim() !== '') {
      handleResolve(ticket._id, 'return', notes);
    } else if (notes !== null) {
      toast.error('Return notes are required');
    }
  };

  const viewReason = (ticket) => {
    setSelectedTicket(ticket);
    setShowReasonModal(true);
  };

  if (!isAdmin && !isSupervisor) {
    return null; // Will redirect via useEffect
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supervisor Dashboard</h1>
              <p className="text-gray-600 mt-1">Zone: {zone?.name} ({zone?.code})</p>
              <p className="text-sm text-gray-500 mt-1">Manage escalated tickets and monitor operations</p>
            </div>
            <button
              onClick={fetchDashboard}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <ArrowPathIcon className="h-5 w-5 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-sm text-gray-600">Total Tickets</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
            <p className="text-2xl font-bold text-red-600">{stats.escalated}</p>
            <p className="text-sm text-gray-600">Escalated Tickets</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <p className="text-2xl font-bold text-yellow-600">{stats.resolved}</p>
            <p className="text-sm text-gray-600">Resolved</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
        </div>

        {/* Escalated Tickets Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-red-600 px-6 py-4">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <ExclamationTriangleIcon className="h-6 w-6 mr-2" />
              Escalated Tickets ({escalatedTickets.length})
            </h2>
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
                  <div key={ticket._id} className="border rounded-lg p-4 hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          #{ticket.displayNumber}
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
                    
                    {/* Escalation Reason */}
                    <div className="bg-red-50 rounded-lg p-3 mb-3 border-l-4 border-red-500">
                      <p className="text-sm font-semibold text-red-800 mb-1">Escalation Reason:</p>
                      <p className="text-sm text-red-700">{ticket.escalationReason || ticket.reason || 'No reason provided'}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                      <div>
                        <span className="text-gray-500">Original Counter:</span>
                        <span className="ml-2 font-medium">{ticket.originalCounterNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Original Officer:</span>
                        <span className="ml-2 font-medium">{ticket.originalVerifierName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Step:</span>
                        <span className="ml-2 font-medium">{ticket.currentStep}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Customer:</span>
                        <span className="ml-2 font-medium">{ticket.customerInfo?.name || 'Walk-in'}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-3">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Escalation Details</h2>
              <button
                onClick={() => setShowReasonModal(false)}
                className="text-gray-500 hover:text-gray-700"
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