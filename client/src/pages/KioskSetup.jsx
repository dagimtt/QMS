import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import {
  ComputerDesktopIcon,
  MapPinIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline';

const KioskSetup = () => {
  const navigate = useNavigate();
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [kioskName, setKioskName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZones();
    // Check if kiosk is already configured in session
    const savedKiosk = sessionStorage.getItem('kioskConfig');
    if (savedKiosk) {
      const config = JSON.parse(savedKiosk);
      setSelectedZone(config.zoneId);
      setKioskName(config.kioskName);
    }
  }, []);

  const fetchZones = async () => {
    try {
      const response = await api.get('/zones');
      const activeZones = response.data.zones.filter(z => z.isActive);
      setZones(activeZones);
    } catch (error) {
      console.error('Failed to fetch zones:', error);
      toast.error('Failed to load zones');
    } finally {
      setLoading(false);
    }
  };

  const handleZoneSelect = (zone) => {
    setSelectedZone(zone);
  };

  const handleStartKiosk = () => {
    if (!selectedZone) {
      toast.error('Please select a zone for this kiosk');
      return;
    }

    // Save configuration to session storage
    const config = {
      zoneId: selectedZone._id,
      zoneName: selectedZone.name,
      zoneCode: selectedZone.code,
      kioskName: kioskName || `${selectedZone.name} Kiosk`,
      configuredAt: new Date().toISOString()
    };
    
    sessionStorage.setItem('kioskConfig', JSON.stringify(config));
    
    toast.success(`Kiosk configured for ${selectedZone.name}`);
    
    // Navigate to kiosk customer page
    navigate(`/kiosk?zoneId=${selectedZone._id}`);
  };

  const handleReset = () => {
    sessionStorage.removeItem('kioskConfig');
    setSelectedZone(null);
    setKioskName('');
    toast.info('Kiosk configuration reset');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-4">
            <ComputerDesktopIcon className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Kiosk Setup</h1>
          <p className="text-blue-200">Select the zone for this kiosk before starting service</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Zone Selection */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
           
            <p className="text-blue-100 text-sm mt-1">Choose which zone this kiosk will serve</p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {zones.map((zone) => (
                <button
                  key={zone._id}
                  onClick={() => handleZoneSelect(zone)}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${
                    selectedZone?._id === zone._id
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <BuildingStorefrontIcon className={`h-5 w-5 ${selectedZone?._id === zone._id ? 'text-blue-600' : 'text-gray-400'}`} />
                        <h3 className={`font-semibold text-lg ${selectedZone?._id === zone._id ? 'text-blue-700' : 'text-gray-900'}`}>
                          {zone.name}
                        </h3>
                      </div>
                      <p className="text-sm text-gray-500">Code: {zone.code}</p>
                      {zone.description && (
                        <p className="text-xs text-gray-400 mt-2">{zone.description}</p>
                      )}
                    </div>
                    {selectedZone?._id === zone._id && (
                      <CheckCircleIcon className="h-6 w-6 text-blue-600" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            
            {zones.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No zones available. Please contact administrator.</p>
              </div>
            )}
          </div>
        </div>

       

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={handleStartKiosk}
            disabled={!selectedZone}
            className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center ${
              selectedZone
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Start Kiosk
            <ArrowRightIcon className="h-5 w-5 ml-2" />
          </button>
          
          <button
            onClick={handleReset}
            className="px-6 py-4 rounded-xl font-semibold text-lg border-2 border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-600 transition-all"
          >
            Reset
          </button>
        </div>

        {/* Info Message */}
       
      </div>
    </div>
  );
};

export default KioskSetup;