import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  TicketIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  UserGroupIcon,
  CalendarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalTickets: 0,
    waitingTickets: 0,
    servingTickets: 0,
    completedTickets: 0,
    escalatedTickets: 0
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [dailyStats, setDailyStats] = useState({});

  useEffect(() => {
    fetchStats();
    fetchRecentTickets();
    fetchDailyStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/tickets');
      const tickets = response.data.tickets || [];
      
      setStats({
        totalTickets: tickets.length,
        waitingTickets: tickets.filter(t => t.status === 'Waiting').length,
        servingTickets: tickets.filter(t => t.status === 'Serving').length,
        completedTickets: tickets.filter(t => t.status === 'Completed').length,
        escalatedTickets: tickets.filter(t => t.status === 'Escalated').length
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchRecentTickets = async () => {
    try {
      const response = await api.get('/tickets?limit=5');
      setRecentTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch recent tickets:', error);
    }
  };

  const fetchDailyStats = async () => {
    try {
      const response = await api.get('/tickets/stats/today');
      setDailyStats(response.data.stats || {});
    } catch (error) {
      console.error('Failed to fetch daily stats:', error);
    }
  };

  const statCards = [
    { 
      title: 'Total Tickets', 
      value: stats.totalTickets, 
      icon: TicketIcon,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      trend: '+12%',
      trendUp: true
    },
    { 
      title: 'Waiting', 
      value: stats.waitingTickets, 
      icon: ClockIcon,
      bgColor: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
      trend: '+5%',
      trendUp: true
    },
    { 
      title: 'Serving', 
      value: stats.servingTickets, 
      icon: ArrowPathIcon,
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
      trend: '-2%',
      trendUp: false
    },
    { 
      title: 'Completed', 
      value: stats.completedTickets, 
      icon: CheckCircleIcon,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
      trend: '+8%',
      trendUp: true
    },
    { 
      title: 'Escalated', 
      value: stats.escalatedTickets, 
      icon: ChartBarIcon,
      bgColor: 'bg-red-50',
      iconColor: 'text-red-600',
      trend: '0%',
      trendUp: false
    }
  ];

  // Pie Chart Data
  const pieData = {
    labels: ['Waiting', 'Serving', 'Completed', 'Escalated'],
    datasets: [
      {
        data: [stats.waitingTickets, stats.servingTickets, stats.completedTickets, stats.escalatedTickets],
        backgroundColor: ['#F59E0B', '#10B981', '#8B5CF6', '#EF4444'],
        borderColor: ['#F59E0B', '#10B981', '#8B5CF6', '#EF4444'],
        borderWidth: 2,
        borderRadius: 10,
      }
    ]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { size: 11 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 }
      }
    }
  };

  // Bar Chart Data for daily activity
  const barData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Tickets Created',
        data: [12, 19, 15, 17, 14, 10, 8],
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 8,
      },
      {
        label: 'Tickets Completed',
        data: [10, 15, 12, 14, 11, 8, 6],
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderRadius: 8,
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { font: { size: 11 } }
      },
      tooltip: { backgroundColor: 'rgba(0, 0, 0, 0.8)' }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#E5E7EB' } },
      x: { grid: { display: false } }
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'Waiting': 'bg-yellow-100 text-yellow-800',
      'Serving': 'bg-green-100 text-green-800',
      'Completed': 'bg-blue-100 text-blue-800',
      'Escalated': 'bg-red-100 text-red-800',
      'Priority': 'bg-purple-100 text-purple-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Welcome back, {user?.fullName?.split(' ')[0]}!</h1>
            <p className="text-blue-100 text-sm">Here's what's happening with your queue system today.</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
            <CalendarIcon className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.bgColor} p-2.5 rounded-xl backdrop-blur-sm`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div className={`flex items-center space-x-1 text-xs ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                {stat.trendUp ? (
                  <ArrowTrendingUpIcon className="h-3 w-3" />
                ) : (
                  <ArrowTrendingDownIcon className="h-3 w-3" />
                )}
                <span>{stat.trend}</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-blue-50 p-2 rounded-lg">
              <ChartBarIcon className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Ticket Distribution</h2>
          </div>
          <div className="h-64">
            <Pie data={pieData} options={pieOptions} />
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="bg-blue-50 p-2 rounded-lg">
              <UserGroupIcon className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Weekly Activity</h2>
          </div>
          <div className="h-64">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="bg-blue-50 p-2 rounded-lg">
                <TicketIcon className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-base font-semibold text-gray-900">Recent Tickets</h2>
            </div>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              View All
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTickets.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                    No recent tickets
                  </td>
                </tr>
              ) : (
                recentTickets.map((ticket) => (
                  <tr key={ticket._id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{ticket.displayNumber || ticket.ticketNumber?.slice(-4)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{ticket.service?.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{ticket.customerInfo?.name || 'Walk-in'}</div>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{dailyStats.completedTickets || 0}</p>
          <p className="text-xs text-gray-600 mt-1">Completed Today</p>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{dailyStats.averageWaitTime || 0} min</p>
          <p className="text-xs text-gray-600 mt-1">Avg Wait Time</p>
        </div>
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.servingTickets}</p>
          <p className="text-xs text-gray-600 mt-1">Currently Serving</p>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.completedTickets}</p>
          <p className="text-xs text-gray-600 mt-1">Total Completed</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;