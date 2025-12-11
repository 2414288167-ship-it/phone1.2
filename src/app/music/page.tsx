"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
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
  CloudDownload,
  QrCode,
  Globe,
  FolderOpen,
  Music,
} from "lucide-react";

// --- 类型定义 ---
interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover: string;
  source?: "local" | "url" | "netease" | "qq" | "gd";
}

const DEFAULT_SONG: Song = {
  id: "0",
  title: "等待播放",
  artist: "选择一首歌曲",
  url: "",
  cover:
    "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80",
};

export default function MusicPage() {
  // --- 状态管理 ---
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // UI 状态
  const [showDrawer, setShowDrawer] = useState(false); // 播放列表/功能菜单
  const [activeTab, setActiveTab] = useState<"playlist" | "search" | "import">(
    "playlist"
  );
  const [bgImage, setBgImage] = useState(DEFAULT_SONG.cover);

  // 搜索相关
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<Song[]>([]);
  const [searchSource, setSearchSource] = useState<"netease" | "qq" | "gd">(
    "netease"
  );
  const [isSearching, setIsSearching] = useState(false);

  // 导入 URL 相关
  const [inputUrl, setInputUrl] = useState("");

  // 登录相关
  const [showLogin, setShowLogin] = useState(false);
  const [qrInfo, setQrInfo] = useState<{ key: string; img: string } | null>(
    null
  );
  const [loginStatus, setLoginStatus] = useState("请使用网易云APP扫码");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginCheckTimer = useRef<NodeJS.Timeout | null>(null);

  const currentSong = playlist[currentIndex] || DEFAULT_SONG;

  // --- 初始化 & AI 状态同步 ---
  useEffect(() => {
    // 检查登录态
    const cookie = localStorage.getItem("netease_cookie");
    if (cookie) setIsLoggedIn(true);

    // 更新背景和 AI 状态
    if (playlist.length > 0) {
      setBgImage(currentSong.cover);
      if (isPlaying) {
        localStorage.setItem(
          "current_music_status",
          `User is listening to: "${currentSong.title}" by ${currentSong.artist}`
        );
      } else {
        localStorage.removeItem("current_music_status");
      }
    }
  }, [currentIndex, isPlaying, playlist, currentSong]);

  // --- 播放器核心逻辑 ---
  const togglePlay = () => {
    if (!audioRef.current?.src) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch((e) => console.error(e));
    setIsPlaying(!isPlaying);
  };

  const changeSong = (index: number) => {
    if (playlist.length === 0) return;
    let nextIndex = index;
    if (nextIndex >= playlist.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = playlist.length - 1;
    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && audioRef.current.duration) {
      setProgress(
        (audioRef.current.currentTime / audioRef.current.duration) * 100
      );
    }
  };

  // --- 功能 1: 本地上传 ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newSongs: Song[] = Array.from(files).map((file) => ({
      id: `local_${Date.now()}_${Math.random()}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "本地音乐",
      url: URL.createObjectURL(file),
      cover:
        "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80",
      source: "local",
    }));
    addToPlaylist(newSongs);
    e.target.value = "";
  };

  // --- 功能 2: URL 导入 ---
  const handleUrlImport = () => {
    if (!inputUrl) return;
    const newSong: Song = {
      id: `url_${Date.now()}`,
      title: "网络歌曲",
      artist: "未知艺术家",
      url: inputUrl,
      cover:
        "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80",
      source: "url",
    };
    addToPlaylist([newSong]);
    setInputUrl("");
    alert("已添加链接，请尝试播放");
  };

  // --- 功能 3: 聚合搜索 (后端代理) ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult([]);

    try {
      if (searchSource === "netease") {
        // 调用我们刚才写的后端 API
        const res = await fetch(
          `/api/music/search?keywords=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        if (data.list) setSearchResult(data.list);
      } else {
        // 模拟其他平台 (QQ/GD 需要极复杂的加密，此处仅做演示逻辑，提示用户)
        alert("QQ/GD 音乐台接口需要高级鉴权，暂仅支持网易云搜索。");
        setIsSearching(false);
        return;
      }
    } catch (e) {
      alert("搜索失败");
    }
    setIsSearching(false);
  };

  // --- 功能 4: 网易云登录 & 获取歌单 ---
  const startLogin = async () => {
    setShowLogin(true);
    const res = await fetch("/api/music/login/qr");
    const data = await res.json();
    setQrInfo({ key: data.key, img: data.qrimg });

    // 轮询检查
    if (loginCheckTimer.current) clearInterval(loginCheckTimer.current);
    loginCheckTimer.current = setInterval(async () => {
      const checkRes = await fetch(`/api/music/login/check?key=${data.key}`);
      const checkData = await checkRes.json();
      if (checkData.code === 800) setLoginStatus("二维码过期");
      if (checkData.code === 802) setLoginStatus("扫码成功，请确认");
      if (checkData.code === 803) {
        setLoginStatus("登录成功！");
        localStorage.setItem("netease_cookie", checkData.cookie);
        setIsLoggedIn(true);
        clearInterval(loginCheckTimer.current!);
        setTimeout(() => {
          setShowLogin(false);
          syncPlaylist(checkData.cookie);
        }, 1000);
      }
    }, 2000);
  };

  const syncPlaylist = async (cookie?: string) => {
    const savedCookie = cookie || localStorage.getItem("netease_cookie");
    if (!savedCookie) return startLogin();

    alert("正在同步红心歌单...");
    try {
      const res = await fetch("/api/music/user/playlist", {
        method: "POST",
        body: JSON.stringify({ cookie: savedCookie }),
      });
      const data = await res.json();
      if (data.songs) {
        // 格式化歌单
        const neteaseSongs: Song[] = data.songs.map((s: any) => ({
          id: String(s.id),
          title: s.name,
          artist: s.ar.map((a: any) => a.name).join("/"),
          url: `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`,
          cover: s.al.picUrl,
          source: "netease",
        }));
        addToPlaylist(neteaseSongs);
        alert(`成功同步 ${neteaseSongs.length} 首歌曲`);
      }
    } catch (e) {
      alert("同步失败，Cookie可能过期");
      setIsLoggedIn(false);
    }
  };

  // --- 辅助：添加到播放列表 ---
  const addToPlaylist = (songs: Song[]) => {
    setPlaylist((prev) => [...prev, ...songs]);
    if (playlist.length === 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
    // 自动切到播放列表视图
    setActiveTab("playlist");
  };

  const handleStopLogin = () => {
    setShowLogin(false);
    if (loginCheckTimer.current) clearInterval(loginCheckTimer.current);
  };

  // --- 渲染 ---
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
      <audio
        ref={audioRef}
        src={currentSong.url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => changeSong(currentIndex + 1)}
        autoPlay={isPlaying}
      />

      {/* 动态模糊背景 */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out opacity-50 blur-3xl scale-125 z-0"
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      <div className="absolute inset-0 bg-black/40 z-0" />

      {/* 顶部导航 */}
      <header className="relative z-10 flex items-center justify-between px-4 h-16 shrink-0">
        <Link
          href="/"
          className="p-2 hover:bg-white/10 rounded-full transition text-white/80"
        >
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <div className="flex flex-col items-center">
          <span className="text-base font-medium">音乐播放器</span>
          <span className="text-[10px] text-white/50">
            {playlist.length > 0 ? "正在播放" : "无音乐"}
          </span>
        </div>
        <button
          onClick={() => setShowDrawer(true)}
          className="p-2 hover:bg-white/10 rounded-full transition text-white/80"
        >
          <ListMusic className="w-6 h-6" />
        </button>
      </header>

      {/* 唱片展示区 (仿网易云) */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center -mt-10"
        onClick={() => setShowDrawer(false)}
      >
        {/* 唱针 */}
        <div
          className={`absolute top-0 left-1/2 ml-[-15px] w-24 h-36 z-20 origin-top-left transition-transform duration-500 ease-in-out ${
            isPlaying ? "rotate-0" : "-rotate-[25deg]"
          }`}
          style={{ transformOrigin: "15px 15px" }}
        >
          <div className="w-4 h-4 rounded-full bg-gray-200 absolute top-0 left-0 shadow-lg"></div>
          <div className="w-2 h-24 bg-gray-300 absolute top-2 left-1 rotate-[15deg]"></div>
          <div className="w-16 h-8 bg-gray-200 rounded-md absolute bottom-0 left-[-10px] rotate-[15deg]"></div>
        </div>

        {/* 唱片 */}
        <div className="relative w-72 h-72 rounded-full bg-black border-[8px] border-white/5 shadow-2xl flex items-center justify-center">
          <div
            className={`w-full h-full rounded-full overflow-hidden ${
              isPlaying ? "animate-spin-slow" : ""
            }`}
            style={{ animationPlayState: isPlaying ? "running" : "paused" }}
          >
            <img
              src={currentSong.cover}
              className="w-full h-full object-cover opacity-90"
            />
          </div>
          {/* 唱片纹理覆盖 */}
          <div className="absolute inset-0 rounded-full border-[30px] border-black/80 pointer-events-none"></div>
        </div>

        {/* 歌曲信息 */}
        <div className="mt-10 text-center px-8 w-full">
          <h2 className="text-2xl font-bold text-white mb-2 truncate">
            {currentSong.title}
          </h2>
          <p className="text-white/60 text-sm truncate">{currentSong.artist}</p>
        </div>
      </main>

      {/* 底部控制栏 */}
      <footer className="relative z-20 px-6 pb-12 pt-4 w-full">
        {/* 进度条 */}
        <div className="w-full flex items-center gap-3 text-xs text-white/40 font-mono mb-6">
          <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
          <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
            <div
              className="h-full bg-white rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-[-4px] top-[-3px] w-2.5 h-2.5 bg-white rounded-full shadow opacity-100"></div>
            </div>
          </div>
          <span>{formatTime(audioRef.current?.duration || 0)}</span>
        </div>

        {/* 按钮 */}
        <div className="flex items-center justify-between px-4">
          <button className="text-white/70 hover:text-white">
            <Heart className="w-6 h-6" />
          </button>
          <button
            onClick={() => changeSong(currentIndex - 1)}
            className="text-white hover:text-white/80"
          >
            <SkipBack className="w-8 h-8 fill-white/20" />
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
            onClick={() => changeSong(currentIndex + 1)}
            className="text-white hover:text-white/80"
          >
            <SkipForward className="w-8 h-8 fill-white/20" />
          </button>
          <button
            onClick={() => setShowDrawer(true)}
            className="text-white/70 hover:text-white"
          >
            <ListMusic className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* 侧边功能抽屉 */}
      <div
        className={`absolute inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          showDrawer ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowDrawer(false)}
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-50 bg-[#1e1e1e] rounded-t-3xl h-[75vh] flex flex-col transition-transform duration-300 ease-out transform ${
          showDrawer ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* 抽屉导航 */}
        <div className="flex items-center justify-between p-2 border-b border-white/5">
          <div className="flex gap-1 p-2 bg-black/20 rounded-full mx-auto">
            <TabButton
              active={activeTab === "playlist"}
              onClick={() => setActiveTab("playlist")}
              icon={ListMusic}
              label="播放列表"
            />
            <TabButton
              active={activeTab === "search"}
              onClick={() => setActiveTab("search")}
              icon={Search}
              label="聚合搜索"
            />
            <TabButton
              active={activeTab === "import"}
              onClick={() => setActiveTab("import")}
              icon={FolderOpen}
              label="导入/登录"
            />
          </div>
        </div>

        {/* 抽屉内容区 */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* 1. 播放列表 */}
          {activeTab === "playlist" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/40 mb-2 px-2">
                <span>共 {playlist.length} 首歌曲</span>
                <button
                  onClick={() => setPlaylist([])}
                  className="hover:text-red-400"
                >
                  清空列表
                </button>
              </div>
              {playlist.length === 0 ? (
                <div className="text-center text-white/30 mt-20 text-sm">
                  暂无歌曲，快去搜索或导入吧
                </div>
              ) : (
                playlist.map((song, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsPlaying(true);
                    }}
                    className={`flex items-center p-3 rounded-xl gap-3 cursor-pointer ${
                      idx === currentIndex ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-xs w-4 text-center ${
                        idx === currentIndex ? "text-red-500" : "text-white/30"
                      }`}
                    >
                      {idx === currentIndex ? (
                        <Music className="w-3 h-3 animate-pulse" />
                      ) : (
                        idx + 1
                      )}
                    </span>
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
                    <div className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/5">
                      {song.source === "netease"
                        ? "网易"
                        : song.source === "local"
                        ? "本地"
                        : "网络"}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newList = playlist.filter((_, i) => i !== idx);
                        setPlaylist(newList);
                      }}
                      className="p-2 text-white/20 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 2. 聚合搜索 */}
          {activeTab === "search" && (
            <div className="flex flex-col h-full">
              <div className="flex gap-2 mb-4">
                <div className="flex-1 bg-white/10 rounded-full flex items-center px-3">
                  <Search className="w-4 h-4 text-white/40" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="搜索歌曲、歌手..."
                    className="bg-transparent border-none outline-none text-sm text-white px-2 py-2 w-full placeholder-white/30"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  className="text-sm font-bold text-white bg-red-600 px-4 rounded-full active:scale-95 transition"
                >
                  搜索
                </button>
              </div>

              {/* 搜索源选择 */}
              <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                {["netease", "qq", "gd"].map((src) => (
                  <button
                    key={src}
                    onClick={() => setSearchSource(src as any)}
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      searchSource === src
                        ? "bg-white text-black border-white"
                        : "text-white/50 border-white/10"
                    }`}
                  >
                    {src === "netease"
                      ? "网易云"
                      : src === "qq"
                      ? "QQ音乐"
                      : "GD音乐台"}
                  </button>
                ))}
              </div>

              {isSearching ? (
                <div className="text-center text-white/30 mt-10">搜索中...</div>
              ) : (
                <div className="space-y-2">
                  {searchResult.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-xl"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <img
                          src={song.cover}
                          className="w-10 h-10 rounded-md bg-white/10"
                        />
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">
                            {song.title}
                          </div>
                          <div className="text-xs text-white/40 truncate">
                            {song.artist}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          addToPlaylist([song]);
                          alert("已添加到播放列表");
                        }}
                        className="p-2 bg-white/10 rounded-full hover:bg-white/20"
                      >
                        <Play className="w-4 h-4 fill-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. 导入与登录 */}
          {activeTab === "import" && (
            <div className="space-y-6">
              {/* 网易云登录 */}
              <div className="bg-gradient-to-br from-red-900/40 to-black p-4 rounded-2xl border border-red-500/20">
                <h3 className="text-sm font-bold text-red-200 mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> 网易云账号同步
                </h3>
                {isLoggedIn ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-400">已登录</span>
                    <button
                      onClick={() => syncPlaylist()}
                      className="text-xs bg-red-600 px-3 py-1.5 rounded-full"
                    >
                      同步红心歌单
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startLogin}
                    className="w-full py-2 bg-red-600/80 hover:bg-red-600 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" /> 扫码登录
                  </button>
                )}
              </div>

              {/* 本地导入 */}
              <div className="bg-white/5 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
                  <Upload className="w-4 h-4" /> 本地音乐上传
                </h3>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-white/20 rounded-xl py-4 text-white/40 hover:text-white hover:border-white/40 transition text-sm"
                >
                  点击选择 MP3 文件
                </button>
              </div>

              {/* URL 导入 */}
              <div className="bg-white/5 p-4 rounded-2xl">
                <h3 className="text-sm font-bold text-white/80 mb-3 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> 网络链接导入
                </h3>
                <div className="flex gap-2">
                  <input
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="输入音频 URL (mp3/m4a)..."
                    className="flex-1 bg-black/20 rounded-lg px-3 text-xs outline-none text-white border border-white/10 focus:border-white/30"
                  />
                  <button
                    onClick={handleUrlImport}
                    className="bg-white/10 px-3 py-2 rounded-lg text-xs hover:bg-white/20"
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 登录全屏弹窗 */}
      {showLogin && (
        <div className="absolute inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center">
          <div className="bg-white text-black p-6 rounded-3xl w-72 text-center shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold mb-4">网易云扫码</h3>
            {qrInfo ? (
              <img
                src={qrInfo.img}
                className="w-48 h-48 mx-auto mb-4 border-4 border-red-500 rounded-xl"
              />
            ) : (
              <div className="w-48 h-48 mx-auto mb-4 bg-gray-200 animate-pulse rounded-xl"></div>
            )}
            <p className="text-sm font-medium text-red-600 mb-6">
              {loginStatus}
            </p>
            <button
              onClick={handleStopLogin}
              className="text-gray-400 text-sm hover:text-black"
            >
              取消登录
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .animate-spin-slow {
          animation: spin 20s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        /* 隐藏滚动条 */
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}

// 辅助组件
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
