const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const getAuthHeaders = () => {
    const token = localStorage.getItem('accessToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const transactionsApi = {
    async getAll() {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async getStats() {
        const response = await fetch(`${API_BASE_URL}/transactions/stats`, {
            headers: getAuthHeaders()
        });
        return response.json();
    },

    async create(data: {
        type: 'INCOME' | 'EXPENSE';
        amount: number;
        category: string;
        description?: string;
        date?: string;
    }) {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async delete(id: string) {
        const response = await fetch(`${API_BASE_URL}/transactions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        return response.json();
    }
};
