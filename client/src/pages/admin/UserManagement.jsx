import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'Verifier',
    counter: ''
  });

  const roles = ['Admin', 'Verifier', 'Cashier', 'Validator', 'Supervisor', 'Authorizer'];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, countersRes] = await Promise.all([
        api.get('/users'),
        api.get('/counters')
      ]);

      console.log("Users API:", usersRes.data);
      console.log("Counters API:", countersRes.data);

      // ✅ SAFE DATA HANDLING
      const usersData = Array.isArray(usersRes.data)
        ? usersRes.data
        : usersRes.data?.users || [];

      const countersData = Array.isArray(countersRes.data)
        ? countersRes.data
        : countersRes.data?.counters || [];

      setUsers(usersData);
      setCounters(countersData);

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
      if (editingUser) {
        await api.put(`/users/${editingUser._id}`, {
          fullName: formData.fullName,
          role: formData.role,
          counter: formData.counter
        });
        toast.success('User updated successfully');
      } else {
        if (!formData.password) {
          toast.error('Password is required');
          return;
        }
        await api.post('/users', formData);
        toast.success('User created successfully');
      }
      fetchData();
      closeModal();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
      console.error('Submit error:', error);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName,
      email: user.email,
      password: '',
      role: user.role,
      counter: user.counter?._id || user.counter || ''
    });
    setIsModalOpen(true);
  };

  const handleDeactivate = async (userId) => {
    if (window.confirm('Are you sure you want to deactivate this user?')) {
      try {
        await api.delete(`/users/${userId}`);
        toast.success('User deactivated successfully');
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to deactivate user');
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({
      fullName: '',
      email: '',
      password: '',
      role: 'Verifier',
      counter: ''
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          + Add New User
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {users.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No users found
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Counter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user._id}>
                  <td className="px-6 py-4">{user.fullName}</td>
                  <td className="px-6 py-4">{user.email}</td>
                  <td className="px-6 py-4">{user.role}</td>
                  <td className="px-6 py-4">
                    {user.counter?.counterNumber || 'Not assigned'}
                  </td>
                  <td className="px-6 py-4">
                    {user.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEdit(user)} className="text-blue-600 mr-3">
                      Edit
                    </button>
                    {user.isActive && (
                      <button onClick={() => handleDeactivate(user._id)} className="text-red-600">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">
              {editingUser ? 'Edit User' : 'Add User'}
            </h2>

            <form onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Full Name"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full mb-3 p-2 border rounded"
                required
              />

              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full mb-3 p-2 border rounded"
                required
              />

              {!editingUser && (
                <input
                  type="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full mb-3 p-2 border rounded"
                  required
                />
              )}

              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full mb-3 p-2 border rounded"
              >
                {roles.map(role => (
                  <option key={role}>{role}</option>
                ))}
              </select>

              <select
                value={formData.counter}
                onChange={(e) => setFormData({ ...formData, counter: e.target.value })}
                className="w-full mb-3 p-2 border rounded"
              >
                <option value="">Not Assigned</option>
                {counters?.filter(c => c.isActive)?.map(counter => (
                  <option key={counter._id} value={counter._id}>
                    {counter.name || `Counter ${counter.counterNumber}`}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;