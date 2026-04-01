import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const CounterDashboard = () => {
  const { counterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [counter, setCounter] = useState(null);
  const [currentTicket, setCurrentTicket] = useState(null);
  const [waitingTickets, setWaitingTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    waiting: 0,
    serving: 0,
    noShow: 0
  });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    
    // Join counter room for real-time updates
    if (socket && counterId) {
      socket.emit('join-counter', counterId);
      
      socket.on('ticket-called', (ticket) => {
        if (ticket.assignedCounter === counterId) {
          setCurrentTicket(ticket);
          fetchDashboardData();
          toast.success(`Ticket ${ticket.displayNumber || ticket.ticketNumber?.slice(-4)} called`);
        }
      });
      
      socket.on('ticket-completed', () => {
        fetchDashboardData();
      });
      
      socket.on('ticket-absent', () => {
        fetchDashboardData();
      });
      
      socket.on('audio-announcement', (data) => {
        if (window.speechSynthesis) {
          const message = `Ticket number ${data.ticketNumber}, please proceed to window ${data.counterNumber}`;
          const utterance = new SpeechSynthesisUtterance(message);
          utterance.lang = 'en-US';
          utterance.rate = 0.9;
          window.speechSynthesis.speak(utterance);
        }
      });
      
      return () => {
        socket.off('ticket-called');
        socket.off('ticket-completed');
        socket.off('ticket-absent');
        socket.off('audio-announcement');
      };
    }
  }, [socket, counterId]);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get(`/tickets/counter/${counterId}/dashboard`);
      setCounter(response.data.counter);
      setCurrentTicket(response.data.currentTicket);
      setWaitingTickets(response.data.waitingTickets || []);
      setStats(response.data.stats || { total: 0, completed: 0, waiting: 0, serving: 0, noShow: 0 });
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to load counter data');
      if (error.response?.status === 404) {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

const handleCallNext = async () => {
  setActionLoading(true);
  try {
    // Use the correct endpoint format
    const response = await api.post(`/tickets/${counterId}/call-next`);
    
    if (response.data.success) {
      setCurrentTicket(response.data.ticket);
      fetchDashboardData();
      toast.success(`Ticket ${response.data.ticket.displayNumber} called`);
      
      // Play audio announcement
      if (window.speechSynthesis) {
        const message = `Ticket number ${response.data.ticket.displayNumber}, please proceed to ${counter?.name || 'Window ' + counter?.counterNumber}`;
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      }
    } else {
      toast.info(response.data.message || 'No tickets waiting');
    }
  } catch (error) {
    console.error('Call next error:', error);
    toast.error(error.response?.data?.message || 'Failed to call next ticket');
  } finally {
    setActionLoading(false);
  }
};

  const handleComplete = async () => {
    if (!currentTicket) return;
    
    setActionLoading(true);
    try {
      const response = await api.put(`/tickets/${currentTicket._id}/complete`);
      if (response.data.success) {
        toast.success(`Ticket ${response.data.ticket.displayNumber} completed`);
        setCurrentTicket(null);
        fetchDashboardData();
      }
    } catch (error) {
      toast.error('Failed to complete ticket');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAbsent = async () => {
    if (!currentTicket) return;
    
    if (window.confirm(`Mark ticket ${currentTicket.displayNumber} as absent? This will move to the next ticket.`)) {
      setActionLoading(true);
      try {
        const response = await api.post(`/tickets/${currentTicket._id}/absent`);
        if (response.data.success) {
          toast.warning(`Ticket ${response.data.ticket.displayNumber} marked as absent`);
          setCurrentTicket(null);
          fetchDashboardData();
        }
      } catch (error) {
        toast.error('Failed to mark ticket as absent');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleEscalate = async () => {
    if (!currentTicket) return;
    
    const reason = prompt('Please enter escalation reason:', 'Customer needs supervisor assistance');
    if (reason) {
      setActionLoading(true);
      try {
        const response = await api.post(`/tickets/${currentTicket._id}/escalate`, { reason });
        if (response.data.success) {
          toast.warning(`Ticket ${response.data.ticket.displayNumber} escalated`);
          setCurrentTicket(null);
          fetchDashboardData();
        }
      } catch (error) {
        toast.error('Failed to escalate ticket');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Waiting': 'bg-yellow-100 text-yellow-800',
      'Serving': 'bg-green-100 text-green-800',
      'Completed': 'bg-blue-100 text-blue-800',
      'Escalated': 'bg-red-100 text-red-800',
      'Priority': 'bg-purple-100 text-purple-800',
      'No-Show': 'bg-gray-100 text-gray-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading counter dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {counter?.name || `Counter ${counter?.counterNumber}`}
              </h1>
              <p className="text-gray-600 mt-1">
                Type: {counter?.type} | Status: <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${counter?.status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {counter?.status}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">{user?.fullName}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            <p className="text-sm text-gray-600">Total Today</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.waiting}</p>
            <p className="text-sm text-gray-600">Waiting</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.serving}</p>
            <p className="text-sm text-gray-600">Serving</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{stats.noShow}</p>
            <p className="text-sm text-gray-600">No-Show</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Currently Serving Section */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Currently Serving</h2>
            </div>
            <div className="p-6">
              {currentTicket ? (
                <div className="text-center">
                  <div className="text-8xl font-bold text-blue-600 mb-4">
                    {currentTicket.displayNumber}
                  </div>
                  <div className="space-y-2 mb-6">
                    <p className="text-gray-600">
                      <span className="font-medium">Service:</span> {currentTicket.service?.name}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Customer:</span> {currentTicket.customerInfo?.name || 'Walk-in'}
                    </p>
                    {currentTicket.customerInfo?.phone && (
                      <p className="text-gray-600">
                        <span className="font-medium">Phone:</span> {currentTicket.customerInfo.phone}
                      </p>
                    )}
                    <p className="text-gray-600">
                      <span className="font-medium">Serving Time:</span> {currentTicket.servingTime || 0} min
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={handleComplete}
                      disabled={actionLoading}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Complete
                    </button>
                    <button
                      onClick={handleAbsent}
                      disabled={actionLoading}
                      className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition disabled:opacity-50"
                    >
                      Absent
                    </button>
                    <button
                      onClick={handleEscalate}
                      disabled={actionLoading}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      Escalate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <p className="text-gray-500 text-lg">No ticket being served</p>
                  <p className="text-gray-400 mt-2">Click "Call Next" to serve the next customer</p>
                </div>
              )}
            </div>
          </div>

          {/* Queue Section */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gray-800 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Next in Queue</h2>
              <button
                onClick={handleCallNext}
                disabled={actionLoading || waitingTickets.length === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Call Next Ticket
              </button>
            </div>
            <div className="p-6">
              {waitingTickets.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="text-gray-500">No customers waiting</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {waitingTickets.map((ticket, index) => (
                    <div
                      key={ticket._id}
                      className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                        index === 0 ? 'bg-blue-50 border-l-4 border-blue-600' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl font-bold text-gray-700">
                          {ticket.displayNumber}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {ticket.service?.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Waiting: {ticket.waitingTime} min
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {ticket.isPriority && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Priority
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Tickets Section */}
        <div className="mt-6 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-800 px-6 py-4">
            <h2 className="text-xl font-semibold text-white">Recent Tickets</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {waitingTickets.slice(0, 5).map((ticket) => (
                  <tr key={ticket._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-lg font-bold text-gray-900">{ticket.displayNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ticket.service?.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ticket.customerInfo?.name || 'Walk-in'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
                {waitingTickets.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                      No recent tickets
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
{waitingTickets.length > 0 && (
  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
    <p className="text-sm text-blue-800">
      📋 Queue Status: {waitingTickets.length} ticket(s) waiting
    </p>
    {waitingTickets[0] && (
      <p className="text-xs text-blue-600 mt-1">
        Next ticket: #{waitingTickets[0].displayNumber} (Waiting {waitingTickets[0].waitingTime} min)
      </p>
    )}
  </div>
)}
      </div>
      
    </div>
  );
};

export default CounterDashboard;