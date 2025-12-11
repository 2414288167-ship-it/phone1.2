import { NextResponse } from "next/server";

// 1. 强制动态模式
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 2. 动态导入库 (构建时忽略，运行时加载)
    // @ts-ignore
    const { login_qr_key, login_qr_create } = await import(
      "NeteaseCloudMusicApi"
    );

    const keyRes: any = await login_qr_key({});
    const key = keyRes.body.data.unikey;

    const qrRes: any = await login_qr_create({ key, qrimg: true });

    return NextResponse.json({ key, qrimg: qrRes.body.data.qrimg });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
