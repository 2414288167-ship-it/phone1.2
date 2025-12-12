"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useMusicPlayer, Song } from "@/context/MusicContext";
import {
  ChevronLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ListMusic,
  Heart,
  Upload,
  X,
  Trash2,
  Search,
  Link as LinkIcon,
  QrCode,
  Globe,
  FolderOpen,
  Music,
  LogIn,
  Repeat,
  Repeat1,
  Shuffle,
  Loader2,
  LogOut,
  Layers,
  Cloud,
  Zap,
} from "lucide-react";

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80";
const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e2e8f0'%3E%3Crect width='24' height='24' fill='white'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%23cbd5e1'/%3E%3C/svg%3E";

// 🔥 只保留这两个核心分类
type SearchSource = "netease" | "aggregate";

export default function MusicPage() {
  const {
    playlist,
    currentIndex,
    currentSong,
    isPlaying,
    progress,
    playMode,
    addToPlaylist,
    playSong,
    togglePlay,
    nextSong,
    prevSong,
    toggleMode,
    clearPlaylist,
    deleteSong,
    audioRef,
    isSharedMode,
    stopSharedMode,
    seek,
  } = useMusicPlayer();

  const [showDrawer, setShowDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState<"playlist" | "search" | "import">(
    "playlist"
  );
  const [bgImage, setBgImage] = useState(DEFAULT_COVER);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  // 默认网易云
  const [searchSource, setSearchSource] = useState<SearchSource>("netease");

  const [inputUrl, setInputUrl] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [qrInfo, setQrInfo] = useState<{ key: string; img: string } | null>(
    null
  );
  const [loginStatus, setLoginStatus] = useState("请使用网易云APP扫码");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [partnerAvatar, setPartnerAvatar] = useState("");
  const [myAvatar, setMyAvatar] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginCheckTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const userProfile = localStorage.getItem("user_profile_v4");
    if (userProfile) {
      try {
        const p = JSON.parse(userProfile);
        setMyAvatar(p.avatar || DEFAULT_AVATAR);
      } catch (e) {}
    }
    const partner = localStorage.getItem("shared_partner_avatar");
    if (partner) setPartnerAvatar(partner);
  }, [isSharedMode]);

  useEffect(() => {
    if (currentSong) setBgImage(currentSong.cover);
  }, [currentSong]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cookie = localStorage.getItem("netease_cookie");
      if (cookie) setIsLoggedIn(true);
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newSongs: Song[] = Array.from(files).map((file) => ({
      id: `local_${Date.now()}_${Math.random()}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "本地音乐",
      url: URL.createObjectURL(file),
      cover: DEFAULT_COVER,
      source: "local",
    }));
    addToPlaylist(newSongs);
    e.target.value = "";
    setShowDrawer(true);
  };

  const handleUrlImport = () => {
    if (!inputUrl) return;
    addToPlaylist([
      {
        id: `url_${Date.now()}`,
        title: "网络歌曲",
        artist: "未知艺术家",
        url: inputUrl,
        cover: DEFAULT_COVER,
        source: "url",
      },
    ]);
    setInputUrl("");
    alert("已添加");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult([]);
    try {
      const res = await fetch(
        `/api/music/search?keywords=${encodeURIComponent(
          searchQuery
        )}&type=${searchSource}`
      );
      const data = await res.json();
      if (data.list && data.list.length > 0) {
        setSearchResult(data.list);
      } else {
        alert("未找到歌曲");
      }
    } catch (e) {
      alert("搜索服务异常，请检查后端日志");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchResult = async (song: any) => {
    if (resolvingId) return;
    setResolvingId(song.id);

    try {
      // 传递 title 和 artist 给后端，以便触发救援
      const res = await fetch(
        `/api/music/search?action=url&id=${song.id}&source=${
          song.source
        }&provider=${song.provider || "netease"}&title=${encodeURIComponent(
          song.title
        )}&artist=${encodeURIComponent(song.artist)}`
      );
      const data = await res.json();

      if (data.url) {
        const newSong: Song = {
          id: song.id,
          title: song.title,
          artist: song.artist,
          cover: song.cover,
          url: data.url,
          source: song.source,
        };
        addToPlaylist([newSong]);
      } else {
        alert("资源不可用 (救援失败)");
      }
    } catch (e) {
      alert("获取链接失败");
    } finally {
      setResolvingId(null);
    }
  };

  const startLogin = async () => {
    setShowLoginModal(true);
    try {
      const res = await fetch("/api/music/login/qr");
      const data = await res.json();
      setQrInfo({ key: data.key, img: data.qrimg });
      if (loginCheckTimer.current) clearInterval(loginCheckTimer.current);
      loginCheckTimer.current = setInterval(async () => {
        const checkRes = await fetch(`/api/music/login/check?key=${data.key}`);
        const checkData = await checkRes.json();
        if (checkData.code === 803) {
          setLoginStatus("登录成功！");
          localStorage.setItem("netease_cookie", checkData.cookie);
          setIsLoggedIn(true);
          clearInterval(loginCheckTimer.current!);
          setTimeout(() => {
            setShowLoginModal(false);
            syncPlaylist(checkData.cookie);
          }, 1000);
        }
      }, 3000);
    } catch (e) {
      setLoginStatus("无法连接后端");
    }
  };

  const syncPlaylist = async (cookie?: string) => {
    const savedCookie = cookie || localStorage.getItem("netease_cookie");
    if (!savedCookie) return startLogin();
    alert("正在连接网易云...");
    try {
      const res = await fetch("/api/music/user/playlist", {
        method: "POST",
        body: JSON.stringify({ cookie: savedCookie }),
      });
      if (!res.ok) throw new Error("API Error");
      const data = await res.json();
      if (data.songs && data.songs.length > 0) {
        const neteaseSongs: Song[] = data.songs.map((s: any) => ({
          id: String(s.id),
          title: s.name,
          artist: s.ar.map((a: any) => a.name).join("/"),
          url: s.url,
          cover: s.al.picUrl,
          source: "netease",
        }));
        addToPlaylist(neteaseSongs);
        alert(`成功同步 ${neteaseSongs.length} 首！`);
      } else {
        alert("同步成功，但歌单为空");
      }
    } catch (e) {
      alert("同步失败，请检查网络或重新登录");
      setIsLoggedIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("netease_cookie");
    setIsLoggedIn(false);
    clearPlaylist();
    alert("已退出");
  };

  const stopLogin = () => {
    setShowLoginModal(false);
    if (loginCheckTimer.current) clearInterval(loginCheckTimer.current);
  };

  const handleQuitSharedMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要退出一起听模式吗？\n退出后将切回私人漫游。")) {
      stopSharedMode();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time =
      (Number(e.target.value) / 100) * (audioRef.current?.duration || 0);
    seek(time);
  };

  return (
    <div className="relative h-screen w-full bg-gray-900 text-white overflow-hidden flex flex-col font-sans select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="audio/*"
        multiple
        className="hidden"
      />
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out opacity-60 blur-3xl scale-125 z-0"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-black/30 z-0" />

      {/* Header */}
      <header className="relative z-50 flex items-center justify-between px-4 h-16 shrink-0">
        <Link
          href="/"
          className="p-2 hover:bg-white/10 rounded-full transition text-white/90 relative z-50"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex flex-col items-center relative z-50">
          <span className="text-base font-bold tracking-wide">Music</span>
          {isSharedMode ? (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleQuitSharedMode}
              className="flex items-center gap-1 bg-green-500/20 border border-green-500/30 text-green-300 px-3 py-1 rounded-full text-[10px] hover:bg-red-500/20 hover:border-red-500/30 hover:text-red-400 transition-all cursor-pointer mt-1 group relative z-50 shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse group-hover:bg-red-500" />
              <span className="group-hover:hidden">双人共听中</span>
              <span className="hidden group-hover:inline flex items-center gap-1 font-bold">
                <LogOut className="w-3 h-3" />
                退出
              </span>
            </button>
          ) : (
            <span className="text-[10px] text-white/60">
              {playlist.length > 0
                ? isPlaying
                  ? "播放中"
                  : "已暂停"
                : "私人漫游"}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="p-2 hover:bg-white/10 rounded-full transition text-white/90 relative z-50"
        >
          <ListMusic className="w-6 h-6" />
        </button>
      </header>

      {/* Main */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-8"
        onClick={() => setShowDrawer(false)}
      >
        {isSharedMode ? (
          // P2 Style
          <div className="relative w-full flex justify-center items-center h-80">
            <svg
              className="absolute w-64 h-32 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none"
              viewBox="0 0 200 100"
            >
              <path
                d="M 20,50 Q 100,100 180,50"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="2"
                className="animate-pulse"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.8)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute top-0 left-[80px] flex flex-col items-center gap-2 animate-float-slow">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 p-1 shadow-[0_0_20px_rgba(255,255,255,0.2)] bg-white/10 backdrop-blur-sm">
                <img
                  src={partnerAvatar || DEFAULT_AVATAR}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              {isPlaying && (
                <div className="flex gap-0.5 h-3 items-end">
                  <div className="w-0.5 bg-green-400 animate-music-bar h-2"></div>
                  <div className="w-0.5 bg-green-400 animate-music-bar h-3 animation-delay-100"></div>
                  <div className="w-0.5 bg-green-400 animate-music-bar h-1 animation-delay-200"></div>
                </div>
              )}
            </div>
            <div className="absolute top-6 right-[80px] flex flex-col items-center gap-2 animate-float-slower">
              <div className="w-14 h-14 rounded-full border-2 border-white/10 p-1 bg-black/20 backdrop-blur-sm">
                <img
                  src={myAvatar || DEFAULT_AVATAR}
                  className="w-full h-full rounded-full object-cover opacity-90"
                />
              </div>
            </div>
            <div className="relative w-48 h-48 rounded-full bg-black border-[4px] border-white/5 shadow-2xl mt-24 flex items-center justify-center">
              <div
                className={`w-full h-full rounded-full overflow-hidden border-[25px] border-[#181818] relative ${
                  isPlaying ? "animate-spin-slow" : ""
                }`}
                style={{ animationPlayState: isPlaying ? "running" : "paused" }}
              >
                <img
                  src={currentSong?.cover || DEFAULT_COVER}
                  className="w-full h-full object-cover opacity-80"
                />
              </div>
            </div>
            <div className="absolute top-24 text-[10px] text-white/40 tracking-widest animate-pulse">
              等待好友加入中... (已连接)
            </div>
          </div>
        ) : (
          // P1 Style
          <>
            <div
              className={`absolute top-0 left-1/2 ml-[-15px] w-24 h-36 z-20 origin-top-left transition-transform duration-500 ease-in-out ${
                isPlaying ? "rotate-0" : "-rotate-[25deg]"
              }`}
              style={{ transformOrigin: "15px 15px" }}
            >
              <div className="w-4 h-4 rounded-full bg-gray-200 absolute top-0 left-0 shadow-lg border border-black/10"></div>
              <div className="w-2 h-24 bg-gradient-to-b from-gray-300 to-gray-400 absolute top-2 left-1 rotate-[15deg]"></div>
              <div className="w-14 h-9 bg-gray-200 rounded-sm absolute bottom-0 left-[-8px] rotate-[15deg] shadow-md"></div>
            </div>
            <div className="relative w-72 h-72 rounded-full bg-[#181818] border-[6px] border-white/5 shadow-2xl flex items-center justify-center">
              <div
                className={`w-full h-full rounded-full overflow-hidden border-[40px] border-[#181818] relative ${
                  isPlaying ? "animate-spin-slow" : ""
                }`}
                style={{ animationPlayState: isPlaying ? "running" : "paused" }}
              >
                <img
                  src={currentSong?.cover || DEFAULT_COVER}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </>
        )}

        <div className="mt-12 text-center px-8 w-full">
          <h2 className="text-2xl font-bold text-white mb-2 truncate drop-shadow-md">
            {currentSong?.title || "等待播放"}
          </h2>
          <p className="text-white/60 text-sm truncate">
            {currentSong?.artist || "请添加歌曲"}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 px-6 pb-12 pt-4 w-full">
        <div className="w-full flex items-center gap-3 text-xs text-white/50 font-mono mb-6">
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <div className="flex-1 relative h-4 flex items-center group">
            <input
              type="range"
              min="0"
              max="100"
              value={progress || 0}
              onChange={handleSeek}
              className="absolute w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer z-20 opacity-0 group-hover:opacity-100 transition-opacity"
            />
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden pointer-events-none absolute z-10">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div
              className="absolute h-3 w-3 bg-white rounded-full shadow pointer-events-none z-10 transition-all duration-100 ease-linear"
              style={{ left: `calc(${progress}% - 6px)` }}
            ></div>
          </div>
          <span>{formatTime(audioRef.current?.duration || 0)}</span>
        </div>
        <div className="flex items-center justify-between px-2">
          <button
            onClick={toggleMode}
            className="text-white/70 hover:text-white transition p-2"
          >
            {playMode === "sequence" && <Repeat className="w-5 h-5" />}
            {playMode === "loop" && (
              <Repeat1 className="w-5 h-5 text-red-400" />
            )}
            {playMode === "shuffle" && (
              <Shuffle className="w-5 h-5 text-red-400" />
            )}
          </button>
          <button
            onClick={prevSong}
            className="text-white hover:text-white/80 active:scale-95 transition"
          >
            <SkipBack className="w-8 h-8 fill-white" />
          </button>
          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg shadow-white/10"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>
          <button
            onClick={nextSong}
            className="text-white hover:text-white/80 active:scale-95 transition"
          >
            <SkipForward className="w-8 h-8 fill-white" />
          </button>
          <button
            onClick={() => setShowDrawer(true)}
            className="text-white/70 hover:text-white transition p-2"
          >
            <ListMusic className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Drawer */}
      <div
        className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          showDrawer ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowDrawer(false)}
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-50 bg-[#1e1e1e] rounded-t-3xl h-[70vh] flex flex-col transition-transform duration-300 ease-out transform ${
          showDrawer ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-center p-4 border-b border-white/5">
          <div className="flex gap-1 p-1 bg-black/30 rounded-full">
            <TabButton
              active={activeTab === "playlist"}
              onClick={() => setActiveTab("playlist")}
              icon={ListMusic}
              label="列表"
            />
            <TabButton
              active={activeTab === "search"}
              onClick={() => setActiveTab("search")}
              icon={Search}
              label="全网搜索"
            />
            <TabButton
              active={activeTab === "import"}
              onClick={() => setActiveTab("import")}
              icon={FolderOpen}
              label="更多"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {/* Playlist 和 Import 内容省略，保持原样 */}
          {activeTab === "playlist" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/40 mb-2 px-2">
                <span>当前播放 ({playlist.length})</span>
                <button onClick={clearPlaylist} className="hover:text-red-400">
                  清空
                </button>
              </div>
              {playlist.map((song, idx) => (
                <div
                  key={idx}
                  onClick={() => playSong(idx)}
                  className={`flex items-center p-3 rounded-xl gap-3 cursor-pointer ${
                    idx === currentIndex ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="text-xs w-4 text-center">
                    {idx === currentIndex ? (
                      <Music className="w-3 h-3 text-red-500 animate-pulse" />
                    ) : (
                      <span className="text-white/30">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm truncate ${
                        idx === currentIndex ? "text-red-400" : "text-white"
                      }`}
                    >
                      {song.title}
                    </div>
                    <div className="text-xs text-white/40 truncate">
                      {song.artist}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSong(idx);
                    }}
                    className="p-2 text-white/20 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 🔥🔥🔥 搜索 Tab (只保留两类) 🔥🔥🔥 */}
          {activeTab === "search" && (
            <div className="flex flex-col h-full">
              {/* 🚀 搜索源切换器 */}
              <div className="flex justify-center gap-2 mb-3">
                {[
                  { id: "netease", label: "网易云音乐", icon: Cloud },
                  { id: "aggregate", label: "全网聚合", icon: Layers },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSearchSource(item.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                      searchSource === item.id
                        ? "bg-red-600 text-white shadow-md scale-105"
                        : "bg-white/5 text-white/50 hover:bg-white/10"
                    }`}
                  >
                    <item.icon className="w-3 h-3" />
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-4">
                <div className="flex-1 bg-white/10 rounded-full flex items-center px-3">
                  <Search className="w-4 h-4 text-white/40" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder={`搜索 ${
                      searchSource === "netease"
                        ? "网易云音乐 (VIP歌取不包含)..."
                        : "全网资源 (酷我/酷狗)..."
                    }`}
                    className="bg-transparent border-none outline-none text-sm text-white px-2 py-2 w-full placeholder-white/30"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="text-sm font-bold text-white bg-red-600 px-4 rounded-full active:scale-95 transition disabled:opacity-50"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "搜索"
                  )}
                </button>
              </div>

              <div className="space-y-2">
                {searchResult.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10"
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      <img
                        src={song.cover}
                        className="w-10 h-10 rounded-md bg-white/10 shrink-0 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-sm text-white truncate">
                          {song.title}
                        </div>
                        <div className="text-xs text-white/40 truncate flex gap-2 items-center">
                          <span>{song.artist}</span>
                          {/* 来源标签 */}
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${
                              song.provider === "netease"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-green-500/20 text-green-400"
                            }`}
                          >
                            {song.source}
                          </span>
                          {song.isVip && (
                            <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1 rounded">
                              VIP
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddSearchResult(song)}
                      disabled={resolvingId === song.id}
                      className="p-2 bg-white/10 rounded-full hover:bg-white/20 shrink-0 ml-2"
                    >
                      {resolvingId === song.id ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 fill-white" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import Tab (保持原样) */}
          {activeTab === "import" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-red-900/60 to-black p-5 rounded-2xl border border-red-500/30">
                <h3 className="text-sm font-bold text-red-100 mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> 网易云账号同步
                </h3>
                {isLoggedIn ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-xs text-green-400">
                      <span>● 已登录</span>
                      <button
                        onClick={handleLogout}
                        className="text-white/40 hover:text-white underline"
                      >
                        退出
                      </button>
                    </div>
                    <button
                      onClick={() => syncPlaylist()}
                      className="w-full text-xs bg-red-600 px-4 py-2 rounded-full font-bold shadow-lg flex items-center justify-center gap-2"
                    >
                      <QrCode className="w-3 h-3" /> 同步红心歌单
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startLogin}
                    className="w-full py-3 bg-white text-red-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" /> 扫码登录
                  </button>
                )}
              </div>
              {/* ...Upload and Link Import... */}
              <div className="bg-white/5 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> 本地上传
                </h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-white/20 rounded-xl py-4 text-white/40 hover:text-white transition text-sm"
                >
                  点击选择 MP3
                </button>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> 链接导入
                </h3>
                <div className="flex gap-2">
                  <input
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="粘贴链接..."
                    className="flex-1 bg-black/20 rounded-lg px-3 text-xs outline-none text-white border border-white/10"
                  />
                  <button
                    onClick={handleUrlImport}
                    className="bg-white/10 px-4 rounded-lg text-xs hover:bg-white/20"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showLoginModal && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-white text-black p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl">
            <h3 className="text-lg font-bold mb-6">扫码登录网易云</h3>
            <div className="relative w-48 h-48 mx-auto mb-6 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
              {qrInfo ? (
                <img src={qrInfo.img} className="w-full h-full" />
              ) : (
                <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-black rounded-full"></div>
              )}
            </div>
            <p className="text-sm font-medium text-red-600 mb-8">
              {loginStatus}
            </p>
            <button
              onClick={stopLogin}
              className="text-gray-400 text-sm hover:text-black font-medium"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
        .animate-float-slow {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-slower {
          animation: float 8s ease-in-out infinite reverse;
        }
        .animate-music-bar {
          animation: bar 1s ease-in-out infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes float {
          0% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
          100% {
            transform: translateY(0px);
          }
        }
        @keyframes bar {
          0%,
          100% {
            height: 20%;
          }
          50% {
            height: 100%;
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

const TabButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
      active
        ? "bg-white text-black shadow-lg"
        : "text-white/50 hover:text-white"
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
);

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};
