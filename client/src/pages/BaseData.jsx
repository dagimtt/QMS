import { useNavigate } from 'react-router-dom';
import {
  BuildingStorefrontIcon,
  QueueListIcon,
  TagIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';

const BaseData = () => {
  const navigate = useNavigate();

  const items = [
    {
      name: 'Zones',
      icon: BuildingStorefrontIcon,
      path: '/zones',
      color: 'bg-blue-500'
    },
    {
      name: 'Groups',
      icon: QueueListIcon,
      path: '/groups',
      color: 'bg-green-500'
    },
    {
      name: 'Counters',
      icon: TagIcon,
      path: '/counters',
      color: 'bg-purple-500'
    },
    {
      name: 'Services',
      icon: Cog6ToothIcon,
      path: '/services',
      color: 'bg-orange-500'
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Base Data</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <div
            key={item.name}
            onClick={() => navigate(item.path)}
            className="cursor-pointer bg-white rounded-2xl shadow-md hover:shadow-xl transition p-6 flex flex-col items-center justify-center"
          >
            <div className={`${item.color} p-4 rounded-full mb-4`}>
              <item.icon className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700">
              {item.name}
            </h2>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BaseData;