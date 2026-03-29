import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalTickets: 0,
    waitingTickets: 0,
    servingTickets: 0,
    completedTickets: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch ticket statistics
      const response = await api.get('/tickets');
      const tickets = response.data.tickets;

      setStats({
        totalTickets: tickets.length,
        waitingTickets: tickets.filter(t => t.status === 'Waiting').length,
        servingTickets: tickets.filter(t => t.status === 'Serving').length,
        completedTickets: tickets.filter(t => t.status === 'Completed').length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const statCards = [
    { title: 'Total Tickets', value: stats.totalTickets, color: 'bg-blue-500', icon: '🎫' },
    { title: 'Waiting', value: stats.waitingTickets, color: 'bg-yellow-500', icon: '⏳' },
    { title: 'Serving', value: stats.servingTickets, color: 'bg-green-500', icon: '🔄' },
    { title: 'Completed', value: stats.completedTickets, color: 'bg-purple-500', icon: '✅' },
  ];

  // Chart data
  const pieData = {
    labels: ['Waiting', 'Serving', 'Completed'],
    datasets: [
      {
        label: 'Tickets',
        data: [stats.waitingTickets, stats.servingTickets, stats.completedTickets],
        backgroundColor: ['#FBBF24', '#10B981', '#8B5CF6'],
        borderColor: ['#FBBF24', '#10B981', '#8B5CF6'],
        borderWidth: 1
      }
    ]
  };

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom'
      },
      tooltip: {
        enabled: true
      }
    }
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-gray-600">Here's what's happening with your queue system today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} w-12 h-12 rounded-full flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Status</h2>
          <Pie data={pieData} options={pieOptions} />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <p className="text-gray-600 text-center py-8">
              No recent activity to display.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;