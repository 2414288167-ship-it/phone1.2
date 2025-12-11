import { NextResponse } from "next/server";

// 1. 这一行是告诉 Vercel：别在那预先构建我，有人访问再动
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return NextResponse.json({ error: "No key provided" }, { status: 400 });
  }

  try {
    // 2. 【核心救命代码】
    // 只有当这个函数被执行时（也就是部署成功后有人访问时）
    // 才去加载网易云的库。构建的时候，这行代码不会跑！
    // @ts-ignore
    const { login_qr_check } = await import("NeteaseCloudMusicApi");

    // 3. 调用 API
    // @ts-ignore
    const res = await login_qr_check({ key });

    return NextResponse.json(res.body);
  } catch (e) {
    console.error("Login Check Error:", e);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
