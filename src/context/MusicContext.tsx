"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
} from "react";

// 1. 定义类型
export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  source?: "netease" | "local" | "url";
  realUrl?: string;
  lyric?: string;
  tlyric?: string;
}

interface MusicContextType {
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  playMode: "sequence" | "loop" | "shuffle";
  isSharedMode: boolean;

  addToPlaylist: (songs: Song[]) => void;
  playSong: (index: number) => Promise<void>;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleMode: () => void;
  clearPlaylist: () => void;
  deleteSong: (index: number) => void;
  seek: (time: number) => void;
  startSharedMode: () => void;
  stopSharedMode: () => void;

  audioRef: React.RefObject<HTMLAudioElement>;
}

const MusicContext = createContext<MusicContextType | null>(null);

// 🔥 定义缓存 Key
const STORAGE_KEY_PLAYLIST = "netease_playlist_cache";
const STORAGE_KEY_INDEX = "netease_current_index";

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playMode, setPlayMode] = useState<"sequence" | "loop" | "shuffle">(
    "sequence"
  );
  const [isSharedMode, setIsSharedMode] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🔥🔥🔥 新增：初始化时从 LocalStorage 恢复歌单 🔥🔥🔥
  useEffect(() => {
    try {
      const cachedList = localStorage.getItem(STORAGE_KEY_PLAYLIST);
      const cachedIndex = localStorage.getItem(STORAGE_KEY_INDEX);

      if (cachedList) {
        const parsedList = JSON.parse(cachedList);
        if (Array.isArray(parsedList) && parsedList.length > 0) {
          setPlaylist(parsedList);
          console.log(`[MusicContext] 💾 已恢复 ${parsedList.length} 首歌曲`);

          // 如果有上次播放的索引，也一并恢复
          if (cachedIndex) {
            const idx = Number(cachedIndex);
            if (!isNaN(idx) && idx >= 0 && idx < parsedList.length) {
              setCurrentIndex(idx);
              setCurrentSong(parsedList[idx]); // 恢复当前显示的歌曲信息
            }
          }
        }
      }
    } catch (e) {
      console.error("[MusicContext] 读取缓存失败:", e);
    }
  }, []);

  // 🔥🔥🔥 新增：当歌单或索引变化时，自动存入 LocalStorage 🔥🔥🔥
  useEffect(() => {
    if (playlist.length > 0) {
      localStorage.setItem(STORAGE_KEY_PLAYLIST, JSON.stringify(playlist));
    }
  }, [playlist]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_INDEX, String(currentIndex));
  }, [currentIndex]);

  // --- 核心播放逻辑 ---
  const playSong = async (index: number) => {
    if (index < 0 || index >= playlist.length) return;

    let targetSong = playlist[index];

    // 1. 救援逻辑：仅处理音频链接，绝不在此处请求歌词！
    if (targetSong.source === "netease") {
      console.log(`[MusicContext] 准备播放: ${targetSong.title}`);
      try {
        if (audioRef.current) audioRef.current.pause();

        const res = await fetch("/api/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_song_url",
            id: targetSong.id,
            cookie: localStorage.getItem("netease_cookie"),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const freshUrl = data.data?.[0]?.url;
          if (freshUrl) {
            const safeUrl = freshUrl.replace(/^http:\/\//, "https://");
            targetSong = { ...targetSong, url: safeUrl, realUrl: safeUrl };
            // 更新播放列表 (为了缓存链接)
            setPlaylist((prev) => {
              const newList = [...prev];
              newList[index] = targetSong;
              return newList;
            });
          }
        }
      } catch (e) {
        console.error("链接救援微小异常:", e);
      }
    }

    // 2. 播放音频
    setCurrentIndex(index);
    setCurrentSong(targetSong); // 这里设置后，会触发下方的 useEffect 去加载歌词
    setIsPlaying(true);

    if (audioRef.current) {
      audioRef.current.src = targetSong.url;
      audioRef.current.play().catch((e) => {
        console.error("播放被拦截:", e);
        setIsPlaying(false);
      });
    }
  };

  // 🔥🔥🔥 新增：分离的歌词加载逻辑 🔥🔥🔥
  // 监听 currentSong 变化，只有当歌曲切换后，延迟加载歌词
  useEffect(() => {
    if (!currentSong) return;

    // 如果已经有歌词，或者不是网易云歌曲，跳过
    if (currentSong.lyric || currentSong.source !== "netease") return;

    const songId = currentSong.id;

    // 延迟 1.5 秒再请求歌词，防止和音频请求冲突
    const timer = setTimeout(() => {
      console.log(`[MusicContext] 准备加载歌词: ${currentSong.title}`);

      fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_lyric",
          id: songId,
          cookie: localStorage.getItem("netease_cookie"),
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          // 🔥 增强调试日志
          if (data.code === 200 && data.lrc) {
            console.log(`[Lyric Fetch] ✅ 成功: ${currentSong.title}`);
            setPlaylist((prev) =>
              prev.map((s) =>
                s.id === songId
                  ? { ...s, lyric: data.lrc, tlyric: data.tlyric }
                  : s
              )
            );
            setCurrentSong((curr) =>
              curr?.id === songId
                ? { ...curr, lyric: data.lrc, tlyric: data.tlyric }
                : curr
            );
          } else {
            // 后端返回了“无歌词”或错误信息
            console.warn(
              `[Lyric Fetch] ❌ 失败: ${data.msg || "后端未返回歌词"}`
            );
            // 存入一个占位符，防止重复请求
            setPlaylist((prev) =>
              prev.map((s) =>
                s.id === songId ? { ...s, lyric: "[00:00.00]暂无歌词" } : s
              )
            );
            setCurrentSong((curr) =>
              curr?.id === songId
                ? { ...curr, lyric: "[00:00.00]暂无歌词" }
                : curr
            );
          }
        })
        .catch((e) => {
          console.error("[Lyric Fetch] ❌ 网络错误:", e);
        });
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentSong?.id]); // 仅当歌曲 ID 变化时触发

  const togglePlay = () => {
    if (!currentSong) {
      if (playlist.length > 0) playSong(0);
      return;
    }
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const nextSong = () => {
    if (playlist.length === 0) return;
    let nextIndex = currentIndex + 1;
    if (playMode === "shuffle")
      nextIndex = Math.floor(Math.random() * playlist.length);
    else if (nextIndex >= playlist.length) nextIndex = 0;
    playSong(nextIndex);
  };

  const prevSong = () => {
    if (playlist.length === 0) return;
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = playlist.length - 1;
    playSong(prevIndex);
  };

  const addToPlaylist = (songs: Song[]) => {
    setPlaylist((prev) => [
      ...prev,
      ...songs.filter((s) => !prev.some((p) => p.id === s.id)),
    ]);
    if (!currentSong && songs.length > 0)
      setTimeout(() => playSong(playlist.length), 100);
  };

  const deleteSong = (index: number) => {
    setPlaylist((prev) => prev.filter((_, i) => i !== index));
    if (index === currentIndex) nextSong();
    else if (index < currentIndex) setCurrentIndex(currentIndex - 1);
  };

  const clearPlaylist = () => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setCurrentSong(null);
    setIsPlaying(false);
    localStorage.removeItem(STORAGE_KEY_PLAYLIST); // 🔥 清空时也清除缓存
    localStorage.removeItem(STORAGE_KEY_INDEX);
    if (audioRef.current) audioRef.current.src = "";
  };

  const toggleMode = () => {
    const modes: ("sequence" | "loop" | "shuffle")[] = [
      "sequence",
      "loop",
      "shuffle",
    ];
    setPlayMode(modes[(modes.indexOf(playMode) + 1) % modes.length]);
  };

  const seek = (time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
  };
  const startSharedMode = () => setIsSharedMode(true);
  const stopSharedMode = () => setIsSharedMode(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration)
        setProgress((audio.currentTime / audio.duration) * 100);
    };
    const handleEnded = () => {
      if (playMode === "loop") {
        audio.currentTime = 0;
        audio.play();
      } else nextSong();
    };
    const handleError = () => {
      console.error("音频资源无效，尝试下一首");
      if (playlist.length > 1 && isPlaying) setTimeout(nextSong, 2000);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [currentSong, playMode, playlist, currentIndex, isPlaying]);

  return (
    <MusicContext.Provider
      value={{
        playlist,
        currentIndex,
        currentSong,
        isPlaying,
        progress,
        currentTime,
        playMode,
        isSharedMode,
        addToPlaylist,
        playSong,
        togglePlay,
        nextSong,
        prevSong,
        toggleMode,
        clearPlaylist,
        deleteSong,
        seek,
        startSharedMode,
        stopSharedMode,
        audioRef,
      }}
    >
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        // @ts-ignore
        referrerPolicy="no-referrer"
      />
      {children}
    </MusicContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicContext);
  if (!context)
    throw new Error("useMusicPlayer must be used within a MusicProvider");
  return context;
};
