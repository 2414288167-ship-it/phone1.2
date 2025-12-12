"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  ReactNode,
  useEffect,
  useCallback,
} from "react";

// 歌曲类型
export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  source?: string;
  isVip?: boolean;
  provider?: string;
}

// 播放模式枚举
export type PlayMode = "sequence" | "loop" | "shuffle";

interface MusicContextType {
  // 基础播放状态
  playlist: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  progress: number;
  playMode: PlayMode;
  audioRef: React.RefObject<HTMLAudioElement>;

  // 播放控制方法
  addToPlaylist: (songs: Song[]) => void;
  playSong: (index: number) => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  toggleMode: () => void;
  clearPlaylist: () => void;
  deleteSong: (index: number) => void;
  seek: (time: number) => void; // ✅ 新增：拖动进度条方法

  // 共听模式状态与方法
  isSharedMode: boolean;
  startSharedMode: () => void;
  stopSharedMode: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider = ({ children }: { children: ReactNode }) => {
  // --- 播放器状态 ---
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>("sequence");

  // --- 共听模式状态 ---
  const [isSharedMode, setIsSharedMode] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);

  const currentSong =
    currentIndex >= 0 && currentIndex < playlist.length
      ? playlist[currentIndex]
      : null;

  // --- 初始化：恢复共听状态 ---
  useEffect(() => {
    const savedSharedMode = localStorage.getItem("music_shared_mode");
    if (savedSharedMode === "true") {
      setIsSharedMode(true);
    }
  }, []);

  // --- 共听控制方法 ---
  const startSharedMode = () => {
    setIsSharedMode(true);
    localStorage.setItem("music_shared_mode", "true");
  };

  const stopSharedMode = () => {
    setIsSharedMode(false);
    localStorage.removeItem("music_shared_mode");
  };

  // --- 核心播放逻辑 ---

  // 1. 监听播放进度与自动下一首
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => nextSong();

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentIndex, playlist, playMode]); // 依赖项要全

  // 2. 核心：当 currentSong 变化时，重置并播放 (修复切换与删除问题)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentSong) {
      // 检查是否切歌了 (URL 变了)
      const currentSrc = audio.getAttribute("src");
      if (currentSrc !== currentSong.url) {
        // 切歌：加载新资源
        audio.src = currentSong.url;
        audio.load();
        if (isPlaying) {
          audio.play().catch((e) => console.error("Play error:", e));
        }
      } else {
        // 没切歌 (只是点了暂停/播放)：根据 isPlaying 状态控制
        if (isPlaying) audio.play().catch(() => {});
        else audio.pause();
      }
    } else {
      // 列表空了：停止并重置
      audio.pause();
      audio.src = "";
      setProgress(0);
      setIsPlaying(false);
    }
  }, [currentSong, isPlaying]); // 依赖 currentSong 和 isPlaying

  // --- 控制方法实现 ---

  const addToPlaylist = (songs: Song[]) => {
    setPlaylist((prev) => {
      // 去重
      const existingIds = new Set(prev.map((s) => s.id));
      const filtered = songs.filter((s) => !existingIds.has(s.id));
      const newList = [...prev, ...filtered];

      // 如果列表原本为空，添加后自动播放第一首
      if (prev.length === 0 && newList.length > 0) {
        // 这里需要一点延时让 state 更新，或者直接 setIndex
        setTimeout(() => {
          setCurrentIndex(0);
          setIsPlaying(true);
        }, 0);
      }
      return newList;
    });
  };

  const playSong = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      setIsPlaying(true); // 强制播放
    }
  };

  const togglePlay = () => {
    if (playlist.length === 0) return;
    setIsPlaying(!isPlaying);
  };

  const nextSong = useCallback(() => {
    if (playlist.length === 0) return;
    // 单曲列表：重头放
    if (playlist.length === 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    let nextIndex = currentIndex;
    if (playMode === "shuffle") {
      // 随机模式：随机切，且不重复当前
      do {
        nextIndex = Math.floor(Math.random() * playlist.length);
      } while (nextIndex === currentIndex);
    } else {
      // 顺序/循环模式：下一首
      nextIndex = (currentIndex + 1) % playlist.length;
    }

    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  }, [currentIndex, playlist, playMode]);

  const prevSong = () => {
    if (playlist.length === 0) return;
    if (playlist.length === 1) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }
    let prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    setCurrentIndex(prevIndex);
    setIsPlaying(true);
  };

  const toggleMode = () => {
    const modes: PlayMode[] = ["sequence", "loop", "shuffle"];
    setPlayMode(modes[(modes.indexOf(playMode) + 1) % modes.length]);
  };

  const clearPlaylist = () => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setProgress(0);
    stopSharedMode(); // 清空时退出共听
  };

  // ✅ 修复：删除歌曲逻辑
  const deleteSong = (index: number) => {
    setPlaylist((prev) => {
      const newPlaylist = [...prev];
      newPlaylist.splice(index, 1); // 移除歌曲

      // 如果删除的是当前正在播放的歌
      if (index === currentIndex) {
        if (newPlaylist.length === 0) {
          // 删光了
          setCurrentIndex(-1);
          setIsPlaying(false);
        } else {
          // 切到下一首 (如果删的是最后一首，回第一首)
          // 注意：因为删除了一个，原来的 index 现在指向的就是下一首
          // 除非 index 越界了
          let newIndex = index;
          if (newIndex >= newPlaylist.length) {
            newIndex = 0;
          }
          setCurrentIndex(newIndex);
          // 保持播放状态
        }
      } else if (index < currentIndex) {
        // 如果删的是前面的歌，当前歌曲的索引需要减 1，以保持指向同一首歌
        setCurrentIndex(currentIndex - 1);
      }

      return newPlaylist;
    });
  };

  // ✅ 新增：进度条拖动实现
  const seek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      // 立即更新 UI 进度，防止回跳
      if (audioRef.current.duration) {
        setProgress((time / audioRef.current.duration) * 100);
      }
    }
  };

  // --- Media Session (锁屏控制) ---
  useEffect(() => {
    if ("mediaSession" in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: "AI Chat Player",
        artwork: [
          { src: currentSong.cover, sizes: "512x512", type: "image/jpeg" },
        ],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler("previoustrack", prevSong);
      navigator.mediaSession.setActionHandler("nexttrack", nextSong);
    }
  }, [currentSong]); // 依赖 currentSong 更新元数据

  // --- 实时同步状态给 AI ---
  useEffect(() => {
    if (isPlaying && currentSong) {
      localStorage.setItem(
        "current_music_status",
        `User is listening to: "${currentSong.title}" by ${currentSong.artist}`
      );
    } else {
      localStorage.removeItem("current_music_status");
    }
  }, [currentSong, isPlaying]);

  const value = {
    playlist,
    currentIndex,
    currentSong,
    isPlaying,
    progress,
    playMode,
    audioRef,
    addToPlaylist,
    playSong,
    togglePlay,
    nextSong,
    prevSong,
    toggleMode,
    clearPlaylist,
    deleteSong,
    seek, // 导出 seek
    isSharedMode,
    startSharedMode,
    stopSharedMode,
  };

  return (
    <MusicContext.Provider value={value}>
      {children}
      {/* Audio 标签不带 src，由 useEffect 控制 src */}
      <audio
        ref={audioRef}
        onError={() => {
          console.warn("播放出错，尝试下一首");
          if (playlist.length > 1) nextSong();
        }}
      />
    </MusicContext.Provider>
  );
};

export const useMusicPlayer = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error("useMusicPlayer must be used within a MusicProvider");
  }
  return context;
};
