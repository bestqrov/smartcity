/**
 * Utility function to trigger dashboard refresh
 * Call this after any operation that should update dashboard analytics
 * (e.g., after creating students, teachers, payments, inscriptions, etc.)
 */
export const triggerDashboardRefresh = () => {
    // Dispatch custom event that dashboard listens to
    window.dispatchEvent(new Event('dashboardRefresh'));

    // Also trigger localStorage update event for backward compatibility
    window.dispatchEvent(new Event('localStorageUpdated'));
};

/**
 * Trigger refresh after a short delay
 * Useful when you want to ensure backend has processed the data
 */
export const triggerDashboardRefreshDelayed = (delayMs: number = 500) => {
    setTimeout(() => {
        triggerDashboardRefresh();
    }, delayMs);
};
