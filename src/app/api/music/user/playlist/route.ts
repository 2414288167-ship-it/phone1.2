import { NextResponse } from "next/server";
import type { Request } from "next/server";

// 1. 定义所有接口返回类型（匹配网易云API真实返回结构）
interface UserAccountResponse {
  body: {
    code: number;
    account?: {
      id: number;
    };
    cookie?: string;
  };
}

interface PlaylistResponse {
  body: {
    code: number;
    playlist: Array<{
      id: number;
      name: string;
      creator: {
        userId: number;
      };
    }>;
  };
}

interface TracksResponse {
  body: {
    code: number;
    tracks: any[]; // 可根据需要细化：如 {id: number, name: string, ar: Array<{name: string}>}
  };
}

// 2. 动态导入网易云API（移除@ts-ignore，依赖类型声明）
const importNeteaseApi = async () => {
  const { user_account, user_playlist, playlist_track_all } = await import(
    "NeteaseCloudMusicApi"
  );
  return { user_account, user_playlist, playlist_track_all };
};

export async function POST(request: Request) {
  try {
    console.log("[API] 开始获取用户信息...");

    // 3. 获取前端传递的Cookie（前端需把登录后的网易云Cookie传过来）
    const requestBody = await request.json();
    const { cookie = "" } = requestBody;

    // 4. 构造通用参数（携带Cookie+请求头，避免被网易云拦截）
    const commonParams = {
      cookie,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://music.163.com/",
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    // 5. 导入API并获取用户ID
    const { user_account, user_playlist, playlist_track_all } =
      await importNeteaseApi();
    const userRes: UserAccountResponse = await user_account(commonParams);

    // 校验用户信息是否获取成功
    if (!userRes.body || !userRes.body.account || userRes.body.code !== 200) {
      console.error("[API] 用户信息获取失败：", userRes.body);
      return NextResponse.json({ error: "User info failed" }, { status: 401 });
    }
    const userId = userRes.body.account.id;
    console.log("[API] 用户ID：", userId);

    // 6. 获取用户歌单列表（筛选「我喜欢的音乐」歌单）
    const playlistRes: PlaylistResponse = await user_playlist({
      uid: userId,
      limit: 100, // 拉取足够多的歌单，确保能找到「我喜欢的音乐」
      ...commonParams,
    });

    // 校验歌单列表是否获取成功
    if (playlistRes.body.code !== 200 || !playlistRes.body.playlist) {
      console.error("[API] 歌单列表获取失败：", playlistRes.body);
      return NextResponse.json(
        { error: "Playlist list failed" },
        { status: 500 }
      );
    }

    // 找到「我喜欢的音乐」歌单（网易云该歌单名称固定为「我喜欢的音乐」）
    const likePlaylist = playlistRes.body.playlist.find(
      (item) => item.name === "我喜欢的音乐" && item.creator.userId === userId
    );
    if (!likePlaylist) {
      console.error("[API] 未找到「我喜欢的音乐」歌单");
      return NextResponse.json(
        { error: "Like playlist not found" },
        { status: 404 }
      );
    }
    const playlistId = likePlaylist.id;
    console.log("[API] 我喜欢的音乐歌单ID：", playlistId);

    // 7. 获取歌单内的所有歌曲（修正tracks字段，替代原错误的songs）
    const tracksRes: TracksResponse = await playlist_track_all({
      id: playlistId,
      limit: 1000, // 拉取最多1000首歌
      ...commonParams,
    });

    // 校验歌曲列表是否获取成功
    if (tracksRes.body.code !== 200) {
      console.error("[API] 歌单歌曲获取失败：", tracksRes.body);
      return NextResponse.json(
        { error: "Tracks fetch failed" },
        { status: 500 }
      );
    }

    const songs = tracksRes.body.tracks || [];
    console.log(`[API] 成功获取${songs.length}首喜欢的歌曲`);

    // 8. 返回最终结果
    return NextResponse.json({
      userId,
      playlistId,
      songs,
    });
  } catch (error) {
    // 全局错误捕获
    console.error("[API] 整体流程错误：", error);
    return NextResponse.json(
      { error: "Playlist fetch failed", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
