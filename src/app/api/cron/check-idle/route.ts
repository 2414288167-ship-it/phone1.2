import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import webPush from "web-push";

// 配置 Web Push
// 我已经把你的密钥直接填进去了，这样就不会报"找不到 Key"的错误了
webPush.setVapidDetails(
  "https://example.com", // VAPID subject 必须是有效的 URL 格式
  "BFj_E8sTEDUQqF4rfguCN2Wu_ph9nO55JX8ZSXCUneyhGTWyE7lh8A8iMy8UXPE141w_2qvFcVwUJ1Cxf1MFTRw", // 你的公钥
  "Lib_9wOkZIwGRp6upFIlPORPfD40aswJBAcP6F_ttBQ" // 你的私钥
);
// 定义数据结构
interface StoredUserData {
  subscription: webPush.PushSubscription;
  nextTriggerTime: number;
  contactInfo: any;
  lastMessage: string;
}

export async function GET() {
  try {
    // 检查环境变量是否存在
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      console.log("⚠️ KV 环境变量未配置，跳过推送检查");
      return NextResponse.json({
        message: "KV not configured - skipping push check",
        skipped: true,
      });
    }

    // 1. 从 Redis 拉取所有用户的订阅数据
    const allUsers = await kv.hgetall("active_push_users");

    if (!allUsers) {
      return NextResponse.json({ message: "No active users" });
    }

    const now = Date.now();
    const updates: Promise<any>[] = [];

    // 2. 遍历检查谁的时间到了
    for (const [userId, data] of Object.entries(allUsers)) {
      const userData = data as StoredUserData;

      // 检查是否到了触发时间 (允许 1分钟的误差缓冲)
      if (userData.nextTriggerTime && now >= userData.nextTriggerTime) {
        console.log(`🚀 触发用户 ${userId} 的推送`);

        // 3. (可选) 调用 OpenAI 生成回复
        // 为了简单，这里先写死，等你跑通了再把 fetch OpenAI 的逻辑搬过来
        const aiText = `[云端推送] 嘿，好久不见，我是 ${
          userData.contactInfo.name || "AI"
        }！`;

        // 4. 发送推送
        try {
          await webPush.sendNotification(
            userData.subscription,
            JSON.stringify({
              title: userData.contactInfo.name || "AI 消息",
              body: aiText,
              url: `/chat/${userId}`,
            })
          );

          // 5. 推送成功后，从数据库移除该任务，防止重复推送
          // 或者你可以更新 nextTriggerTime 到下一次
          await kv.hdel("active_push_users", userId);
        } catch (error: any) {
          console.error(`推送失败 ${userId}:`, error);
          // 如果是 410 Gone，说明用户取消了订阅，清理死数据
          if (error.statusCode === 410) {
            await kv.hdel("active_push_users", userId);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: Object.keys(allUsers).length,
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Cron Failed" }, { status: 500 });
  }
}
