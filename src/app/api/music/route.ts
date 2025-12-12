import { NextRequest, NextResponse } from "next/server";

// 使用 require 导入
const NeteaseApi = require("NeteaseCloudMusicApi");

export const dynamic = "force-dynamic";

// 🔥 新增：重试辅助函数 🔥
// 如果遇到 ECONNRESET 或网络错误，自动重试最多 3 次
async function fetchWithRetry(apiFn: Function, params: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await apiFn(params);
    } catch (error: any) {
      const isNetworkError =
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.status == 502;
      // 如果是最后一次尝试，或者不是网络错误，直接抛出
      if (i === retries - 1 || !isNetworkError) {
        throw error;
      }
      console.warn(
        `[API Retry] 请求失败 (${error.code || error.status})，正在进行第 ${
          i + 1
        } 次重试...`
      );
      // 等待 300ms 再重试，给网络一点缓冲
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, cookie, ...params } = body;

    // 通用参数
    const commonParams = {
      cookie: cookie || "",
      timestamp: Date.now(),
      os: "pc",
      realIP: undefined, // 国内环境不传 realIP
      proxy: undefined,
    };

    let resultData = null;

    switch (action) {
      case "get_liked_playlist":
        if (!cookie) return NextResponse.json({ code: 401, msg: "No cookie" });

        // 1. 获取 UserID
        let userId = null;
        try {
          const loginStatus = await fetchWithRetry(
            NeteaseApi.login_status,
            commonParams
          );
          userId = loginStatus.body.data?.profile?.userId;
        } catch (e: any) {
          console.warn("[API] UserID 获取波动:", e.message);
        }

        // 2. 获取歌单列表
        const playlistRes = await fetchWithRetry(NeteaseApi.user_playlist, {
          uid: userId,
          limit: 30,
          ...commonParams,
        });

        const playlists = playlistRes.body.playlist || [];
        if (playlists.length === 0) {
          return NextResponse.json({ code: 404, msg: "未找到歌单" });
        }

        // 3. 锁定歌单
        const likedPlaylist =
          playlists.find((p: any) => p.specialType === 5) || playlists[0];
        console.log(`[API Music] 锁定歌单: ${likedPlaylist.name}`);

        // 4. 获取歌曲 (仅取前 12 首)
        // 读取前端传来的分页参数，如果没有传，则默认获取前 100 首
        // 如果你想一次同步更多，可以把 100 改成 300 或 500
        const defaultLimit = 50;
        const limit = params.limit || defaultLimit;
        const offset = params.offset || 0;

        console.log(
          `[API Music] 获取歌曲列表: limit=${limit}, offset=${offset}`
        );

        // 4. 获取歌曲详情
        const trackRes = await fetchWithRetry(NeteaseApi.playlist_track_all, {
          id: likedPlaylist.id,
          limit: limit, // 使用动态数量
          offset: offset, // 使用动态偏移量
          ...commonParams,
        });

        const songs = trackRes.body.songs || [];

        // 5. 返回给前端（不批量获取 URL，防止风控）
        resultData = {
          code: 200,
          songs: songs,
        };
        break;

      case "get_song_url":
        console.log(`[API] 正在获取歌曲 URL: ${params.id}`);
        let finalUrl = null;

        // 🔥 阶段一：尝试获取 exhigh (极高音质) + 重试机制
        try {
          const urlRes = await fetchWithRetry(NeteaseApi.song_url, {
            id: params.id,
            level: "exhigh",
            ...commonParams,
          });
          finalUrl = urlRes.body.data?.[0]?.url;
        } catch (e) {
          console.warn(`[API] 极高音质获取异常，准备降级`);
        }

        // 🔥 阶段二：标准音质
        if (!finalUrl) {
          try {
            const urlRes = await fetchWithRetry(NeteaseApi.song_url, {
              id: params.id,
              level: "standard",
              ...commonParams,
            });
            finalUrl = urlRes.body.data?.[0]?.url;
          } catch (e) {
            console.error(`[API] 标准音质也获取失败`);
          }
        }

        // 🔥 阶段三：匿名模式保底
        if (!finalUrl) {
          try {
            const urlRes = await fetchWithRetry(NeteaseApi.song_url, {
              id: params.id,
              level: "standard",
              timestamp: Date.now(),
              realIP: undefined,
            });
            finalUrl = urlRes.body.data?.[0]?.url;
          } catch (e) {}
        }

        if (!finalUrl) {
          resultData = { code: 404, msg: "无法获取播放链接" };
        } else {
          console.log(`[API] 获取成功: ${finalUrl.substring(0, 30)}...`);
          resultData = { data: [{ url: finalUrl }] };
        }
        break; // ✅ 确保这里有 break，防止执行到 get_lyric

      case "get_lyric":
        try {
          const lyricRes = await fetchWithRetry(NeteaseApi.lyric, {
            id: params.id,
            ...commonParams,
          });

          if (lyricRes.body.code !== 200 || !lyricRes.body.lrc) {
            resultData = {
              code: 404,
              msg: "No lyric found",
              lrc: "[00:00.00]暂无歌词",
            };
          } else {
            resultData = {
              code: 200,
              lrc: lyricRes.body.lrc.lyric || "[00:00.00]暂无歌词",
              tlyric: lyricRes.body.tlyric?.lyric || "",
            };
          }
        } catch (e) {
          console.error(`[API Lyric Error] ID: ${params.id}`, e);
          resultData = {
            code: 500,
            msg: "获取歌词失败",
            lrc: "[00:00.00]获取歌词失败",
          };
        }
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json(resultData);
  } catch (error: any) {
    console.error("[Music API Critical Error]", error);
    return NextResponse.json({
      code: 500,
      msg: `API Error: ${error.message}`,
      details: error.toString(),
    });
  }
}
