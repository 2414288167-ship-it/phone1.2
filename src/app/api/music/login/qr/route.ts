import { NextResponse } from "next/server";
// @ts-ignore
import { login_qr_key, login_qr_create } from "NeteaseCloudMusicApi";

export async function GET() {
  try {
    const keyRes = await login_qr_key({});
    const key = keyRes.body.data.unikey;
    const qrRes = await login_qr_create({ key, qrimg: true });
    return NextResponse.json({ key, qrimg: qrRes.body.data.qrimg });
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
