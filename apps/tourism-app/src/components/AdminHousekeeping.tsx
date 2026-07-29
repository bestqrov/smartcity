'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Room {
  id: string;
  name: string;
  housekeepingStatus: string;
  hotel: { id: string; name: string };
}

const STATUSES = ['CLEAN', 'DIRTY', 'IN_PROGRESS', 'INSPECTED'];

const STATUS_STYLES: Record<string, string> = {
  CLEAN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DIRTY: 'bg-red-100 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  INSPECTED: 'bg-blue-100 text-blue-700 border-blue-200',
};

export function AdminHousekeeping() {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchRooms = () => {
    setLoading(true);
    apiClient('/rooms/housekeeping')
      .then((data) => setRooms(data || []))
      .catch((err) => setError(err instanceof Error ? err.message : t('common.error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleStatusChange = async (roomId: string, status: string) => {
    setUpdating(roomId);
    setError('');
    try {
      await apiClient(`/rooms/${roomId}/housekeeping`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-gray-500">{t('common.loading')}</div>;
  }

  const grouped = rooms.reduce<Record<string, Room[]>>((acc, room) => {
    const key = room.hotel.name;
    acc[key] = acc[key] || [];
    acc[key].push(room);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('housekeeping.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('housekeeping.subtitle')}</p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {Object.keys(grouped).length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">{t('housekeeping.noRooms')}</p>
      ) : (
        Object.entries(grouped).map(([hotelName, hotelRooms]) => (
          <Card key={hotelName}>
            <CardHeader>
              <CardTitle>{hotelName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {hotelRooms.map((room) => (
                  <div
                    key={room.id}
                    className={`rounded-lg border p-3 ${STATUS_STYLES[room.housekeepingStatus] ?? 'border-gray-200'}`}
                  >
                    <p className="font-medium text-gray-800">{room.name}</p>
                    <select
                      value={room.housekeepingStatus}
                      disabled={updating === room.id}
                      onChange={(e) => handleStatusChange(room.id, e.target.value)}
                      className="mt-2 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`housekeeping.status.${status}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
