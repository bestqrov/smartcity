/* Parent-space service worker: displays web push notifications. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'Notification';
    event.waitUntil(
        self.registration.showNotification(title, {
            body: data.body || '',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            data: { url: data.url || null },
        }),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || self.registration.scope;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, '');
            for (const client of list) {
                if (new URL(client.url).pathname.startsWith(scopePath) && 'focus' in client) {
                    return client.focus();
                }
            }
            return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
        }),
    );
});
