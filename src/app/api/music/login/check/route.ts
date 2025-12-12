import { NextResponse } from "next/server";
// @ts-ignore
import { login_qr_check } from "NeteaseCloudMusicApi";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) return NextResponse.json({ error: "No key" });

  try {
    const res = await login_qr_check({ key });
    // 返回 API 的原始结果
    return NextResponse.json(res.body);
  } catch (error) {
    console.error("Check Error:", error); // 在终端打印错误详情
    return NextResponse.json({ error: "检查失败" }, { status: 500 });
  }
}
