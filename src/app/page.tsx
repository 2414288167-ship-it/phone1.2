"use client";

import { useUnread } from "@/context/UnreadContext";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import {
  Settings,
  CloudSun,
  Image as ImageIcon,
  Camera,
  BatteryCharging,
  Search,
  MessageCircle,
  Users,
  ShoppingBag,
  Music,
} from "lucide-react";
import { useMyTheme } from "../lib/MyTheme";

// 默认头像
const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e2e8f0'%3E%3Crect width='24' height='24' fill='white'/%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' fill='%23cbd5e1'/%3E%3C/svg%3E";

const GlassCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white/20 backdrop-blur-md border border-white/30 shadow-lg rounded-3xl ${className}`}
  >
    {children}
  </div>
);

const ClockWidget = () => {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!time) return <div className="h-20"></div>;

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatDate = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const weekMap = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."];
    return `${month}月${day}日 ${weekMap[date.getDay()]}`;
  };

  return (
    <div className="flex flex-col items-end text-white drop-shadow-md">
      <div className="text-6xl font-light tracking-wider leading-none mb-1 font-[sans-serif]">
        {formatTime(time)}
      </div>
      <div className="flex items-center gap-2 text-sm opacity-90 mb-2">
        <Music className="w-3 h-3" />
        <span>Love with you !!! ♪</span>
      </div>
      <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
        <span className="text-sm font-medium">{formatDate(time)}</span>
        <span className="text-sm">🍑</span>
      </div>
    </div>
  );
};

const ToDoWidget = () => {
  // 定义任务接口（要与 focus 页面一致）
  interface Task {
    id: string;
    text: string;
    done: boolean;
    type: string;
  }

  const [items, setItems] = useState<Task[]>([]);

  // 加载任务数据的函数
  const loadTasks = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("my_focus_tasks");
      if (saved) {
        setItems(JSON.parse(saved));
      } else {
        // 如果没有数据，显示默认数据
        setItems([
          {
            id: "1",
            text: "去 /focus 添加任务吧 🩵",
            done: false,
            type: "nu-i",
          },
          { id: "2", text: "保持好心情 ✨", done: false, type: "u-ni" },
        ]);
      }
    }
  };

  // 处理任务完成/取消完成
  const toggleDone = (id: string) => {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, done: !item.done } : item
    );
    setItems(newItems);
    // 同步回 localStorage
    localStorage.setItem("my_focus_tasks", JSON.stringify(newItems));
  };

  useEffect(() => {
    loadTasks();

    // 监听 storage 事件（跨标签页同步）
    window.addEventListener("storage", loadTasks);
    // 监听自定义事件（同页面/路由切换同步）
    window.addEventListener("local-storage-update", loadTasks);

    return () => {
      window.removeEventListener("storage", loadTasks);
      window.removeEventListener("local-storage-update", loadTasks);
    };
  }, []);

  return (
    <GlassCard className="h-full p-4 flex flex-col relative overflow-hidden min-h-[220px]">
      <div className="absolute -bottom-4 -left-4 text-6xl font-serif text-blue-800/10 rotate-[-15deg] pointer-events-none">
        Blue
        <br />
        Sky
      </div>
      <Link
        href="/focus"
        className="text-center text-gray-800 font-medium mb-3 border-b-2 border-dashed border-gray-400/30 pb-2 mx-4 block hover:text-blue-600 transition"
      >
        To Do List
      </Link>
      <div className="flex-1 flex flex-col gap-3 z-10 overflow-y-auto max-h-[140px] pr-1 no-scrollbar">
        {items.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            暂无任务，点击标题添加
          </div>
        ) : (
          items.slice(0, 5).map((item, i) => (
            <div
              key={item.id || i}
              className="flex items-center justify-between text-sm text-gray-700 font-medium group cursor-pointer"
              onClick={() => toggleDone(item.id)}
            >
              <div
                className={`flex items-center gap-2 transition ${
                  item.done ? "opacity-50 line-through" : ""
                }`}
              >
                <span className="text-blue-400 drop-shadow-sm text-[10px]">
                  ●
                </span>
                <span className="truncate max-w-[120px]">{item.text}</span>
              </div>
              <div
                className={`w-4 h-4 border-2 rounded flex items-center justify-center transition ${
                  item.done
                    ? "bg-blue-400 border-blue-400"
                    : "border-gray-400/50"
                }`}
              >
                {item.done && (
                  <span className="text-white text-xs font-bold">✓</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="mt-2 relative h-12 w-full opacity-90 shrink-0">
        <div className="absolute inset-0 bg-blue-200/40 rotate-2 transform rounded flex items-center justify-center text-blue-800 font-bold text-sm">
          {items.filter((i) => i.done).length}/{items.length} 完成
        </div>
      </div>
    </GlassCard>
  );
};

const QuoteWidget = () => {
  return (
    <div className="bg-[#E0F2FE]/90 backdrop-blur-md rounded-3xl p-4 shadow-lg relative overflow-hidden h-32 flex flex-col items-center justify-center text-center">
      <div className="absolute top-2 left-4 text-blue-400 font-bold text-xs">
        Lucky day
      </div>
      <div className="absolute top-2 right-2 text-xl">☁️</div>
      <div className="bg-white/80 p-2 rounded-xl shadow-sm rotate-1 mt-3 w-full">
        <div className="text-[10px] text-blue-400 mb-0.5">小狗说：</div>
        <div className="text-blue-500 font-bold text-base tracking-widest">
          “ 烦恼都走开！”
        </div>
      </div>
    </div>
  );
};

const WeatherBatteryWidget = () => {
  return (
    <GlassCard className="p-3 flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <CloudSun className="w-8 h-8 text-gray-700" />
        <div className="text-right text-gray-800">
          <div className="text-lg font-bold">36°C / 25°C</div>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white/40 p-1 rounded-full px-3 w-fit">
        <BatteryCharging className="w-4 h-4 text-gray-800" />
        <span className="text-xs font-bold text-gray-700">能量 78%</span>
      </div>
      <div className="h-8 w-full rounded-lg bg-blue-100/50 overflow-hidden relative mt-1">
        <img
          src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=200&q=80"
          className="w-full h-full object-cover opacity-80"
          alt="drink"
        />
      </div>
    </GlassCard>
  );
};

const AppIcon = ({ icon: Icon, color, name, href = "#" }: any) => (
  <Link href={href} className="flex flex-col items-center gap-1 group">
    <div
      className={`w-[3.5rem] h-[3.5rem] rounded-2xl flex items-center justify-center text-white shadow-md transition-transform group-active:scale-95 relative ${color}`}
    >
      <Icon className="w-7 h-7" />
    </div>
    {name && (
      <span className="text-xs text-white font-medium drop-shadow-md">
        {name}
      </span>
    )}
  </Link>
);

export default function HomePage() {
  const { totalUnread } = useUnread();
  const { settings } = useMyTheme();
  const [avatar, setAvatar] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const profileStr = localStorage.getItem("user_profile_v4");
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          if (profile.avatar) setAvatar(profile.avatar);
        }
      } catch (e) {}
    }
  }, []);

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed text-gray-800 overflow-hidden relative selection:bg-blue-200"
      style={{
        backgroundImage: settings.homeWallpaper
          ? `url(${settings.homeWallpaper})`
          : `url('https://images.unsplash.com/photo-1595123550441-d377e017de6a?q=80&w=1000&auto=format&fit=crop')`,
        filter: settings.nightMode ? "brightness(0.7)" : "none",
      }}
    >
      <div className="absolute inset-0 bg-blue-100/10 backdrop-blur-[2px]" />

      <div className="relative z-10 h-full flex flex-col px-6 pt-10 pb-28 max-w-md mx-auto min-h-screen">
        {/* 顶部区域 */}
        <div className="flex justify-between items-start mb-6">
          <Link
            href="/settings"
            className="absolute top-4 left-4 p-2 bg-white/20 rounded-full backdrop-blur-md text-white z-50"
          >
            <Settings className="w-5 h-5" />
          </Link>

          <Link href="/me" className="relative mt-8 group cursor-pointer">
            <div className="w-24 h-24 rounded-full border-[3px] border-white/40 shadow-xl overflow-hidden relative z-10 bg-gray-100">
              <img
                src={avatar || DEFAULT_AVATAR}
                className="w-full h-full object-cover group-active:scale-95 transition-transform"
                alt="avatar"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
            </div>
            <div className="absolute -top-2 -left-2 w-28 h-28 rounded-full border border-white/20 z-0 animate-spin-slow" />
          </Link>

          <ClockWidget />
        </div>

        {/* 中间 Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4 flex-1">
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <ToDoWidget />
            </div>
            <div className="grid grid-cols-2 gap-4 justify-items-center mt-2">
              {/* --- 预设 APP (图片版) --- */}
              <Link
                href="/preset"
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-[3.5rem] h-[3.5rem] rounded-2xl flex items-center justify-center shadow-md transition-transform group-active:scale-95 relative overflow-hidden p-1">
                  {/* 👇👇👇 在这里修改预设图标路径 👇👇👇 */}
                  <img
                    src="\icons\博学猫.png"
                    className="w-full h-full object-contain"
                    alt="预设"
                  />
                </div>
                <span className="text-xs text-white font-medium drop-shadow-md">
                  预设
                </span>
              </Link>

              {/* --- 音乐 APP (图片版) --- */}
              <Link
                href="/music"
                className="flex flex-col items-center gap-1 group relative"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md transition-transform group-active:scale-95 overflow-hidden">
                    <img
                      src="\icons\网易云音乐.png"
                      className="w-full h-full object-cover scale-110"
                      alt="音乐"
                    />
                  </div>
                </div>
                <span className="text-xs text-white font-medium drop-shadow-md">
                  音乐
                </span>
              </Link>

              <Link
                href="/focus"
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-[3.5rem] h-[3.5rem] rounded-2xl flex items-center justify-center shadow-md transition-transform group-active:scale-95 relative overflow-hidden p-1">
                  <img
                    src="\icons\波斯猫.png"
                    className="w-full h-full object-contain"
                    alt="专注闹钟"
                  />
                </div>
                <span className="text-xs text-white font-medium drop-shadow-md">
                  专注闹钟
                </span>
              </Link>
              <AppIcon
                icon={Camera}
                name="相机"
                color="bg-gray-200 text-gray-700"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <QuoteWidget />
            <div className="flex justify-around px-1 py-2">
              {/* 微信 */}
              <Link
                href="/chat"
                className="flex flex-col items-center gap-1 group relative"
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md transition-transform group-active:scale-95 overflow-hidden">
                    <svg
                      viewBox="0 0 1024 1024"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-full h-full scale-125"
                    >
                      <path
                        d="M503.552 406.95808c16.89088 0 27.648-10.84928 27.648-27.13088 0-17.05472-10.75712-27.13088-27.648-27.13088-16.128 0-31.488 10.07616-31.488 27.13088 0 16.28672 15.36 27.13088 31.488 27.13088zM351.48288 352.69632c-16.12288 0-33.024 10.07616-33.024 27.13088 0 16.2816 16.896 27.136 33.024 27.136 15.36 0 27.648-10.8544 27.648-27.136 0.00512-17.05472-12.28288-27.13088-27.648-27.13088zM574.20288 511.616c-10.752 0-21.504 10.07104-21.504 22.48192 0 10.07104 10.752 20.1472 21.504 20.1472 16.128 0 27.648-10.07616 27.648-20.1472 0.00512-12.40576-11.51488-22.48192-27.648-22.48192zM694.77888 511.616c-11.51488 0-21.504 10.07104-21.504 22.48192 0 10.07104 9.984 20.1472 21.504 20.1472 15.36 0 26.88512-10.07616 26.88512-20.1472 0-12.40576-11.52512-22.48192-26.88512-22.48192z"
                        fill="#2AAE67"
                      />
                      <path
                        d="M849.92 51.2H174.08c-67.8656 0-122.88 55.0144-122.88 122.88v675.84c0 67.8656 55.0144 122.88 122.88 122.88h675.84c67.8656 0 122.88-55.0144 122.88-122.88V174.08c0-67.8656-55.0144-122.88-122.88-122.88zM422.912 632.54016c-28.416 0-49.15712-4.64896-76.03712-12.40576l-77.568 39.54176 22.27712-66.66752C237.06112 554.25536 204.8 505.41056 204.8 445.7216c0-105.42592 98.304-186.04032 218.112-186.04032 105.984 0 200.45312 63.5648 218.88 153.49248-7.68-1.55648-14.592-2.3296-20.736-2.3296-104.44288 0-185.08288 79.06816-185.08288 174.4128 0 16.27648 2.304 31.00672 6.144 46.5152-6.144 0.768-13.06112 0.768-19.20512 0.768z m320.25088 75.96544l15.36 55.81312-58.368-33.3312c-22.26688 4.64896-43.776 11.62752-66.04288 11.62752-102.912 0-184.32-71.31648-184.32-159.68256s81.408-159.68768 184.32-159.68768c97.536 0 185.088 71.31648 185.088 159.68768 0 49.60768-33.024 93.78816-76.03712 125.57312z"
                        fill="#2AAE67"
                      />
                    </svg>
                  </div>
                  {totalUnread > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-bold px-1.5 rounded-full flex items-center justify-center border-2 border-[#f5f5f5] shadow-sm z-20">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </div>
                  )}
                </div>
                <span className="text-xs text-white font-medium drop-shadow-md">
                  微信
                </span>
              </Link>

              {/* 世界书 */}
              <Link
                href="/notes"
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-[3.5rem] h-[3.5rem] rounded-2xl flex items-center justify-center shadow-md transition-transform group-active:scale-95 relative overflow-hidden p-1">
                  {/* 👇👇👇 在这里修改世界书图标路径 👇👇👇 */}
                  <img
                    src="\icons\橘猫.png"
                    className="w-full h-full object-contain"
                    alt="世界书"
                  />
                </div>
                <span className="text-xs text-white font-medium drop-shadow-md">
                  世界书
                </span>
              </Link>
            </div>
            <WeatherBatteryWidget />
          </div>
        </div>

        <div className="absolute bottom-6 left-6 right-6 z-50">
          <GlassCard className="flex justify-around items-center py-3 px-2 rounded-[2rem] bg-white/30 border-white/40 shadow-xl">
            <AppIcon icon={Search} color="bg-blue-400" href="/discover" />
            <Link href="/chat" className="relative group">
              <div className="w-[3.5rem] h-[3.5rem] rounded-2xl bg-blue-500 flex items-center justify-center text-white shadow-md transition-transform group-active:scale-95">
                <MessageCircle className="w-7 h-7" />
              </div>
              {totalUnread > 0 && (
                <div className="absolute -top-1.5 -right-1.5 min-w-[1.2rem] h-[1.2rem] bg-red-500 text-white text-[10px] font-bold px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm z-20">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </div>
              )}
            </Link>
            <AppIcon icon={Users} color="bg-blue-300" href="/contacts" />
            <AppIcon icon={ShoppingBag} color="bg-orange-300" href="/me" />
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
