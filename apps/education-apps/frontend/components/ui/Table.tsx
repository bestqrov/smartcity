import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface Column<T> {
    key: keyof T | string;
    label: string;
    render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    loading?: boolean;
    emptyMessage?: string;
    extraActions?: Action<T>[];
}

export interface Action<T> {
    icon: React.ReactNode;
    onClick: (item: T) => void;
    label: string;
    className?: string;
    title?: string;
}

export function Table<T extends { id: string }>({
    data,
    columns,
    onEdit,
    onDelete,
    loading = false,
    emptyMessage = 'No data available',
    extraActions,
}: TableProps<T>) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={String(column.key)}
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                                {column.label}
                            </th>
                        ))}
                        {(onEdit || onDelete) && (
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                            {columns.map((column) => (
                                <td
                                    key={String(column.key)}
                                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                    {column.render
                                        ? column.render(item)
                                        : String(item[column.key as keyof T] || '-')}
                                </td>
                            ))}
                            {(onEdit || onDelete || extraActions) && (
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center justify-end gap-2">
                                        {extraActions?.map((action, index) => (
                                            <button
                                                key={index}
                                                onClick={() => action.onClick(item)}
                                                className={`text-gray-600 hover:text-gray-900 ${action.className || ''}`}
                                                title={action.title || action.label}
                                                aria-label={action.label}
                                            >
                                                {action.icon}
                                            </button>
                                        ))}
                                        {onEdit && (
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="text-primary-600 hover:text-primary-900"
                                                aria-label="Edit"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button
                                                onClick={() => onDelete(item)}
                                                className="text-red-600 hover:text-red-900"
                                                aria-label="Delete"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
