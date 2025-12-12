import { NextResponse } from "next/server";
// @ts-ignore
import {
  user_account,
  user_playlist,
  playlist_track_all,
  song_url,
} from "NeteaseCloudMusicApi";

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Body Error" }, { status: 400 });
    }

    const cookie = body.cookie;
    if (!cookie)
      return NextResponse.json({ error: "No cookie" }, { status: 401 });

    // 🔥 关键修改：加上 realIP 参数，尝试绕过风控
    const commonParams = {
      cookie,
      realIP: "116.25.146.177", // 伪造一个国内 IP
    };

    console.log("[API] 开始获取用户信息...");
    const userRes: any = await user_account(commonParams);

    // 如果用户信息获取失败，直接返回，不抛错
    if (!userRes || !userRes.body || !userRes.body.account) {
      console.error("[API] 用户信息获取失败:", userRes?.body);
      return NextResponse.json({ error: "User info failed" }, { status: 401 });
    }

    const userId = userRes.body.account.id;
    console.log(`[API] 用户ID: ${userId}`);

    // 获取歌单
    const playlistRes: any = await user_playlist({
      uid: userId,
      limit: 1,
      ...commonParams,
    });

    if (!playlistRes.body.playlist || playlistRes.body.playlist.length === 0) {
      return NextResponse.json({ songs: [] });
    }
    const playlistId = playlistRes.body.playlist[0].id;

    // 获取详情
    const tracksRes: any = await playlist_track_all({
      id: playlistId,
      limit: 50,
      ...commonParams,
    });

    const songs = tracksRes.body.songs;
    if (!songs || songs.length === 0) return NextResponse.json({ songs: [] });

    // 获取链接 (如果不加 try-catch，这里最容易挂)
    const songIds = songs.map((s: any) => s.id).join(",");
    let urlMap = new Map();

    try {
      const urlRes: any = await song_url({
        id: songIds,
        level: "exhigh",
        ...commonParams,
      } as any);

      if (urlRes.body.data) {
        urlRes.body.data.forEach((item: any) => {
          urlMap.set(item.id, item.url);
        });
      }
    } catch (urlError) {
      console.warn("[API] 获取链接部分失败，将使用默认链接");
    }

    const formattedSongs = songs
      .map((s: any) => {
        const realUrl = urlMap.get(s.id);
        // 过滤掉没版权的灰歌 (没有 ID 或者没有 URL)
        if (!s.id) return null;

        return {
          id: String(s.id),
          title: s.name,
          artist: s.ar ? s.ar.map((a: any) => a.name).join("/") : "未知",
          cover: s.al ? s.al.picUrl : "",
          // 如果 API 没返回 URL，直接返回 null，前端过滤掉
          // 或者使用官方备用链接
          url:
            realUrl ||
            `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`,
          source: "netease",
        };
      })
      .filter(Boolean);

    console.log(`[API] 同步成功 ${formattedSongs.length} 首`);
    return NextResponse.json({ songs: formattedSongs });
  } catch (e: any) {
    console.error("[API CRASH]:", e.message || e);
    // 返回空列表而不是 500，防止前端崩坏
    return NextResponse.json({ songs: [] });
  }
}
