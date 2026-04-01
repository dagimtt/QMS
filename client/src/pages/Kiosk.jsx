import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';

const Kiosk = () => {
  const [services, setServices] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [ticketGenerated, setTicketGenerated] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchZones();
    fetchServices();
  }, []);

  const fetchZones = async () => {
    try {
      const response = await api.get('/zones');
      const activeZones = response.data.zones.filter(z => z.isActive);
      setZones(activeZones);
      if (activeZones.length > 0) {
        setSelectedZone(activeZones[0]);
      }
    } catch (error) {
      console.error('Failed to fetch zones:', error);
      toast.error('Failed to load zones');
    }
  };

  const fetchServices = async () => {
    try {
      const response = await api.get('/services', {
        params: { isActive: true }
      });
      setServices(response.data.services);
    } catch (error) {
      console.error('Failed to fetch services:', error);
      toast.error('Failed to load services');
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setShowForm(true);
  };

  const handleBackToServices = () => {
    setShowForm(false);
    setSelectedService(null);
    setCustomerInfo({ name: '', phone: '', email: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.post('/tickets', {
        serviceId: selectedService._id,
        zoneId: selectedZone?._id,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email
      });
      
      setTicketGenerated(response.data.ticket);
      setShowForm(false);
      toast.success(`Ticket ${response.data.ticket.displayNumber} created!`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create ticket');
      console.error('Ticket creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNewTicket = () => {
    setTicketGenerated(null);
    setSelectedService(null);
    setSelectedZone(zones[0]);
    setCustomerInfo({ name: '', phone: '', email: '' });
  };

  if (ticketGenerated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Ticket Generated!</h1>
            <p className="text-gray-600 mt-2">Please save your ticket number</p>
          </div>
          
          <div className="bg-gray-100 rounded-xl p-6 mb-6">
            <div className="text-6xl font-bold text-blue-600 mb-4">
              {ticketGenerated.displayNumber}
            </div>
            <div className="text-left space-y-2 text-sm">
              <p><strong className="text-gray-700">Full Number:</strong> {ticketGenerated.ticketNumber}</p>
              <p><strong className="text-gray-700">Service:</strong> {ticketGenerated.service?.name}</p>
              <p><strong className="text-gray-700">Zone:</strong> {ticketGenerated.zoneName || ticketGenerated.zone?.name}</p>
              <p><strong className="text-gray-700">Counter:</strong> {ticketGenerated.assignedCounter?.name || `Counter ${ticketGenerated.assignedCounter?.counterNumber}`}</p>
              <p><strong className="text-gray-700">Time:</strong> {new Date(ticketGenerated.createdAt).toLocaleTimeString()}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={handlePrint}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-medium"
            >
              Print Ticket
            </button>
            <button
              onClick={handleNewTicket}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition font-medium"
            >
              Create Another Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showForm && selectedService) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
          <button
            onClick={handleBackToServices}
            className="text-gray-500 hover:text-gray-700 mb-4 flex items-center"
          >
            ← Back to Services
          </button>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{selectedService.name}</h1>
          <p className="text-gray-600 mb-6">{selectedService.description || 'Please fill in your details to get a ticket'}</p>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name (Optional)
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                placeholder="Enter your name"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                placeholder="Enter your phone number"
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                placeholder="Enter your email"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Generating Ticket...' : 'Get Ticket'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-2">Welcome to QMS Kiosk</h1>
          <p className="text-blue-100">Please select your zone and service to get your ticket</p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Zone Selection */}
        <div className="mb-8">
          <label className="block text-lg font-semibold text-gray-700 mb-3">
            Select Zone
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {zones.map(zone => (
              <button
                key={zone._id}
                onClick={() => setSelectedZone(zone)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedZone?._id === zone._id
                    ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow'
                }`}
              >
                <div className="font-semibold text-lg">{zone.name}</div>
                <div className="text-sm text-gray-500 mt-1">{zone.code}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Service Selection */}
        <div>
          <label className="block text-lg font-semibold text-gray-700 mb-3">
            Select Service
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <button
                key={service._id}
                onClick={() => handleServiceSelect(service)}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all p-6 text-left border border-gray-100 hover:border-blue-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                    {service.estimatedTime} min
                  </span>
                </div>
                {service.description && (
                  <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                )}
                <div className="flex items-center text-blue-600 text-sm mt-2">
                  <span>Get Ticket</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                  </svg>
                </div>
              </button>
            ))}
          </div>
          
          {services.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">No services available at the moment.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Kiosk;