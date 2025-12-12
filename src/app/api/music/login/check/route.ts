import { NextRequest, NextResponse } from "next/server";
// @ts-ignore
import { login_qr_check } from "NeteaseCloudMusicApi";

// 强制动态，防止缓存
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return NextResponse.json({ error: "Missing key" }, { status: 400 });
    }

    // 🔥 关键配置：加上 realIP，并将 timestamp 转为数字
    const commonParams = {
      key, // 必须传 key
      timestamp: Date.now(),
      realIP: "116.25.146.177", // 伪造 IP
    };

    // 调用网易云 API
    const res = await login_qr_check(commonParams);

    // 🔥 调试日志
    console.log("[QR Check Result]", res.body);

    return NextResponse.json(res.body);
  } catch (e: any) {
    console.error("[QR Check Error]", e);
    // 返回 200 而不是 500，防止前端直接炸，让前端处理错误码
    return NextResponse.json({ code: 500, message: "Check failed" });
  }
}
