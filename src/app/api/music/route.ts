import { NextRequest, NextResponse } from "next/server";

// 1. 强制动态模式
export const dynamic = "force-dynamic";

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
    // 2. 动态导入整个库
    // @ts-ignore
    const NeteaseCloudMusicApi = await import("NeteaseCloudMusicApi");

    const body: MusicRequestBody = await req.json();
    const { action, ...params } = body;
    const cookie = params.cookie || "";

    // 从动态加载的库中解构
    const {
      cloudsearch,
      song_url,
      login_qr_key,
      login_qr_create,
      login_qr_check,
      user_account,
      user_playlist,
    } = NeteaseCloudMusicApi;

    console.log(`[API Check] Action: ${action}`);

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
