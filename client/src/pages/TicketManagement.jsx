import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useSocket } from '../context/SocketContext';

const TicketManagement = () => {
  const [tickets, setTickets] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [formData, setFormData] = useState({
    serviceId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: ''
  });
  const { socket } = useSocket();

  useEffect(() => {
    fetchData();
    
    // Listen for real-time updates
    if (socket) {
      socket.on('ticket-called', (ticket) => {
        toast.info(`Ticket ${ticket.ticketNumber} has been called`);
        fetchData();
      });
      
      socket.on('ticket-completed', (ticket) => {
        toast.success(`Ticket ${ticket.ticketNumber} completed`);
        fetchData();
      });
    }
    
    return () => {
      if (socket) {
        socket.off('ticket-called');
        socket.off('ticket-completed');
      }
    };
  }, [socket]);

  const fetchData = async () => {
    try {
      const [ticketsRes, servicesRes, countersRes] = await Promise.all([
        api.get('/tickets'),
        api.get('/services'),
        api.get('/counters')
      ]);
      setTickets(ticketsRes.data.tickets);
      setServices(servicesRes.data.services);
      setCounters(countersRes.data.counters);
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/tickets', formData);
      toast.success(`Ticket ${response.data.ticket.ticketNumber} created successfully`);
      fetchData();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create ticket');
    }
  };

  const handleCallTicket = async (ticketId) => {
    try {
      const response = await api.post(`/tickets/${ticketId}/call`);
      toast.success(`Ticket ${response.data.ticket.ticketNumber} called`);
      fetchData();
    } catch (error) {
      toast.error('Failed to call ticket');
    }
  };

  const handleCompleteTicket = async (ticketId) => {
    try {
      await api.put(`/tickets/${ticketId}/complete`);
      toast.success('Ticket completed');
      fetchData();
    } catch (error) {
      toast.error('Failed to complete ticket');
    }
  };

  const handleEscalateTicket = async (ticketId, reason) => {
    const reasonText = prompt('Please enter escalation reason:', '');
    if (reasonText) {
      try {
        await api.post(`/tickets/${ticketId}/escalate`, { reason: reasonText });
        toast.warning('Ticket escalated');
        fetchData();
      } catch (error) {
        toast.error('Failed to escalate ticket');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Waiting': return 'bg-yellow-100 text-yellow-800';
      case 'Serving': return 'bg-green-100 text-green-800';
      case 'Completed': return 'bg-blue-100 text-blue-800';
      case 'Escalated': return 'bg-red-100 text-red-800';
      case 'Priority': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'all') return true;
    return ticket.status.toLowerCase() === filter.toLowerCase();
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      serviceId: '',
      customerName: '',
      customerPhone: '',
      customerEmail: ''
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Management</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Create New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex space-x-2">
          {['all', 'waiting', 'serving', 'completed', 'escalated', 'priority'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg capitalize ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Counter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => (
                  <tr key={ticket._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{ticket.ticketNumber}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{ticket.service?.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{ticket.customerName || 'Walk-in'}</div>
                      {ticket.customerPhone && (
                        <div className="text-xs text-gray-500">{ticket.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {ticket.assignedCounter?.counterNumber || 'Not assigned'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(ticket.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {ticket.status === 'Waiting' && (
                        <button
                          onClick={() => handleCallTicket(ticket._id)}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Call
                        </button>
                      )}
                      {ticket.status === 'Serving' && (
                        <button
                          onClick={() => handleCompleteTicket(ticket._id)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Complete
                        </button>
                      )}
                      {ticket.status !== 'Completed' && ticket.status !== 'Escalated' && (
                        <button
                          onClick={() => handleEscalateTicket(ticket._id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Escalate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Create New Ticket</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreateTicket}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service *
                </label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">Select Service</option>
                  {services.filter(s => s.isActive).map(service => (
                    <option key={service._id} value={service._id}>
                      {service.name} ({service.estimatedTime} mins)
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Phone
                </label>
                <input
                  type="tel"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Email
                </label>
                <input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Optional"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketManagement;