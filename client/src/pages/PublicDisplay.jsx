import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import { 
  ClockIcon, 
  UserGroupIcon, 
  BuildingStorefrontIcon,
  ArrowPathIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import logoHorizontalWhite from '../assets/ICS Logo - Abberviation Version - Horizontal - White.png';

const PublicDisplay = () => {
  const { zoneId } = useParams();
  const { socket } = useSocket();
  const [servingTickets, setServingTickets] = useState([]);
  const [zone, setZone] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchZoneInfo();
    fetchServingTickets();

    if (socket && zoneId) {
      socket.emit('join-zone', zoneId);
      
      socket.on('queue-update', () => {
        fetchServingTickets();
        setLastUpdate(new Date());
      });
      
      socket.on('ticket-called', () => {
        fetchServingTickets();
        setLastUpdate(new Date());
      });
      
      socket.on('ticket-completed', () => {
        fetchServingTickets();
        setLastUpdate(new Date());
      });
      
      return () => {
        socket.off('queue-update');
        socket.off('ticket-called');
        socket.off('ticket-completed');
      };
    }

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchServingTickets();
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [zoneId, socket, autoRefresh]);

  const fetchZoneInfo = async () => {
    try {
      const response = await api.get(`/zones/${zoneId}`);
      setZone(response.data.zone);
    } catch (error) {
      console.error('Failed to fetch zone:', error);
    }
  };

  const fetchServingTickets = async () => {
    try {
      const response = await api.get(`/tickets/zone/${zoneId}/queue`);
      setServingTickets(response.data.serving || []);
    } catch (error) {
      console.error('Failed to fetch serving tickets:', error);
    }
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Serving': return 'bg-green-100 text-green-800 border-green-200';
      case 'Waiting': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!zone) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading display...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Statistics Cards */}
        

        {/* Main Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Currently Called Tickets</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticket #
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Counter
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Called Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {servingTickets.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                          <UserGroupIcon className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500">No tickets currently being served</p>
                        <p className="text-sm text-gray-400 mt-1">Waiting for tickets to be called</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  servingTickets.map((ticket, index) => (
                    <tr 
                      key={ticket._id} 
                      className={`hover:bg-gray-50 transition-colors duration-150 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-blue-600 font-bold text-sm">#</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">
                            {ticket.displayNumber || ticket.ticketNumber?.slice(-4)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-gray-100 rounded-md flex items-center justify-center mr-2">
                            <BuildingStorefrontIcon className="h-3.5 w-3.5 text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-700">
                            {ticket.assignedCounter?.name || `Counter ${ticket.assignedCounter?.counterNumber}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-600">{ticket.service?.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">
                            {ticket.calledAt ? formatTime(ticket.calledAt) : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(ticket.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current"></span>
                          {ticket.currentStep}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
       
      </div>

      {/* Auto-refresh indicator */}
      <div className="fixed bottom-4 right-4">
        <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-gray-100">
          <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
          <span className="text-xs text-gray-500">
            {autoRefresh ? 'Live' : 'Paused'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PublicDisplay;