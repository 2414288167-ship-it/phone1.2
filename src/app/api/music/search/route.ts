import { NextResponse } from "next/server";
// @ts-ignore
import { cloudsearch, song_url, artist_top_song } from "NeteaseCloudMusicApi";

// --- 辅助函数 ---
const fetchJson = async (url: string) => {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
};

// ==========================================
// 1. 全网聚合搜索 (酷我/酷狗/咪咕)
// ==========================================
async function searchAggregateSource(keywords: string, source: string) {
  try {
    const encoded = encodeURIComponent(keywords.replace(/\s/g, ""));
    const url = `https://music-api.gdstudio.xyz/api.php?btwaf=20639888&types=search&source=${source}&name=${encoded}&count=10&pages=1`;
    const res = await fetchJson(url);
    if (!res || !Array.isArray(res)) return [];

    return res.map((item: any) => ({
      id: String(item.id),
      title: item.name,
      artist: item.artist?.map
        ? item.artist.map((a: any) => a.name).join("/")
        : item.artist || "未知",
      cover:
        item.pic ||
        "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80",
      source: item.source,
      provider: "aggregate", // 标记为聚合源
      url_id: item.id,
    }));
  } catch (e) {
    return [];
  }
}

// ==========================================
// 2. 替身寻找逻辑 (自动救援)
// ==========================================
async function findReplacementUrl(title: string, artist: string) {
  const keyword = encodeURIComponent(`${title} ${artist}`);
  // console.log(`🚑 [启动救援] 正在全网搜索替身: ${title} - ${artist}`);

  // 1. 咪咕 (正版无损)
  try {
    const miguSearch = await fetchJson(
      `https://music-api.gdstudio.xyz/api.php?btwaf=20639888&types=search&source=migu&name=${keyword}&count=1&pages=1`
    );
    if (miguSearch?.[0]?.id) {
      const urlRes = await fetchJson(
        `https://music-api.gdstudio.xyz/api.php?btwaf=20639888&types=url&source=migu&id=${miguSearch[0].id}&br=320`
      );
      const url = urlRes?.url || urlRes?.data?.url;
      if (url) return url;
    }
  } catch (e) {}

  // 2. 酷我
  try {
    const kuwoSearch = await fetchJson(
      `https://music-api.gdstudio.xyz/api.php?btwaf=20639888&types=search&source=kuwo&name=${keyword}&count=1&pages=1`
    );
    if (kuwoSearch?.[0]?.id) {
      const urlRes = await fetchJson(
        `https://music-api.gdstudio.xyz/api.php?btwaf=20639888&types=url&source=kuwo&id=${kuwoSearch[0].id}&br=320`
      );
      const url = urlRes?.url || urlRes?.data?.url;
      if (url) return url;
    }
  } catch (e) {}

  return "";
}

// ==========================================
// 3. 智能搜索 (网易云逻辑)
// ==========================================
async function searchNeteaseInternal(keywords: string, cookie: string | null) {
  try {
    // 搜单曲 (带 Cookie)
    const res: any = await cloudsearch({
      keywords: keywords,
      type: 1,
      limit: 30,
      cookie: cookie || "",
      realIP: "116.25.146.177",
    } as any);

    // 搜歌手热歌 (辅助)
    let artistSongs: any[] = [];
    try {
      const artistRes: any = await cloudsearch({
        keywords,
        type: 100,
        limit: 1,
        cookie: cookie || "",
        realIP: "116.25.146.177",
      } as any);
      const artist = artistRes.body?.result?.artists?.[0];
      if (
        artist &&
        (artist.name === keywords || keywords.includes(artist.name))
      ) {
        const topRes: any = await artist_top_song({
          id: artist.id,
          cookie: cookie || "",
          realIP: "116.25.146.177",
        } as any);
        if (topRes.body?.songs) {
          artistSongs = topRes.body.songs.map((s: any) => ({
            id: String(s.id),
            title: s.name,
            artist: s.ar ? s.ar.map((a: any) => a.name).join("/") : "未知",
            cover: s.al ? s.al.picUrl : "",
            source: "netease",
            provider: "netease",
            isVip: s.fee === 1 || s.fee === 4,
          }));
        }
      }
    } catch (e) {}

    let normalSongs: any[] = [];
    if (res.body?.result?.songs) {
      normalSongs = res.body.result.songs.map((s: any) => ({
        id: String(s.id),
        title: s.name,
        artist: s.ar ? s.ar.map((a: any) => a.name).join("/") : "未知",
        cover: s.al ? s.al.picUrl : "",
        source: "netease",
        provider: "netease",
        isVip: s.fee === 1 || s.fee === 4,
      }));
    }

    // 合并：歌手热歌排前面
    return [...artistSongs, ...normalSongs];
  } catch (e) {
    return [];
  }
}

