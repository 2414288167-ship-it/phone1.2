// src/hooks/useWebPush.ts
import { useState, useEffect } from "react";

// 转换 VAPID Key 的辅助函数
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function useWebPush() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );

  const subscribeToPush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("你的浏览器不支持推送通知");
      return;
    }

    // 1. 注册 Service Worker
    const registration = await navigator.serviceWorker.register("/sw.js");

    // 2. 等待激活
    await navigator.serviceWorker.ready;

    // 3. 订阅推送
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });

    setSubscription(sub);

    // 4. 发送给后端保存 (同时上传你的闲置配置)
    // 假设你把当前用户的配置存在 contacts 里，这里为了演示简化了
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub,
        // ⚠️ 关键：必须把这些配置告诉后端，后端才能帮你倒计时
        settings: {
          idleMin: 30,
          idleMax: 120,
          lastActive: Date.now(),
        },
      }),
    });

    alert("推送已开启！锁屏也能收到了。");
  };

  return { subscribeToPush };
}
