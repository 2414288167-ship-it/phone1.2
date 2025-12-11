import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // 获取前端传来的地点，如果没有传，默认查 "Shanghai" (避免显示 Vercel 服务器所在的美国天气)
  const location = searchParams.get("location") || "Shanghai";

  // format=3: 简洁模式 (例如: 上海: 🌤️ +18°C)
  // lang=zh: 强制中文
  const targetUrl = `https://wttr.in/${encodeURIComponent(
    location
  )}?format=3&lang=zh`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0", // 伪装浏览器，防止被拦截
      },
      // 5秒超时
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Upstream error: ${res.status}`);
    }

    const text = await res.text();
    // wttr 有时候会返回 html 报错页面，判断一下是否包含 html 标签
    if (text.includes("<html")) {
      throw new Error("Invalid response");
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error) {
    console.error("Weather Proxy Error:", error);
    // 失败了返回空，但不报错 500，保证前端不红
    return NextResponse.json({ text: "" });
  }
}
