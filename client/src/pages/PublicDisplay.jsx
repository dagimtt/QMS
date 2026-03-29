import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

const PublicDisplay = () => {
  const { zoneId } = useParams();
  const { socket } = useSocket();
  const [currentTickets, setCurrentTickets] = useState([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [zone, setZone] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    fetchZoneInfo();
    fetchQueueStatus();

    if (socket && zoneId) {
      socket.emit('join-zone', zoneId);
      
      socket.on('queue-update', (data) => {
        fetchQueueStatus();
        setLastUpdate(new Date());
      });
      
      socket.on('audio-announcement', (data) => {
        // Trigger audio announcement
        if (data.zoneId === zoneId) {
          playAnnouncement(data.ticketNumber, data.counterNumber);
        }
      });
      
      return () => {
        socket.off('queue-update');
        socket.off('audio-announcement');
      };
    }
  }, [socket, zoneId]);

  const fetchZoneInfo = async () => {
    try {
      const response = await api.get(`/zones/${zoneId}`);
      setZone(response.data.zone);
    } catch (error) {
      console.error('Failed to fetch zone:', error);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const response = await api.get(`/tickets/queue/${zoneId}`);
      setCurrentTickets(response.data.serving || []);
      const waiting = response.data.waiting?.reduce((sum, w) => sum + w.count, 0) || 0;
      setWaitingCount(waiting);
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
    }
  };

  const playAnnouncement = (ticketNumber, counterNumber) => {
    if ('speechSynthesis' in window) {
      const message = `Ticket number ${ticketNumber}, please proceed to window ${counterNumber}`;
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQueueStatus();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-blue-600 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-2xl font-bold text-center">
            {zone?.name || 'Queue Management System'}
          </h1>
          <p className="text-center text-blue-100 mt-1">Service Status Board</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-5xl font-bold text-yellow-400">{waitingCount}</div>
            <div className="text-gray-400 mt-2">Waiting Customers</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <div className="text-5xl font-bold text-green-400">{currentTickets.length}</div>
            <div className="text-gray-400 mt-2">Currently Serving</div>
          </div>
        </div>

        {/* Currently Serving */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Currently Serving</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentTickets.map((ticket) => (
              <div key={ticket._id} className="bg-gray-800 rounded-lg p-4">
                <div className="text-3xl font-mono font-bold text-green-400 mb-2">
                  {ticket.ticketNumber}
                </div>
                <div className="text-gray-300">Window: {ticket.assignedCounter?.counterNumber}</div>
                <div className="text-gray-400 text-sm mt-1">{ticket.service?.name}</div>
              </div>
            ))}
            {currentTickets.length === 0 && (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-500">
                No tickets being served at the moment
              </div>
            )}
          </div>
        </div>

        {/* Queue Summary */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Queue Summary</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium">Service</th>
                  <th className="px-6 py-3 text-right text-sm font-medium">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {currentTickets.length > 0 ? (
                  currentTickets.map((ticket) => (
                    <tr key={ticket._id}>
                      <td className="px-6 py-4">{ticket.service?.name}</td>
                      <td className="px-6 py-4 text-right">1</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="2" className="px-6 py-8 text-center text-gray-500">
                      No active queues
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default PublicDisplay;