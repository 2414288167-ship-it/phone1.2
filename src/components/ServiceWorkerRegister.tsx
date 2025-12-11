"use client";

import { useEffect } from "react";

// 这是一个辅助函数，用来转换 VAPID Key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // 1. 检查浏览器是否支持
    if ("serviceWorker" in navigator && "PushManager" in window) {
      // 注册 Service Worker
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (registration) => {
          console.log("SW 注册成功:", registration);

          // 2. 检查当前的订阅状态
          let subscription = await registration.pushManager.getSubscription();

          // 3. 如果没有订阅，或者需要更新，则发起订阅
          if (!subscription) {
            const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

            if (!publicKey) {
              console.error("缺少 VAPID 公钥，请检查 Vercel 环境变量");
              return;
            }

            // 请求通知权限（浏览器会弹窗）
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
              // 向浏览器推送服务发起订阅
              subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
              });

              // 4. 🔥 关键步骤：把订阅信息发送给你的后端 API 保存起来
              await fetch("/api/push", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(subscription),
              });
              console.log("推送订阅成功，已发送至服务器");
            }
          }
        })
        .catch((error) => {
          console.error("SW 注册或订阅失败:", error);
        });
    }
  }, []);

  return null;
}
