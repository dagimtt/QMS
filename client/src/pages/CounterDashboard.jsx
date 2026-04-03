import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  UserIcon, 
  ClockIcon, 
  PhoneIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  QueueListIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ArrowRightIcon,
  BellIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';

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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [showTimer, setShowTimer] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    fetchDashboardData();
    
    if (socket && counterId) {
      socket.emit('join-counter', counterId);
      
      socket.on('ticket-called', (ticket) => {
        if (ticket.assignedCounter === counterId) {
          setCurrentTicket(ticket);
          fetchDashboardData();
          toast.success(`Ticket ${ticket.displayNumber || ticket.ticketNumber?.slice(-4)} called`, {
            icon: '🔔',
            style: { background: '#10B981', color: '#fff' }
          });
        }
      });
      
      socket.on('ticket-completed', () => {
        fetchDashboardData();
        toast.success('Ticket completed successfully!', {
          icon: '✅',
          style: { background: '#10B981', color: '#fff' }
        });
      });
      
      socket.on('ticket-absent', () => {
        fetchDashboardData();
        toast.warning('Ticket marked as absent', {
          icon: '⚠️',
          style: { background: '#F59E0B', color: '#fff' }
        });
      });
      
      socket.on('audio-announcement', (data) => {
        if (audioEnabled && window.speechSynthesis) {
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
  }, [socket, counterId, audioEnabled]);

  // Timer for serving ticket
  useEffect(() => {
    let interval;
    if (currentTicket && currentTicket.calledAt) {
      setShowTimer(true);
      interval = setInterval(() => {
        const elapsed = Math.floor((new Date() - new Date(currentTicket.calledAt)) / 1000);
        setSecondsElapsed(elapsed);
      }, 1000);
    } else {
      setShowTimer(false);
      setSecondsElapsed(0);
    }
    return () => clearInterval(interval);
  }, [currentTicket]);

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
      const response = await api.post(`/tickets/${counterId}/call-next`);
      
      if (response.data.success) {
        setCurrentTicket(response.data.ticket);
        fetchDashboardData();
        toast.success(`Ticket ${response.data.ticket.displayNumber} called`, {
          icon: '🔔',
          style: { background: '#3B82F6', color: '#fff' }
        });
        
        if (audioEnabled && window.speechSynthesis) {
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
        toast.success(`Ticket ${response.data.ticket.displayNumber} completed!`, {
          icon: '🎉',
          style: { background: '#10B981', color: '#fff' }
        });
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
  if (reason && reason.trim()) {
    setActionLoading(true);
    try {
      const response = await api.post(`/tickets/${currentTicket._id}/escalate`, { reason: reason.trim() });
      if (response.data.success) {
        toast.warning(`Ticket ${response.data.ticket.displayNumber} escalated. Reason: ${reason}`, {
          icon: '🚨',
          style: { background: '#EF4444', color: '#fff' }
        });
        // Clear current ticket immediately
        setCurrentTicket(null);
        // Refresh dashboard data
        await fetchDashboardData();
      }
    } catch (error) {
      console.error('Escalate error:', error);
      toast.error(error.response?.data?.message || 'Failed to escalate ticket');
    } finally {
      setActionLoading(false);
    }
  } else if (reason !== null) {
    toast.error('Escalation reason is required');
  }
};
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading counter dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md shadow-sm border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <AcademicCapIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {counter?.name || `Counter ${counter?.counterNumber}`}
                </h1>
                <div className="flex items-center space-x-3 mt-1">
                  <span className="text-sm text-gray-500">Type: {counter?.type}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    counter?.status === 'Available' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {counter?.status}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setAudioEnabled(!audioEnabled)}
                className={`p-2 rounded-lg transition-all ${audioEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                title={audioEnabled ? 'Audio On' : 'Audio Off'}
              >
                {audioEnabled ? <SpeakerWaveIcon className="h-5 w-5" /> : <SpeakerXMarkIcon className="h-5 w-5" />}
              </button>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{user?.fullName}</p>
                <p className="text-sm text-gray-500">{user?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Cards */}
        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Currently Serving Section */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-gray-100">
      <h2 className="text-base font-medium text-gray-700 flex items-center">
        <BellIcon className="h-4 w-4 mr-2 text-gray-500" />
        Currently Serving
      </h2>
    </div>
    <div className="p-6">
      {currentTicket ? (
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-100 rounded-full opacity-30 animate-pulse"></div>
            <div className="text-6xl font-bold text-blue-500 mb-3 relative">
              {currentTicket.displayNumber}
            </div>
          </div>
          {showTimer && (
            <div className="inline-flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-full mb-5">
              <ClockIcon className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-600">
                Serving: {formatTime(secondsElapsed)}
              </span>
            </div>
          )}
          <div className="space-y-2 mb-6 bg-gray-50/50 rounded-lg p-4">
            <div className="flex items-center justify-center space-x-2">
              <span className="text-xs text-gray-500">Service:</span>
              <span className="text-sm font-medium text-gray-800">{currentTicket.service?.name}</span>
            </div>
            
            {currentTicket.customerInfo?.phone && (
              <div className="flex items-center justify-center space-x-2">
                <PhoneIcon className="h-4 w-4 text-gray-400" />
                <span className="text-xs text-gray-500">Phone:</span>
                <span className="text-sm font-medium text-gray-800">{currentTicket.customerInfo.phone}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 font-medium text-sm flex items-center justify-center border border-green-200"
            >
              <CheckCircleIcon className="h-4 w-4 mr-1.5" />
              Complete
            </button>
            <button
              onClick={handleAbsent}
              disabled={actionLoading}
              className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 font-medium text-sm flex items-center justify-center border border-gray-200"
            >
              <XCircleIcon className="h-4 w-4 mr-1.5" />
              Absent
            </button>
            <button
              onClick={handleEscalate}
              disabled={actionLoading}
              className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 font-medium text-sm flex items-center justify-center border border-red-200"
            >
              <ExclamationTriangleIcon className="h-4 w-4 mr-1.5" />
              Escalate
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <UserIcon className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No ticket being served</p>
          <p className="text-gray-400 text-xs mt-1">Click "Call Next" to serve</p>
        </div>
      )}
    </div>
  </div>

  {/* Queue Section */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-5 py-3 border-b border-gray-100 flex justify-between items-center">
      <div>
        <h2 className="text-base font-medium text-gray-700 flex items-center">
          <QueueListIcon className="h-4 w-4 mr-2 text-gray-500" />
          Next in Queue
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">{waitingTickets.length} customer(s) waiting</p>
      </div>
      <button
        onClick={handleCallNext}
        disabled={actionLoading || waitingTickets.length === 0}
        className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-1.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center border border-blue-200"
      >
        <ArrowRightIcon className="h-3.5 w-3.5 mr-1.5" />
        Call Next
      </button>
    </div>
    <div className="p-5">
      {waitingTickets.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <QueueListIcon className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">No customers waiting</p>
          <p className="text-gray-400 text-xs mt-1">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {waitingTickets.map((ticket, index) => (
            <div
              key={ticket._id}
              className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
                index === 0 
                  ? 'bg-blue-50/50 border-l-3 border-l-blue-400' 
                  : 'bg-gray-50/50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`text-2xl font-bold ${index === 0 ? 'text-blue-600' : 'text-gray-700'}`}>
                  {ticket.displayNumber}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {ticket.service?.name}
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <ClockIcon className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      Waiting: {ticket.waitingTime} min
                    </span>
                  </div>
                
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {ticket.isPriority && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full font-medium">
                    Priority
                  </span>
                )}
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${getStatusBadge(ticket.status)}`}>
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

        {/* Queue Status Bar */}
        {waitingTickets.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <QueueListIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">
                    Queue Status: {waitingTickets.length} ticket(s) waiting
                  </p>
                  {waitingTickets[0] && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Next ticket: #{waitingTickets[0].displayNumber} (Waiting {waitingTickets[0].waitingTime} min)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-32 h-2 bg-blue-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (waitingTickets.length / 20) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-blue-600">
                  {waitingTickets.length} in queue
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CounterDashboard;