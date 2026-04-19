import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  TrophyIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const PerformanceDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');
  const [kpiData, setKpiData] = useState(null);
  const [topPerformers, setTopPerformers] = useState([]);
  const [performanceByRole, setPerformanceByRole] = useState([]);
  const [overallStats, setOverallStats] = useState({});
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [officerDetails, setOfficerDetails] = useState(null);
  const [showOfficerModal, setShowOfficerModal] = useState(false);

  useEffect(() => {
    fetchKPIData();
  }, [period]);

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/performance/dashboard', {
        params: { period }
      });
      setKpiData(response.data);
      setTopPerformers(response.data.topPerformers || []);
      setPerformanceByRole(response.data.performanceByRole || []);
      setOverallStats(response.data.overallStats || {});
    } catch (error) {
      console.error('Failed to fetch KPI data:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficerDetails = async (officerId) => {
    try {
      const response = await api.get(`/performance/officer/${officerId}/daily`);
      setOfficerDetails(response.data);
      setShowOfficerModal(true);
    } catch (error) {
      console.error('Failed to fetch officer details:', error);
      toast.error('Failed to load officer details');
    }
  };

  const getRoleColor = (role) => {
    const colors = {
      'Verifier': 'bg-blue-100 text-blue-800',
      'Cashier': 'bg-green-100 text-green-800',
      'Validator': 'bg-purple-100 text-purple-800',
      'Authorizer': 'bg-orange-100 text-orange-800',
      'Supervisor': 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  // Chart data for performance by role
  const roleChartData = {
    labels: performanceByRole.map(p => p.role),
    datasets: [
      {
        label: 'Total Tickets',
        data: performanceByRole.map(p => p.totalTickets),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Avg Service Time (min)',
        data: performanceByRole.map(p => p.avgServiceTime),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
      },
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading performance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
              <ChartBarIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Performance Dashboard</h1>
              <p className="text-gray-600 mt-1">Track officer KPIs and service metrics</p>
            </div>
          </div>
        </div>

        {/* Period Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Time Period:</span>
            </div>
            <div className="flex space-x-2">
              {['day', 'week', 'month'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    period === p
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={fetchKPIData}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Overall Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Tickets</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{overallStats.totalTickets || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Officers</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{overallStats.totalOfficers || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <UserGroupIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Service Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{overallStats.overallAvgServiceTime || 0} min</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                <ClockIcon className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Avg Wait Time</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{overallStats.overallAvgWaitTime || 0} min</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <ArrowTrendingUpIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance by Role</h2>
            <div className="h-80">
              <Bar data={roleChartData} options={chartOptions} />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrophyIcon className="h-5 w-5 mr-2 text-yellow-500" />
              Top Performers
            </h2>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <button
                  key={performer.officerName}
                  onClick={() => fetchOfficerDetails(performer.officerId)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500 text-white' :
                      index === 1 ? 'bg-gray-400 text-white' :
                      index === 2 ? 'bg-orange-500 text-white' :
                      'bg-gray-300 text-gray-600'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{performer.officerName}</p>
                      <p className="text-xs text-gray-500">{performer.officerRole}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{performer.ticketsCompleted}</p>
                    <p className="text-xs text-gray-500">tickets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{performer.avgServiceTime} min</p>
                    <p className="text-xs text-gray-500">avg time</p>
                  </div>
                </button>
              ))}
              {topPerformers.length === 0 && (
                <p className="text-center text-gray-500 py-8">No data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Performance by Role Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Performance by Role</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tickets</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Service Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Wait Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {performanceByRole.map((role) => (
                  <tr key={role.role} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getRoleColor(role.role)}`}>
                        {role.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{role.totalTickets}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{role.avgServiceTime} min</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{role.avgWaitTime} min</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 rounded-full h-2"
                          style={{ width: `${Math.min(100, (role.totalTickets / Math.max(...performanceByRole.map(r => r.totalTickets))) * 100)}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Officer Details Modal */}
      {showOfficerModal && officerDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{officerDetails.officer?.name}</h2>
                <p className="text-sm text-gray-500">{officerDetails.officer?.role} • {officerDetails.officer?.email}</p>
              </div>
              <button
                onClick={() => setShowOfficerModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {/* Overall KPI */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{officerDetails.overallKPI?.totalTickets || 0}</p>
                  <p className="text-xs text-gray-600">Total Tickets</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{officerDetails.overallKPI?.avgServiceTime || 0} min</p>
                  <p className="text-xs text-gray-600">Avg Service Time</p>
                </div>
              </div>

              {/* Daily Stats */}
              <h3 className="font-semibold text-gray-900 mb-3">Daily Performance</h3>
              <div className="space-y-2">
                {officerDetails.dailyStats?.map((day) => (
                  <div key={day._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(day.date).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500">{day.ticketsCompleted} tickets</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-700">{day.avgServiceTime} min avg</p>
                      <p className="text-xs text-gray-500">service time</p>
                    </div>
                  </div>
                ))}
                {(!officerDetails.dailyStats || officerDetails.dailyStats.length === 0) && (
                  <p className="text-center text-gray-500 py-4">No daily data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;