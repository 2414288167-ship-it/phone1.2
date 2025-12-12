import { NextResponse } from "next/server";
// @ts-ignore
import { login_qr_key, login_qr_create } from "NeteaseCloudMusicApi";

// 🔥 强制 Next.js 不缓存此接口，每次都执行 (非常重要)
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. 定义通用参数：防缓存时间戳 + 中国大陆 IP
    const commonParams = {
      timestamp: Date.now(),
      realIP: "116.25.146.177", // 伪造 IP，防止 Vercel 被墙或判定为海外
    };

    // 2. 获取 Key
    const keyRes = await login_qr_key({
      ...commonParams, // 传入参数
    });
    const key = keyRes.body.data.unikey;

    // 3. 生成二维码图片 (Base64)
    const qrRes = await login_qr_create({
      key,
      qrimg: true,
      ...commonParams, // 传入参数
    });

    return NextResponse.json({
      key,
      qrimg: qrRes.body.data.qrimg,
    });
  } catch (e: any) {
    console.error("QR Code Error:", e);
    return NextResponse.json(
      { error: "Failed to generate QR" },
      { status: 500 }
    );
  }
}
