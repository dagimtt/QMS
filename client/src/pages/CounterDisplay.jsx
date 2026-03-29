import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const CounterDisplay = () => {
  const { counterId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [currentTicket, setCurrentTicket] = useState(null);
  const [waitingTickets, setWaitingTickets] = useState([]);
  const [counter, setCounter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCounterDetails();
    fetchWaitingTickets();

    if (socket && counterId) {
      socket.emit('join-counter', counterId);
      
      socket.on('ticket-called', (ticket) => {
        if (ticket.assignedCounter === counterId) {
          setCurrentTicket(ticket);
          toast.success(`Ticket ${ticket.ticketNumber} called`);
        }
      });
      
      socket.on('ticket-completed', (ticket) => {
        if (ticket.assignedCounter === counterId) {
          setCurrentTicket(null);
          fetchWaitingTickets();
        }
      });
      
      return () => {
        socket.off('ticket-called');
        socket.off('ticket-completed');
      };
    }
  }, [socket, counterId]);

  const fetchCounterDetails = async () => {
    try {
      const response = await api.get(`/counters/${counterId}`);
      setCounter(response.data.counter);
    } catch (error) {
      console.error('Failed to fetch counter:', error);
      toast.error('Counter not found');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitingTickets = async () => {
    try {
      const response = await api.get('/tickets', {
        params: { status: 'Waiting', counter: counterId }
      });
      setWaitingTickets(response.data.tickets);
    } catch (error) {
      console.error('Failed to fetch waiting tickets:', error);
    }
  };

  const handleCallNext = async () => {
    try {
      const response = await api.post(`/tickets/${counterId}/call-next`);
      if (response.data.success) {
        setCurrentTicket(response.data.ticket);
        toast.success(`Called ticket ${response.data.ticket.ticketNumber}`);
        fetchWaitingTickets();
      } else {
        toast.info(response.data.message || 'No tickets waiting');
      }
    } catch (error) {
      toast.error('Failed to call next ticket');
    }
  };

  const handleComplete = async () => {
    if (!currentTicket) return;
    
    try {
      await api.put(`/tickets/${currentTicket._id}/complete`);
      toast.success(`Ticket ${currentTicket.ticketNumber} completed`);
      setCurrentTicket(null);
      fetchWaitingTickets();
    } catch (error) {
      toast.error('Failed to complete ticket');
    }
  };

  const handleEscalate = async () => {
    if (!currentTicket) return;
    
    const reason = prompt('Please enter escalation reason:', '');
    if (reason) {
      try {
        await api.post(`/tickets/${currentTicket._id}/escalate`, { reason });
        toast.warning(`Ticket ${currentTicket.ticketNumber} escalated`);
        setCurrentTicket(null);
        fetchWaitingTickets();
      } catch (error) {
        toast.error('Failed to escalate ticket');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading counter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm border-b mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {counter?.name || `Counter ${counter?.counterNumber}`}
              </h1>
              <p className="text-gray-600 mt-1">Type: {counter?.type}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Logged in as</p>
              <p className="font-medium">{user?.fullName}</p>
              <p className="text-sm text-gray-500">{user?.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Currently Serving */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Currently Serving</h2>
            {currentTicket ? (
              <div className="text-center">
                <div className="text-7xl font-bold text-blue-600 mb-4">
                  {currentTicket.ticketNumber}
                </div>
                <div className="space-y-2 mb-6">
                  <p className="text-gray-600">Service: {currentTicket.service?.name}</p>
                  <p className="text-gray-600">Customer: {currentTicket.customerName || 'Walk-in'}</p>
                  {currentTicket.customerPhone && (
                    <p className="text-gray-600">Phone: {currentTicket.customerPhone}</p>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleComplete}
                    className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    Complete
                  </button>
                  <button
                    onClick={handleEscalate}
                    className="flex-1 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition font-medium"
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

          {/* Queue */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Next in Queue</h2>
              <button
                onClick={handleCallNext}
                disabled={waitingTickets.length === 0}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Call Next Ticket
              </button>
            </div>
            
            {waitingTickets.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p className="text-gray-500">No customers waiting</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitingTickets.slice(0, 10).map((ticket, index) => (
                  <div
                    key={ticket._id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-blue-50 border-l-4 border-blue-600' : 'bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-mono text-lg font-bold text-gray-900">
                        {ticket.ticketNumber}
                      </div>
                      <div className="text-sm text-gray-600">{ticket.service?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {new Date(ticket.createdAt).toLocaleTimeString()}
                      </div>
                      {ticket.isPriority && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">
                          Priority
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {waitingTickets.length > 10 && (
                  <p className="text-center text-gray-500 text-sm mt-4">
                    +{waitingTickets.length - 10} more waiting
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounterDisplay;