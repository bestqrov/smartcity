// hooks/useAuth.ts
import useAuthStore from '../store/useAuthStore';

export const useAuth = () => {
    const { user, accessToken, loading, login, logout, getMe } = useAuthStore();
    return {
        user,
        accessToken,
        loading,
        isLoading: loading,
        isAuthenticated: !!user,
        login,
        logout,
        getMe
    };
};

export default useAuth;