// ==========================================
// 4. 获取播放链接
// ==========================================
async function getPlayUrl(
  id: string,
  cookie: string,
  provider: string,
  source: string,
  title?: string,
  artist?: string
) {
  // A. 聚合源直接获取
  if (provider === "aggregate") {
    const urlRes = await fetchJson(
      `https://music-api.gdstudio.xyz/api.php?btwaf=20639888&types=url&source=${source}&id=${id}&br=320`
    );
    return urlRes?.url || urlRes?.data?.url || "";
  }

  // B. 网易云源
  if (source === "netease") {
    try {
      // 先尝试官方接口
      const res: any = await song_url({
        id: id,
        // 如果有cookie，尝试无损；否则标准
        level: cookie ? "lossless" : "standard",
        cookie: cookie,
        realIP: "116.25.146.177",
      } as any);

      const data = res.body?.data?.[0];
      let officialUrl = "";

      // 判断官方链接是否可用
      if (
        data?.url &&
        (data.fee === 0 || data.fee === 8 || (data.fee === 1 && cookie))
      ) {
        officialUrl = data.url;
      }

      // 🔥 关键：如果官方没链接(是VIP但没登录，或下架)，或者官方链接有问题
      // 启动救援！
      if (!officialUrl && title && artist) {
        const rescueUrl = await findReplacementUrl(title, artist);
        if (rescueUrl) return rescueUrl;
      }

      // 实在不行，返回官方链接（可能是试听或空）
      return (
        officialUrl || `https://music.163.com/song/media/outer/url?id=${id}.mp3`
      );
    } catch (e) {
      // 报错时也尝试救援
      if (title && artist) {
        const rescueUrl = await findReplacementUrl(title, artist);
        if (rescueUrl) return rescueUrl;
      }
      return "";
    }
  }

  return "";
}

// ==========================================
// Main Handler
// ==========================================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const keywords = searchParams.get("keywords");
  // 默认为 netease
  const type = searchParams.get("type") || "netease";
  const cookie = request.headers.get("cookie") || "";

  // --- A. 获取链接 ---
  if (action === "url") {
    const id = searchParams.get("id");
    const title = searchParams.get("title") || "";
    const artist = searchParams.get("artist") || "";
    const provider = searchParams.get("provider") || "netease";
    const source = searchParams.get("source") || "netease";

    if (!id) return NextResponse.json({ url: "" });

    // 这里 cookie 直接传，getPlayUrl 内部会判断有没有值
    const url = await getPlayUrl(id, cookie, provider, source, title, artist);

    return NextResponse.json({ url });
  }

  // --- B. 搜索歌曲 ---
  if (!keywords) return NextResponse.json({ list: [] });

  let results: any[] = [];

  // 1. 网易云 (VIP/匿名 混合逻辑)
  if (type === "netease") {
    results = await searchNeteaseInternal(keywords, cookie);
  }
  // 2. 全网聚合
  else if (type === "aggregate") {
    const [kuwo, kugou, migu] = await Promise.all([
      searchAggregateSource(keywords, "kuwo"),
      searchAggregateSource(keywords, "kugou"),
      searchAggregateSource(keywords, "migu"),
    ]);
    results = [...kuwo, ...kugou, ...migu];
  }

  // 去重
  const uniqueSongs: any[] = [];
  const seen = new Set();
  results.forEach((song) => {
    const key = type === "aggregate" ? `${song.title}-${song.artist}` : song.id;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSongs.push(song);
    }
  });

  return NextResponse.json({ list: uniqueSongs.slice(0, 50) });
}
