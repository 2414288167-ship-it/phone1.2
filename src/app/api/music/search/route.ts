import { NextResponse } from "next/server";

// 1. 强制动态模式
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords");

  if (!keywords) return NextResponse.json({ error: "No keywords" });

  try {
    // 2. 动态导入库
    // @ts-ignore
    const { cloudsearch, song_url } = await import("NeteaseCloudMusicApi");

    // 1. 搜索歌曲
    const searchRes: any = await cloudsearch({ keywords, type: 1, limit: 10 });
    const songs = searchRes.body.result.songs;

    if (!songs || songs.length === 0) return NextResponse.json({ list: [] });

    // 2. 获取歌曲的真实播放链接 (Standard Quality)
    const songIds = songs.map((s: any) => s.id).join(",");

    const urlRes: any = await song_url({
      id: songIds,
      level: "standard",
    } as any);
    const urlMap = new Map();
    // 注意：这里要做个安全检查，防止 data 为空
    if (urlRes.body.data) {
      urlRes.body.data.forEach((item: any) => urlMap.set(item.id, item.url));
    }

    // 3. 组装数据
    const formattedList = songs.map((s: any) => ({
      id: String(s.id),
      title: s.name,
      artist: s.ar.map((a: any) => a.name).join("/"),
      cover: s.al.picUrl,
      // 如果API没返回URL，使用备用规则
      url:
        urlMap.get(s.id) ||
        `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`,
      source: "netease",
    }));

    return NextResponse.json({ list: formattedList });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
