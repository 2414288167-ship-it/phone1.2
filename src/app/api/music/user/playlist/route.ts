import { NextResponse } from "next/server";

// 1. 强制动态模式
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { cookie } = await request.json();
    if (!cookie) {
      return NextResponse.json({ error: "No cookie" }, { status: 401 });
    }

    // 2. 动态导入库
    // @ts-ignore
    const { user_account, user_playlist, playlist_track_all } = await import(
      "NeteaseCloudMusicApi"
    );

    // 关键点：加了 : any
    const userRes: any = await user_account({ cookie });
    const userId = userRes.body.account?.id;

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const playlistRes: any = await user_playlist({
      uid: userId,
      limit: 1,
      cookie,
    });

    if (!playlistRes.body.playlist || playlistRes.body.playlist.length === 0) {
      return NextResponse.json({ error: "No playlist found" }, { status: 404 });
    }

    const playlistId = playlistRes.body.playlist[0].id;

    const tracksRes: any = await playlist_track_all({
      id: playlistId,
      limit: 50,
      cookie,
    });

    return NextResponse.json({ songs: tracksRes.body.songs });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
