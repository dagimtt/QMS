import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import logoWatermark from '../assets/ICS Logo.png';
import logoHorizontal from '../assets/ICS Logo - Abberviation Version - Horizontal - Color.png';

const Kiosk = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [zone, setZone] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [ticketGenerated, setTicketGenerated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('service');
  const [animationPhase, setAnimationPhase] = useState(0); // 0: English, 1: Amharic, 2: Subtext

  useEffect(() => {
    const zoneId = searchParams.get('zoneId');
    
    if (zoneId) {
      fetchZoneAndServices(zoneId);
    } else {
      const savedConfig = sessionStorage.getItem('kioskConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        fetchZoneAndServices(config.zoneId);
      } else {
        toast.error('Kiosk not configured. Please contact operator.');
        navigate('/kiosk-setup');
      }
    }
  }, [searchParams]);

  // Continuous animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase((prev) => {
        if (prev === 0) return 1;
        if (prev === 1) return 2;
        return 0;
      });
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const fetchZoneAndServices = async (zoneId) => {
    try {
      const zoneResponse = await api.get(`/zones/${zoneId}`);
      setZone(zoneResponse.data.zone);
      
      const servicesResponse = await api.get('/services', {
        params: { isActive: true }
      });
      setServices(servicesResponse.data.services);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load kiosk data');
    }
  };

  const handleServiceSelect = (service) => {
    setSelectedService(service);
    setStep('form');
  };

  const handleBackToServices = () => {
    setStep('service');
    setSelectedService(null);
    setCustomerInfo({ name: '', phone: '', email: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.post('/tickets', {
        serviceId: selectedService._id,
        zoneId: zone?._id,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email
      });
      
      setTicketGenerated(response.data.ticket);
      setStep('ticket');
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
    setStep('service');
    setCustomerInfo({ name: '', phone: '', email: '' });
  };

  // Loading state
  if (!zone && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading kiosk...</p>
        </div>
      </div>
    );
  }

  // Ticket Generated Screen
  if (step === 'ticket' && ticketGenerated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <img src={logoWatermark} alt="ICS" className="w-64 h-64 object-contain" />
          </div>
          
          <div className="relative z-10">
            <div className="flex justify-center mb-6">
              <img src={logoHorizontal} alt="ICS" className="h-12 object-contain" />
            </div>
            
            <div className="mb-6">
             
              
            </div>
            
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-6">
              <div className="text-7xl font-bold text-blue-600 mb-4">
                {ticketGenerated.displayNumber}
              </div>
              <div className="text-left space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Full Number:</span>
                  <span className="font-mono font-medium">{ticketGenerated.ticketNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-medium">{ticketGenerated.service?.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-600">Counter:</span>
                  <span className="font-medium">{ticketGenerated.assignedCounter?.name || `Counter ${ticketGenerated.assignedCounter?.counterNumber}`}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium">{new Date(ticketGenerated.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handlePrint}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl hover:shadow-lg transition-all font-medium"
              >
                🖨️ Print Ticket
              </button>
              <button
                onClick={handleNewTicket}
                className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                Create Another Ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Customer Info Form
  if (step === 'form' && selectedService) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none flex items-center justify-center">
            <img src={logoWatermark} alt="ICS" className="w-64 h-64 object-contain" />
          </div>
          
          <div className="relative z-10">
             <button
              onClick={handleBackToServices}
              className="text-gray-500 hover:text-gray-700 mb-6 flex items-center text-sm"
            >
              ← Back to Services
            </button>
            <div className="flex justify-center mb-6">
              <img src={logoHorizontal} alt="ICS" className="h-10 object-contain" />
            </div>
            
           
            
            <div className="text-center mb-6">
              
              <h1 className="text-2xl font-bold text-gray-900">{selectedService.name}</h1>
              <p className="text-gray-500 text-sm mt-1">Estimated time: {selectedService.estimatedTime} minutes</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              
              
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Get Ticket / ቲኬት ያግኙ'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Service Selection Screen
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with ICS Logo */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col items-center text-center">
            <img src={logoHorizontal} alt="ICS" className="h-16 object-contain mb-3" />
            
            {/* Continuous Dual Language Typewriter Animation */}
            <div className="min-h-[120px]">
              <div className="typewriter-container">
                {animationPhase === 0 && (
                  <h1 key="english" className="typewriter-text animate-typewriter text-2xl md:text-3xl font-bold text-gray-900">
                    Welcome to Ethiopia Immigration and Citizenship Service
                  </h1>
                )}
                
                {animationPhase === 1 && (
                  <h1 key="amharic" className="typewriter-text-amharic animate-typewriter-amharic text-2xl md:text-3xl font-bold text-gray-900">
                    እንኳን ወደ ኢሚግሬሽንና እና ዜግነት አገልግሎት በደህና መጡ
                  </h1>
                )}
                
               
              </div>
            </div>
  
          </div>
        </div>
      </div>
      
      {/* Service Selection - FULLY CENTERED */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 justify-center items-stretch max-w-6xl w-full">
            {services.map((service, index) => (
              <button
                key={service._id}
                onClick={() => handleServiceSelect(service)}
                className="group bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden transform hover:-translate-y-1 border border-gray-100 w-full animate-fade-in-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="relative h-full flex flex-col">
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1 rounded-bl-2xl text-sm font-medium z-10">
                    {service.estimatedTime} ደቂቃ / min
                  </div>
                  <div className="p-6 pt-8 flex-1 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{service.name}</h3>
                    <p className="text-gray-500 text-sm mb-4 flex-1 line-clamp-2">
                      {service.description || 'Click to get your ticket for this service / ቲኬት ለማግኘት ይጫኑ'}
                    </p>
                    <div className="flex items-center justify-center text-blue-600 font-medium group-hover:text-blue-700 mt-auto">
                      <span>Get Ticket / ቲኬት ያግኙ</span>
                      <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {services.length === 0 && (
          <div className="flex justify-center">
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm max-w-md w-full">
              <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p className="text-gray-500 text-lg">No services available at the moment.</p>
              <p className="text-gray-400 text-sm mt-2">Please contact the administrator.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-gray-400 text-sm">Thank you for using our service | ለአገልግሎት እናመሰግናለን</p>
        </div>
      </div>
    </div>
  );
};

export default Kiosk;