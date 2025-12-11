import { NextRequest, NextResponse } from "next/server";
// 假设你用了 Vercel KV (Redis)
// import { kv } from "@vercel/kv";

export async function POST(request: NextRequest) {
  const { subscription, settings } = await request.json();

  // 将订阅信息存入数据库
  // Key 可以是用户的设备指纹或者登录 ID
  // await kv.set(`user_sub_${subscription.endpoint}`, { subscription, settings });

  // 模拟数据库操作
  console.log("收到订阅:", subscription);

  return NextResponse.json({ success: true });
}
