'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

export default function Calendar() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [days, setDays] = useState<(number | null)[]>([]);

    useEffect(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const daysArray: (number | null)[] = [];

        // Add empty slots for days before the first day of the month
        const startDay = (firstDay + 6) % 7; // Monday = 0

        for (let i = 0; i < startDay; i++) {
            daysArray.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            daysArray.push(i);
        }

        setDays(daysArray);
    }, [currentDate]);

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const monthNames = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    const isToday = (day: number) => {
        const today = new Date();
        return day === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();
    };

    const isWeekend = (dayIndex: number) => {
        return dayIndex % 7 === 5 || dayIndex % 7 === 6; // Saturday or Sunday
    };

    return (
        <div className="bg-gradient-to-br from-white to-blue-50/30 rounded-2xl shadow-lg border border-blue-100/50 p-6 max-w-md mx-auto backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-md">
                        <CalendarIcon className="text-white" size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                            {monthNames[currentDate.getMonth()]}
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">{currentDate.getFullYear()}</p>
                    </div>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    <button
                        onClick={prevMonth}
                        className="p-2 hover:bg-white rounded-lg transition-all duration-200 text-gray-600 hover:text-blue-600 hover:shadow-sm"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-white rounded-lg transition-all duration-200 text-gray-600 hover:text-blue-600 hover:shadow-sm"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-3">
                {weekDays.map((day, index) => (
                    <div
                        key={day}
                        className={`text-center text-xs font-bold py-2 ${index >= 5 ? 'text-purple-500' : 'text-gray-500'
                            }`}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5">
                {days.map((day, index) => (
                    <div
                        key={index}
                        className={`
                            aspect-square flex items-center justify-center rounded-xl text-sm font-semibold
                            transition-all duration-200 transform
                            ${day === null ? 'invisible' : 'cursor-pointer'}
                            ${day && isToday(day)
                                ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105 hover:scale-110 ring-2 ring-blue-200'
                                : isWeekend(index)
                                    ? 'text-purple-600 hover:bg-purple-50 hover:scale-105'
                                    : 'text-gray-700 hover:bg-blue-50 hover:scale-105'
                            }
                            ${day && !isToday(day) ? 'hover:shadow-md' : ''}
                        `}
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Today Indicator */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm"></div>
                    <span className="text-gray-600 font-medium">Aujourd'hui</span>
                </div>
            </div>
        </div>
    );
}
