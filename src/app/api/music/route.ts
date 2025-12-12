import { NextRequest, NextResponse } from "next/server";
// ⬇️⬇️⬇️ 核心技术：使用 Node.js 原生 createRequire
// 这能像在纯 Node 环境一样加载库，绝对不会出错
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// 动态加载库
const NeteaseCloudMusicApi = require("netease-cloud-music-api");

interface MusicRequestBody {
  action: string;
  cookie?: string;
  [key: string]: any;
}

// 代理请求执行函数
async function handleNeteaseRequest(
  apiFunc: any,
  query: any,
  cookie: string = ""
) {
  try {
    const result = await apiFunc({
      ...query,
      cookie,
      realIP: "114.114.114.114", // 伪造国内IP
    });
    return result;
  } catch (error: any) {
    return {
      status: 200,
      body: {
        code: 500,
        msg: error.message || "Server Error",
        data: null,
      },
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: MusicRequestBody = await req.json();
    const { action, ...params } = body;
    const cookie = params.cookie || "";

    // 从库中解构我们需要的方法
    // 只要第一步安装正确，这些方法 100% 会存在
    const {
      cloudsearch,
      song_url,
      login_qr_key,
      login_qr_create,
      login_qr_check,
      user_account,
      user_playlist,
    } = NeteaseCloudMusicApi;

    // 🔴 调试日志：再次打印 Keys，确认这次是对的
    // 正确的输出应该包含：cloudsearch, login_qr_key 等下划线命名的函数
    console.log(`[API Check] Action: ${action}`);
    if (action === "qr_key" && !login_qr_key) {
      console.error(
        "❌ 严重错误：库加载成功，但函数名不对！当前库包含:",
        Object.keys(NeteaseCloudMusicApi).slice(0, 10)
      );
      return NextResponse.json(
        { code: 500, msg: "Library Mismatch" },
        { status: 500 }
      );
    }

    let result;

    // 路由分发
    switch (action) {
      case "search":
        result = await handleNeteaseRequest(
          cloudsearch,
          { keywords: params.keywords, limit: 30 },
          cookie
        );
        break;
      case "song_url":
        result = await handleNeteaseRequest(
          song_url,
          { id: params.id },
          cookie
        );
        break;
      case "qr_key":
        result = await handleNeteaseRequest(login_qr_key, {}, cookie);
        break;
      case "qr_create":
        result = await handleNeteaseRequest(
          login_qr_create,
          { key: params.key, qrimg: true },
          cookie
        );
        break;
      case "qr_check":
        result = await handleNeteaseRequest(
          login_qr_check,
          { key: params.key },
          cookie
        );
        break;
      case "user_account":
        result = await handleNeteaseRequest(user_account, {}, cookie);
        break;
      case "user_playlist":
        result = await handleNeteaseRequest(
          user_playlist,
          { uid: params.uid },
          cookie
        );
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(
      result?.body || { code: 500, msg: "No body returned" }
    );
  } catch (err: any) {
    console.error("[System Error]", err);
    return NextResponse.json({ code: 500, msg: err.message }, { status: 500 });
  }
}
