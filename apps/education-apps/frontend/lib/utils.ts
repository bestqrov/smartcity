import { type ClassValue, clsx } from 'clsx';

// Utility to merge Tailwind classes
export function cn(...inputs: ClassValue[]) {
    return clsx(inputs);
}

// Format currency
export function formatCurrency(amount: number): string {
    return `${amount.toFixed(2)} MAD`;
}

// Format date
export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

// Format date for input[type="date"]
export function formatDateForInput(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
}

// Format datetime
export function formatDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// Get initials from name
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Truncate text
export function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
}

// Validate email
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}


// Generate random ID (for client-side temporary IDs)
export function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}

// Update localStorage and trigger custom event for real-time updates
export function updateLocalStorage(key: string, value: any): void {
    try {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        // Dispatch custom event to notify components in the same tab
        window.dispatchEvent(new CustomEvent('localStorageUpdated', { detail: { key, value } }));
    } catch (error) {
        console.error('Error updating localStorage:', error);
    }
}
