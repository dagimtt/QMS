import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  TrophyIcon
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
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const OfficerPerformance = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [zone, setZone] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [officerDetails, setOfficerDetails] = useState(null);
  const [period, setPeriod] = useState('week');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchOfficers();
  }, [zoneId]);

  const fetchOfficers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/performance/zone/${zoneId}/officers`);
      setZone(response.data.zone);
      setOfficers(response.data.officers);
    } catch (error) {
      console.error('Failed to fetch officers:', error);
      toast.error('Failed to load officer data');
    } finally {
      setLoading(false);
    }
  };

  const fetchOfficerDetails = async (officerId) => {
    try {
      const response = await api.get(`/performance/officer/${officerId}/detailed`, {
        params: { period }
      });
      setOfficerDetails(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Failed to fetch officer details:', error);
      toast.error('Failed to load officer details');
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      'Verifier': 'bg-blue-100 text-blue-800',
      'Cashier': 'bg-green-100 text-green-800',
      'Validator': 'bg-purple-100 text-purple-800',
      'Authorizer': 'bg-orange-100 text-orange-800',
      'Supervisor': 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getPerformanceColor = (efficiency) => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const filteredOfficers = officers.filter(officer => {
    const matchesSearch = officer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         officer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || officer.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const dailyChartData = officerDetails?.dailyBreakdown ? {
    labels: officerDetails.dailyBreakdown.map(d => d.date),
    datasets: [
      {
        label: 'Step Completions',
        data: officerDetails.dailyBreakdown.map(d => d.completions),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Avg Time (seconds)',
        data: officerDetails.dailyBreakdown.map(d => d.avgTime),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      }
    ]
  } : null;

  const stepChartData = officerDetails?.stepBreakdown ? {
    labels: officerDetails.stepBreakdown.map(s => s.step),
    datasets: [
      {
        label: 'Completions',
        data: officerDetails.stepBreakdown.map(s => s.count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.6)',
          'rgba(16, 185, 129, 0.6)',
          'rgba(245, 158, 11, 0.6)',
          'rgba(139, 92, 246, 0.6)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(139, 92, 246)'
        ],
        borderWidth: 1,
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading officer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg">
                <UserGroupIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Officer Performance</h1>
                <p className="text-gray-600 mt-1">Zone: {zone?.name} ({zone?.code})</p>
              </div>
            </div>
            <button
              onClick={fetchOfficers}
              className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
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
            <div className="flex items-center space-x-2">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search officers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="Verifier">Verifier</option>
              <option value="Cashier">Cashier</option>
              <option value="Validator">Validator</option>
              <option value="Authorizer">Authorizer</option>
            </select>
          </div>
        </div>

        {/* Officers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOfficers.map((officer) => (
            <div
              key={officer.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition cursor-pointer"
              onClick={() => fetchOfficerDetails(officer.id)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                      {officer.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{officer.name}</h3>
                      <p className="text-sm text-gray-500">{officer.email}</p>
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full mt-1 ${getRoleBadgeColor(officer.role)}`}>
                        {officer.role}
                      </span>
                    </div>
                  </div>
                  <div className={`text-right ${getPerformanceColor(officer.efficiency)}`}>
                    <TrophyIcon className="h-5 w-5" />
                    <span className="text-sm font-semibold">{officer.efficiency}%</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <p className="text-xl font-bold text-blue-600">{officer.overall?.total || 0}</p>
                    <p className="text-xs text-gray-600">Completions</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded-lg">
                    <p className="text-xl font-bold text-green-600">{officer.completedCount || 0}</p>
                    <p className="text-xs text-gray-600">Completed</p>
                  </div>
                  <div className="text-center p-2 bg-yellow-50 rounded-lg">
                    <p className="text-xl font-bold text-yellow-600">{formatTime(officer.overall?.avgTime)}</p>
                    <p className="text-xs text-gray-600">Avg Time</p>
                  </div>
                </div>

                {/* Step Breakdown */}
                {officer.stepBreakdown && officer.stepBreakdown.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">By Step:</p>
                    <div className="flex flex-wrap gap-1">
                      {officer.stepBreakdown.map(step => (
                        <span key={step.step} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full">
                          {step.step}: {step.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Stats */}
                <div className="flex justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-1">
                    <CheckCircleIcon className="h-3 w-3 text-green-500" />
                    <span>{officer.today?.total || 0} today</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ExclamationTriangleIcon className="h-3 w-3 text-red-500" />
                    <span>{officer.escalatedCount || 0} escalated</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ClockIcon className="h-3 w-3 text-gray-500" />
                    <span>{formatTime(officer.overall?.avgTime)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredOfficers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <UserGroupIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No officers found in this zone</p>
          </div>
        )}
      </div>

      {/* Officer Details Modal */}
      {showDetailsModal && officerDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{officerDetails.officer?.name}</h2>
                <p className="text-sm text-gray-500">{officerDetails.officer?.role} • {officerDetails.officer?.email}</p>
                {officerDetails.officer?.counter && (
                  <p className="text-xs text-gray-400 mt-1">
                    Counter: {officerDetails.officer.counter.name || officerDetails.officer.counter.number}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6">
              {/* Period Selector */}
              <div className="flex justify-end mb-6">
                <div className="flex space-x-2">
                  {['day', 'week', 'month'].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setPeriod(p);
                        fetchOfficerDetails(officerDetails.officer.id);
                      }}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                        period === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{officerDetails.summary?.totalCompletions || 0}</p>
                  <p className="text-xs text-gray-600">Total Completions</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{formatTime(officerDetails.summary?.avgTime)}</p>
                  <p className="text-xs text-gray-600">Avg Time</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{officerDetails.summary?.efficiency || 0}%</p>
                  <p className="text-xs text-gray-600">Efficiency</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">{officerDetails.summary?.escalatedCount || 0}</p>
                  <p className="text-xs text-gray-600">Escalated</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-600">{officerDetails.summary?.calledCount || 0}</p>
                  <p className="text-xs text-gray-600">Called</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {dailyChartData && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Performance</h3>
                    <div className="h-64">
                      <Bar data={dailyChartData} options={chartOptions} />
                    </div>
                  </div>
                )}
                {stepChartData && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Performance by Step</h3>
                    <div className="h-64">
                      <Bar data={stepChartData} options={chartOptions} />
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Completions */}
              {officerDetails.recentCompletions?.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Recent Completions</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {officerDetails.recentCompletions.map((completion) => (
                          <tr key={completion.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono">{completion.ticketNumber}</td>
                            <td className="px-4 py-3 text-sm">{completion.serviceName}</td>
                            <td className="px-4 py-3 text-sm">{completion.step}</td>
                            <td className="px-4 py-3 text-sm">{formatTime(completion.time)}</td>
                            <td className="px-4 py-3 text-sm">{new Date(completion.completedAt).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficerPerformance;