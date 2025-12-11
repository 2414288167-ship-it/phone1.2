// public/sw.js

// 1. 这是一个空的 fetch 监听器，用来骗过 PWA 的检查机制，
// 告诉浏览器“我有离线处理能力”（虽然这里什么都没做）。
self.addEventListener("fetch", function (event) {
  // 这里可以留空，或者以后添加缓存逻辑
  return;
});

// 2. 原有的推送通知逻辑 (保留)
self.addEventListener("push", function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: "/icon-192.png", // 建议改成 192 的图标
        badge: "/favicon.ico",
        vibrate: [100, 50, 100],
        data: {
          url: data.url || "/", // 防止 url 为空
        },
      };
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      console.error("Push notification error:", e);
    }
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // 如果已经打开了窗口，就聚焦
      for (let client of windowClients) {
        if (client.url === event.notification.data.url && "focus" in client) {
          return client.focus();
        }
      }
      // 否则打开新窗口
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
