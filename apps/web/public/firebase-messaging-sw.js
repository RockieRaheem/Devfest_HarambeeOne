'use strict';

const SAFE_EVENTS = new Set([
  'invitation', 'consent', 'changes_requested', 'publication', 'pledge', 'settlement',
  'rejection', 'funded', 'receipt', 'outcome', 'update',
]);

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const data = payload.data || {};
  const eventName = SAFE_EVENTS.has(data.event) ? data.event : 'update';
  const href = typeof data.href === 'string' && data.href.startsWith('/') ? data.href : '/';
  event.waitUntil(self.registration.showNotification('HarambeeOne update', {
    body: 'Open HarambeeOne to view a secure update.',
    icon: '/harambeeone-logo.png',
    tag: typeof data.notification_id === 'string' ? data.notification_id : eventName,
    data: { href },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const href = event.notification.data?.href || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(href);
        return client.focus();
      }
    }
    return clients.openWindow(href);
  }));
});
