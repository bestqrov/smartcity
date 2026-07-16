'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { apiClient } from '@/lib/api';
import { Button, Input } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface Room {
  id: string;
  name: string;
  type: string;
  price: number;
  capacity: number;
  isAvailable: boolean;
}

interface BookingFormProps {
  locale: string;
  hotelId: string;
  hotelName: string;
}

export function BookingForm({ locale, hotelId, hotelName }: BookingFormProps) {
  const router = useRouter();
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingRooms, setFetchingRooms] = useState(true);
  const [error, setError] = useState('');

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);

  useEffect(() => {
    apiClient(`/rooms/${hotelId}/hotel`)
      .then((response) => {
        const availableRooms = (response.data || []).filter(
          (room: Room) => room.isAvailable,
        );
        setRooms(availableRooms);
        if (availableRooms.length > 0) {
          setSelectedRoomId(availableRooms[0].id);
        }
      })
      .catch(() => setError(t('booking.loadingRooms')))
      .finally(() => setFetchingRooms(false));
  }, [hotelId, t]);

  const calculateTotalPrice = () => {
    if (!selectedRoom || !checkIn || !checkOut) return 0;

    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.max(
      0,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return nights * selectedRoom.price;
  };

  const calculateNights = () => {
    if (!selectedRoom || !checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.max(
      0,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      router.push(`/${locale}/login`);
      return;
    }

    if (!selectedRoomId || !checkIn || !checkOut) {
      setError(t('booking.fillRequired'));
      return;
    }

    const totalPrice = calculateTotalPrice();
    if (totalPrice <= 0) {
      setError(t('booking.invalidDates'));
      return;
    }

    setLoading(true);

    try {
      await apiClient('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          guestId: user.id,
          hotelId,
          roomId: selectedRoomId,
          checkIn,
          checkOut,
          guestCount,
          totalPrice,
          specialRequests,
        }),
      });

      router.push(`/${locale}/bookings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  if (fetchingRooms) {
    return <div className="text-center py-8">{t('booking.loadingRooms')}</div>;
  }

  if (rooms.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">{t('booking.noRooms')}</p>
        </CardContent>
      </Card>
    );
  }

  const nights = calculateNights();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('booking.title', { hotel: hotelName })}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('booking.room')}
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} — {room.type} ({room.capacity} {t('tourism.guests')}) — {room.price} MAD/{t('hotels.priceRange')}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('tourism.checkIn')}
              </label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('tourism.checkOut')}
              </label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
                min={checkIn || new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('booking.guests')}
            </label>
            <Input
              type="number"
              min={1}
              max={selectedRoom?.capacity || 1}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('booking.specialRequests')}
            </label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('booking.specialRequestsPlaceholder')}
            />
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('booking.totalPrice')}</span>
              <span className="text-2xl font-bold text-primary-600">
                {calculateTotalPrice()} MAD
              </span>
            </div>
            {selectedRoom && checkIn && checkOut && nights > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {selectedRoom.price} MAD × {nights} {t('booking.nights')}
              </p>
            )}
          </div>

          <Button type="submit" loading={loading} className="w-full">
            {t('booking.confirmBooking')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
