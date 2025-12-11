// src/app/appearance/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// ✅ 修复点 1: 路径改为 ../../lib/MyTheme (因为我们在 src/app/appearance 下)
// ✅ 修复点 2: 引入的是 useMyTheme (钩子) 而不是 Provider
import { useMyTheme } from "../../lib/MyTheme";

// 简单的开关组件
const Switch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-12 h-7 rounded-full transition-colors relative ${
      checked ? "bg-green-500" : "bg-gray-200"
    }`}
  >
    <div
      className={`w-6 h-6 bg-white rounded-full shadow-md absolute top-0.5 transition-transform ${
        checked ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

// 应用图标列表（模拟数据）
const appIcons = [
  { name: "QQ", color: "bg-blue-500" },
  { name: "Discord", color: "bg-indigo-500" },
  { name: "相册", color: "bg-gradient-to-tr from-yellow-400 to-pink-500" },
  { name: "设置", color: "bg-gray-500" },
  { name: "备忘录", color: "bg-yellow-200" },
  { name: "小红书", color: "bg-red-500" },
  { name: "Suki", color: "bg-white border" },
  { name: "Steam", color: "bg-blue-900" },
];

export default function AppearancePage() {
  const { settings, updateSetting } = useMyTheme();

  // 处理图片上传/输入URL的辅助函数
  const handleImageUpload = (key: "homeWallpaper" | "chatWallpaper") => {
    const currentVal = settings[key] || "";
    const url = prompt("请输入图片 URL:", currentVal);
    if (url !== null) {
      // 只有用户没点取消时才更新
      updateSetting(key, url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 pb-10">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b px-4 h-14 flex items-center justify-between">
        <Link href="/" className="p-2 -ml-2 text-blue-500 flex items-center">
          <ChevronLeft size={24} />
          <span>返回</span>
        </Link>
        <h1 className="font-bold text-lg">外观设置</h1>
        <button className="px-4 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium active:scale-95 transition">
          保存
        </button>
      </header>

      <main className="p-4 space-y-6 max-w-md mx-auto">
        {/* 1. 壁纸设置 */}
        <section className="bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 flex items-center justify-between border-b last:border-0">
            <div>主屏幕壁纸</div>
            <div className="flex gap-2">
              <div
                className="w-8 h-12 bg-gray-200 rounded border bg-cover bg-center"
                style={{ backgroundImage: `url(${settings.homeWallpaper})` }}
              />
              <button
                onClick={() => handleImageUpload("homeWallpaper")}
                className="bg-gray-100 px-3 py-1 rounded text-sm"
              >
                URL
              </button>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>聊天背景 (全局)</div>
            <div className="flex gap-2">
              <div
                className="w-8 h-12 bg-gray-200 rounded border bg-cover bg-center"
                style={{
                  backgroundImage: settings.chatWallpaper
                    ? `url(${settings.chatWallpaper})`
                    : "none",
                }}
              />
              <button
                onClick={() => handleImageUpload("chatWallpaper")}
                className="bg-gray-100 px-3 py-1 rounded text-sm"
              >
                URL
              </button>
              <button
                onClick={() => updateSetting("chatWallpaper", "")}
                className="bg-gray-100 px-3 py-1 rounded text-sm text-red-500"
              >
                ×
              </button>
            </div>
          </div>
        </section>

        {/* 2. 显示与交互 */}
        <div className="text-xs text-gray-500 px-2">显示与交互</div>
        <section className="bg-white rounded-xl overflow-hidden shadow-sm divide-y">
          <div className="p-4 flex items-center justify-between">
            <div>夜间模式</div>
            <Switch
              checked={settings.nightMode}
              onChange={(v) => updateSetting("nightMode", v)}
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>顶部状态栏</div>
            <Switch
              checked={settings.showStatusBar}
              onChange={(v) => updateSetting("showStatusBar", v)}
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div>手机外框</div>
              <div className="text-xs text-gray-400">沉浸式仿真边框</div>
            </div>
            <Switch
              checked={settings.immersiveFrame}
              onChange={(v) => updateSetting("immersiveFrame", v)}
            />
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <div>音乐灵动岛</div>
              <div className="text-xs text-gray-400">
                听歌时始终显示灵动岛UI
              </div>
            </div>
            <Switch
              checked={settings.dynamicIsland}
              onChange={(v) => updateSetting("dynamicIsland", v)}
            />
          </div>
        </section>

        {/* 3. 声音设置 */}
        <div className="text-xs text-gray-500 px-2">声音</div>
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <div className="mb-2">消息提示音 URL</div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-100 rounded px-3 py-2 text-sm outline-none"
              placeholder="https://..."
              value={settings.messageSoundUrl}
              onChange={(e) => updateSetting("messageSoundUrl", e.target.value)}
            />
            <button className="bg-gray-100 px-3 rounded">▶</button>
          </div>
        </section>

        {/* 4. 图标定制 (EPhone 主屏幕图标) */}
        <div className="text-xs text-gray-500 px-2">EPhone 主屏幕图标</div>
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-4">
            {appIcons.map((app) => (
              <div key={app.name} className="flex flex-col items-center gap-2">
                <div
                  className={`w-12 h-12 rounded-xl shadow-sm ${app.color} flex items-center justify-center text-white text-xs overflow-hidden`}
                >
                  {app.name.substring(0, 2)}
                </div>
                <button className="px-2 py-0.5 bg-gray-100 text-xs rounded text-gray-600">
                  更换
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 全局 CSS */}
        <div className="text-xs text-gray-500 px-2">高级</div>
        <section className="bg-white rounded-xl p-4 shadow-sm">
          <div className="mb-2">全局自定义 CSS</div>
          <textarea
            className="w-full h-24 bg-gray-50 rounded-lg p-2 text-xs font-mono border"
            placeholder="/* 在此输入CSS */"
            value={settings.customCss}
            onChange={(e) => updateSetting("customCss", e.target.value)}
          />
        </section>

        <section className="space-y-3">
          <button className="w-full bg-white py-3 rounded-xl text-blue-500 font-medium shadow-sm">
            导出外观配置 (JSON)
          </button>
          <button className="w-full bg-white py-3 rounded-xl text-blue-500 font-medium shadow-sm">
            导入外观配置
          </button>
        </section>
      </main>
    </div>
  );
}
