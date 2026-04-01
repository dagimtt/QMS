import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const CounterManagement = () => {
  const [counters, setCounters] = useState([]);
  const [groups, setGroups] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCounter, setEditingCounter] = useState(null);
  const [formData, setFormData] = useState({
    counterNumber: '',
    name: '',
    type: 'Verifier',
    groupId: '',
    services: [],
    assignedUserId: ''
  });

  const counterTypes = ['Verifier', 'Cashier', 'Validator', 'Authorizer', 'Supervisor', 'Assistant Desk'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [countersRes, groupsRes, servicesRes, usersRes] = await Promise.all([
        api.get('/counters'),
        api.get('/groups'),
        api.get('/services'),
        api.get('/users')
      ]);

      setCounters(countersRes.data?.counters || []);
      setGroups(groupsRes.data?.groups || []);
      setServices(servicesRes.data?.services || []);
      setUsers(usersRes.data?.users || []);
    } catch (error) {
      toast.error('Failed to fetch data');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCounter) {
        await api.put(`/counters/${editingCounter._id}`, formData);
        toast.success('Counter updated successfully');
      } else {
        await api.post('/counters', formData);
        toast.success('Counter created successfully');
      }
      fetchData();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
      console.error('Submit error:', error);
    }
  };

  const handleEdit = (counter) => {
    setEditingCounter(counter);
    setFormData({
      counterNumber: counter.counterNumber || '',
      name: counter.name || '',
      type: counter.type || 'Verifier',
      groupId: counter.group?._id || counter.group || '',
      services: counter.services?.map(s => s._id || s) || [],
      assignedUserId: counter.assignedUser?._id || counter.assignedUser || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (counterId) => {
    if (window.confirm('Are you sure you want to delete this counter?')) {
      try {
        await api.delete(`/counters/${counterId}`);
        toast.success('Counter deleted successfully');
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to delete counter');
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCounter(null);
    setFormData({
      counterNumber: '',
      name: '',
      type: 'Verifier',
      groupId: '',
      services: [],
      assignedUserId: ''
    });
  };

  const handleServiceToggle = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceId)
        ? prev.services.filter(id => id !== serviceId)
        : [...prev.services, serviceId]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading counters...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Counter Management</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-200 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          Add New Counter
        </button>
      </div>

      {counters.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No counters yet</h3>
          <p className="text-gray-500 mb-4">Get started by creating your first service counter</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create First Counter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {counters.map((counter) => (
            <div key={counter._id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{counter.name || `Counter ${counter.counterNumber}`}</h3>
                    <p className="text-sm text-gray-500 mt-1">#{counter.counterNumber}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(counter)}
                      className="text-blue-600 hover:text-blue-800 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(counter._id)}
                      className="text-red-600 hover:text-red-800 transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Type:</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      counter.type === 'Verifier' ? 'bg-blue-100 text-blue-800' :
                      counter.type === 'Cashier' ? 'bg-green-100 text-green-800' :
                      counter.type === 'Validator' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {counter.type || 'Verifier'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Group:</span>
                    <span className="text-sm font-medium">{counter.group?.name || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Assigned User:</span>
                    <span className="text-sm">{counter.assignedUser?.fullName || 'Not assigned'}</span>
                  </div>
                </div>

                {Array.isArray(counter.services) && counter.services.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-2">Services:</p>
                    <div className="flex flex-wrap gap-1">
                      {counter.services.map(service => (
                        <span key={service._id || service} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                          {service.name || 'Unnamed Service'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${counter.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {counter.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      counter.status === 'Available' ? 'bg-green-100 text-green-800' :
                      counter.status === 'Busy' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {counter.status || 'Available'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingCounter ? 'Edit Counter' : 'Add New Counter'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Counter Number *</label>
                  <input
                    type="text"
                    value={formData.counterNumber}
                    onChange={(e) => setFormData({ ...formData, counterNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    required
                    placeholder="e.g., 1, 2, 3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Counter Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Window 1, Service Desk"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Counter Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    required
                  >
                    {counterTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group *</label>
                  <select
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    required
                  >
                    <option value="">Select Group</option>
                    {Array.isArray(groups) && groups.map(group => (
                      <option key={group._id} value={group._id}>{group.name || 'Unnamed Group'} ({group.code || 'N/A'})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assigned User</label>
                  <select
                    value={formData.assignedUserId}
                    onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Select User</option>
                    {Array.isArray(users) && users.filter(u => u?.isActive).map(user => (
                      <option key={user._id} value={user._id}>{user.fullName || 'Unnamed User'} ({user.role || 'N/A'})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Services Offered</label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                  {Array.isArray(services) && services.map(service => (
                    <label key={service._id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.services.includes(service._id)}
                        onChange={() => handleServiceToggle(service._id)}
                        className="mr-2"
                      />
                      <span className="text-sm">{service.name || 'Unnamed Service'} ({service.code || 'N/A'})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
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
                  {editingCounter ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CounterManagement;