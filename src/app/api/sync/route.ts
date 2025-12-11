import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, subscription, nextTriggerTime, contactInfo, lastMessage } =
      body;

    if (!userId || !subscription) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 将用户数据存入 Redis Hash Map
    // Key: "active_push_users"
    // Field: userId
    // Value: 所有的配置信息
    await kv.hset("active_push_users", {
      [userId]: {
        subscription,
        nextTriggerTime, // 前端算好的触发时间戳
        contactInfo, // AI 人设，用于后端生成消息
        lastMessage, // 上下文，用于后端生成消息
        updatedAt: Date.now(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
