// --- START OF FILE app/chat/[id]/info/page.tsx ---

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  ChevronRight,
  Check,
  Trash2,
  Upload,
  Volume2,
  Search,
  Image as ImageIcon,
} from "lucide-react";
import { useUnread } from "@/context/UnreadContext";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChatInfoPage({ params }: PageProps) {
  const router = useRouter();

  // --- Context: 铃声相关功能 ---
  const {
    ringtones,
    currentRingtoneId,
    selectRingtone,
    addRingtone,
    deleteRingtone,
    playCurrentRingtone,
  } = useUnread();

  // --- 基础状态 ---
  const [id, setId] = useState<string>("");
  const [contact, setContact] = useState<any>(null);

  // --- 开关状态 ---
  const [dndEnabled, setDndEnabled] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(true);

  // --- 背景图状态 ---
  const [hasBg, setHasBg] = useState(false);

  // --- 弹窗状态 ---
  const [showRingtoneModal, setShowRingtoneModal] = useState(false);

  // --- 搜索状态 ---
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // --- Refs (用于唤起文件选择) ---
  const bgInputRef = useRef<HTMLInputElement>(null);
  const ringtoneInputRef = useRef<HTMLInputElement>(null);

  // 1. 初始化加载数据
  useEffect(() => {
    (async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);

      if (typeof window !== "undefined") {
        // 加载联系人信息
        const contactsStr = localStorage.getItem("contacts");
        if (contactsStr) {
          const contacts = JSON.parse(contactsStr);
          const current = contacts.find(
            (c: any) => String(c.id) === String(resolvedParams.id)
          );
          if (current) {
            setContact(current);
            setDndEnabled(current.dndEnabled || false);
            setIsPinned(current.isPinned || false);
            setAlertEnabled(current.alertEnabled !== false); // 默认为 true
          }
        }
        // 检查是否有背景图
        if (localStorage.getItem(`chat_bg_${resolvedParams.id}`)) {
          setHasBg(true);
        }
      }
    })();
  }, [params]);

  // 2. 更新联系人设置到 LocalStorage
  const updateContact = (key: string, value: any) => {
    const contactsStr = localStorage.getItem("contacts");
    if (!contactsStr) return;
    const contacts = JSON.parse(contactsStr);
    const updated = contacts.map((c: any) =>
      String(c.id) === String(id) ? { ...c, [key]: value } : c
    );
    localStorage.setItem("contacts", JSON.stringify(updated));
  };

  // --- 功能实现：背景图 ---
  const handleSetBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        localStorage.setItem(`chat_bg_${id}`, ev.target?.result as string);
        setHasBg(true);
        alert("聊天背景设置成功！");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRestoreBackground = () => {
    localStorage.removeItem(`chat_bg_${id}`);
    setHasBg(false);
    alert("已恢复默认背景");
  };

  // --- 功能实现：铃声上传 ---
  const handleUploadRingtone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("铃声文件太大，请上传小于 2MB 的音频");
      return;
    }

    const name = file.name.split(".")[0].substring(0, 15);
    addRingtone(name, file).then(() => {
      alert("铃声添加成功！");
    });
  };

  // --- 功能实现：搜索 ---
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const msgsStr = localStorage.getItem(`chat_${id}`);
    if (msgsStr) {
      const msgs = JSON.parse(msgsStr);
      const results = msgs.filter(
        (m: any) =>
          m.content &&
          typeof m.content === "string" &&
          m.content.includes(query)
      );
      setSearchResults(results);
    }
  };

  // --- 功能实现：清空记录 ---
  const handleClearHistory = () => {
    if (confirm("确定要清空与该联系人的所有聊天记录吗？此操作无法撤销。")) {
      localStorage.removeItem(`chat_${id}`);
      alert("聊天记录已清空");
      // 可选：清空后刷新页面或通知
    }
  };

  // --- 辅助组件：菜单项 ---
  const MenuItem = ({
    label,
    type = "arrow",
    value = false,
    onClick,
    subText = "",
    className = "",
  }: any) => (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3.5 bg-white active:bg-gray-50 border-b border-gray-100 last:border-none cursor-pointer ${className}`}
    >
      <span className="text-base text-gray-900">{label}</span>
      <div className="flex items-center gap-2">
        {subText && <span className="text-sm text-gray-400">{subText}</span>}
        {type === "arrow" && <ChevronRight className="w-5 h-5 text-gray-300" />}
        {type === "toggle" && (
          <div
            className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-200 ${
              value ? "bg-[#07c160]" : "bg-gray-300"
            }`}
          >
            <div
              className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
                value ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );

  if (!contact) return <div className="bg-[#f5f5f5] min-h-screen" />;

  // 🔥 渲染：搜索界面
  if (isSearching) {
    return (
      <div className="flex flex-col h-screen bg-[#f5f5f5] text-gray-900">
        <div className="h-14 flex items-center px-2 bg-white border-b border-gray-200 sticky top-0 z-10 gap-2">
          <button
            onClick={() => setIsSearching(false)}
            className="p-2 text-gray-900"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 bg-gray-100 rounded-md flex items-center px-3 py-1.5">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              autoFocus
              className="bg-transparent border-none outline-none text-sm w-full"
              placeholder="搜索聊天记录..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {searchQuery && searchResults.length === 0 && (
            <div className="text-center text-gray-400 mt-10">无搜索结果</div>
          )}
          {searchResults.map((msg: any) => (
            <div
              key={msg.id}
              className="bg-white p-3 rounded-lg mb-3 shadow-sm"
            >
              <div className="text-xs text-gray-400 mb-1 flex justify-between">
                <span>{msg.role === "user" ? "我" : contact.name}</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="text-sm text-gray-800 break-words">
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 🔥 渲染：主信息界面
  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f5] text-gray-900 relative">
      {/* 隐藏的文件输入框 */}
      <input
        type="file"
        ref={bgInputRef}
        hidden
        accept="image/*"
        onChange={handleSetBackground}
      />

      {/* 铃声选择弹窗 */}
      {showRingtoneModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-in fade-in">
          <div className="bg-white w-full sm:w-96 max-h-[80vh] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">选择提示音</h3>
              <button
                onClick={() => setShowRingtoneModal(false)}
                className="text-gray-500 hover:text-gray-800"
              >
                关闭
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <input
                type="file"
                ref={ringtoneInputRef}
                hidden
                accept="audio/*"
                onChange={handleUploadRingtone}
              />

              <div
                onClick={() => ringtoneInputRef.current?.click()}
                className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-gray-200 hover:bg-gray-50 cursor-pointer mb-2 text-gray-500 justify-center"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">导入新铃声 (mp3/wav/ogg)</span>
              </div>

              {ringtones.map((ring) => (
                <div
                  key={ring.id}
                  onClick={() => {
                    selectRingtone(ring.id);
                    playCurrentRingtone();
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer mb-1 ${
                    currentRingtoneId === ring.id
                      ? "bg-green-50 text-[#07c160]"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {currentRingtoneId === ring.id && (
                      <Volume2 className="w-4 h-4 animate-pulse" />
                    )}
                    <span className="text-sm font-medium">{ring.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentRingtoneId === ring.id && (
                      <Check className="w-5 h-5" />
                    )}
                    {ring.id !== "default" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("删除此铃声？")) deleteRingtone(ring.id);
                        }}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded-full hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <header className="h-14 flex items-center px-2 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 text-gray-900">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium ml-1">聊天信息 ({contact.name})</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 头像 */}
        <div className="bg-white p-4 mb-2 flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
              {/* 兼容 base64 和 http 链接 */}
              <img
                src={contact.avatar}
                className="w-full h-full object-cover"
                alt="avatar"
              />
            </div>
            <span className="text-xs text-gray-500 truncate w-14 text-center">
              {contact.name}
            </span>
          </div>
          <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
            <Plus className="w-6 h-6" />
          </div>
        </div>

        {/* 菜单组 1: 搜索 */}
        <div className="mb-2">
          <MenuItem label="查找聊天记录" onClick={() => setIsSearching(true)} />
          {/* ✅ 新增：记忆管理入口 */}
          <MenuItem
            label="记忆总结"
            onClick={() => router.push(`/chat/${id}/info/memory`)}
          />
        </div>

        {/* 菜单组 2: 开关 */}
        <div className="mb-2">
          <MenuItem
            label="消息免打扰"
            type="toggle"
            value={dndEnabled}
            onClick={() => {
              setDndEnabled(!dndEnabled);
              updateContact("dndEnabled", !dndEnabled);
            }}
          />
          <MenuItem
            label="置顶聊天"
            type="toggle"
            value={isPinned}
            onClick={() => {
              setIsPinned(!isPinned);
              updateContact("isPinned", !isPinned);
            }}
          />
          <MenuItem
            label="提醒"
            subText="开启后播放提示音"
            type="toggle"
            value={alertEnabled}
            onClick={() => {
              setAlertEnabled(!alertEnabled);
              updateContact("alertEnabled", !alertEnabled);
            }}
          />
          {/* 铃声入口：只有开启提醒才显示 */}
          {alertEnabled && (
            <MenuItem
              label="消息提示音"
              subText={
                ringtones.find((r) => r.id === currentRingtoneId)?.name ||
                "默认"
              }
              onClick={() => setShowRingtoneModal(true)}
            />
          )}
        </div>

        {/* 菜单组 3: 背景 */}
        <div className="mb-2">
          <MenuItem
            label="设置当前聊天背景"
            subText={hasBg ? "已设置" : ""}
            onClick={() => bgInputRef.current?.click()}
          />
          {hasBg && (
            <MenuItem
              label="恢复默认背景"
              type="none"
              className="text-red-500"
              onClick={handleRestoreBackground}
            />
          )}
        </div>

        {/* 菜单组 4: 更多设置路由跳转 */}
        <div className="mb-8">
          <MenuItem
            label="聊天设置"
            onClick={() => router.push(`/chat/${id}/settings`)}
          />
        </div>

        {/* 菜单组 5: 清空 */}
        <div className="mb-2">
          <MenuItem
            label="清空聊天记录"
            type="none"
            onClick={handleClearHistory}
          />
        </div>
      </div>
    </div>
  );
}
