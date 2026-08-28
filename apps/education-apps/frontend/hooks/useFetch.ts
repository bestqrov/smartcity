import { useState, useEffect, useCallback } from 'react';
import type { AxiosError } from 'axios';

interface UseFetchState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

interface UseFetchReturn<T> extends UseFetchState<T> {
    refetch: () => Promise<void>;
}

export function useFetch<T>(
    fetchFn: () => Promise<T>,
    dependencies: any[] = []
): UseFetchReturn<T> {
    const [state, setState] = useState<UseFetchState<T>>({
        data: null,
        loading: true,
        error: null,
    });

    const fetchData = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const data = await fetchFn();
            setState({ data, loading: false, error: null });
        } catch (err) {
            const error = err as AxiosError<{ error: string }>;
            setState({
                data: null,
                loading: false,
                error: error.response?.data?.error || 'An error occurred',
            });
        }
    }, [fetchFn]);

    useEffect(() => {
        fetchData();
    }, dependencies);

    return {
        ...state,
        refetch: fetchData,
    };
}
