"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  ChevronLeft,
  MoreVertical,
  X,
  User,
  Upload,
} from "lucide-react";
import { useUnread } from "@/context/UnreadContext";

// --- 扩展接口定义 ---
interface Contact {
  id: string;
  name: string;
  subtitle?: string;
  avatar?: string;
  remark?: string;
  aiName?: string;
  myNickname?: string;
  firstMessage?: string;
  aiPersona?: string;
  worldBook?: string;
  group?: string;
  userPersonaId?: string;
}

interface ContactEditData {
  remark: string;
  aiName: string;
  myNickname: string;
  aiAvatar: string;
  myAvatar: string;
}

interface ChatSettings {
  allowNewHeartbeat: boolean;
  independentBackstageActivity: boolean;
  independentActionCooldown: number;
  shortTermMemoryTokens: number;
  longTermMemoryTokens: number;
  autoSummarizeLongMemory: boolean;
  autoSummarizationInterval: number;
  otherMemoryMounting: boolean;
  currentConversationTokens: number;
  estimateContextTokens: number;
  enableRealTimeWeather: boolean;
  enableTTSSynthesis: boolean;
  voiceId: string;
  voiceLanguage: string;
  enableMusicComposition: boolean;
  enablePrivateMode: boolean;
  enableTodoSync: boolean;
}

// ✅ 新增：世界书导入用的接口
interface WorldBookEntry {
  id?: number | string; // ✅ 修复：改为可选属性，避免构建 content 时报错
  keys: string[];
  content: string;
  enabled: boolean;
  comment?: string;
}
interface WorldBookCategory {
  id: number;
  name: string;
  entries?: WorldBookEntry[]; // JSON 结构兼容
}
interface Book {
  id: string;
  name: string;
  content: WorldBookEntry[];
  categoryId: number;
}
interface WorldBookData {
  books: Book[];
  categories: WorldBookCategory[];
}

const sampleContacts: Contact[] = [
  {
    id: "1",
    name: "哼呀鬼",
    subtitle: "[在办公室，刚结束一个案情...]",
    avatar: "🐱",
    remark: "哼呀鬼",
    aiName: "沈墨",
    myNickname: "我",
  },
];

const defaultChatSettings: ChatSettings = {
  allowNewHeartbeat: false,
  independentBackstageActivity: true,
  independentActionCooldown: 10,
  shortTermMemoryTokens: 30,
  longTermMemoryTokens: 10,
  autoSummarizeLongMemory: false,
  autoSummarizationInterval: 20,
  otherMemoryMounting: false,
  currentConversationTokens: 2910,
  estimateContextTokens: 8880,
  enableRealTimeWeather: false,
  enableTTSSynthesis: false,
  voiceId: "minimax voice_id",
  voiceLanguage: "自动识别 (Auto)",
  enableMusicComposition: false,
  enablePrivateMode: false,
  enableTodoSync: false,
};

export const ContactsList: React.FC = () => {
  const router = useRouter();
  const { unreadCounts } = useUnread();

  const [showCreate, setShowCreate] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [createStep, setCreateStep] = useState<"menu" | "manual_input">("menu");
  const [newAiName, setNewAiName] = useState("");
  const [newRemark, setNewRemark] = useState("");

  const [editData, setEditData] = useState<ContactEditData>({
    remark: "",
    aiName: "",
    myNickname: "",
    aiAvatar: "🐱",
    myAvatar: "🤖",
  });
  const [chatSettings, setChatSettings] =
    useState<ChatSettings>(defaultChatSettings);

  const [showAvatarPicker, setShowAvatarPicker] = useState<"ai" | "my" | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("contacts");
      if (saved) {
        try {
          setContacts(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      } else {
        setContacts(sampleContacts);
      }
    }
  }, []);

  useEffect(() => {
    const handleChatUpdate = () => {
      setRefreshKey((prev) => prev + 1);
      const saved = localStorage.getItem("contacts");
      if (saved) setContacts(JSON.parse(saved));
    };
    window.addEventListener("chat_updated", handleChatUpdate);
    return () => window.removeEventListener("chat_updated", handleChatUpdate);
  }, []);

  const handleSettingChange = (key: keyof ChatSettings, value: any) => {
    setChatSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleEditClick = () => {
    if (selectedContact) {
      setEditData({
        remark: selectedContact.remark || selectedContact.name,
        aiName: selectedContact.aiName || "沈墨",
        myNickname: selectedContact.myNickname || "我",
        aiAvatar: selectedContact.avatar || "🐱",
        myAvatar: "🤖",
      });
      setIsEditing(true);
    }
  };

  const getMessagePreview = (contactId: string): string => {
    if (typeof window === "undefined") return "";
    try {
      const messagesStr = localStorage.getItem(`chat_${contactId}`);
      if (messagesStr) {
        const messages = JSON.parse(messagesStr);
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          let content = lastMessage.content;
          if (content.length > 30) content = content.substring(0, 30) + "...";
          return content;
        }
      }
    } catch (e) {
      console.error("Failed to get message preview:", e);
    }
    return "";
  };

  const handleSaveEdit = () => {
    if (selectedContact) {
      const updatedContact: Contact = {
        ...selectedContact,
        remark: editData.remark,
        aiName: editData.aiName,
        myNickname: editData.myNickname,
        avatar: editData.aiAvatar.startsWith("data:")
          ? editData.aiAvatar
          : editData.aiAvatar,
        name: editData.remark,
      };

      setContacts((prevContacts) =>
        prevContacts.map((c) =>
          c.id === selectedContact.id ? updatedContact : c
        )
      );
      setSelectedContact(updatedContact);

      const contactsData = contacts.map((c) =>
        c.id === selectedContact.id ? updatedContact : c
      );
      localStorage.setItem("contacts", JSON.stringify(contactsData));

      setIsEditing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (showAvatarPicker === "ai") {
          setEditData({ ...editData, aiAvatar: base64 });
        } else if (showAvatarPicker === "my") {
          setEditData({ ...editData, myAvatar: base64 });
        }
        setShowAvatarPicker(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("🟢 点击了加号，打开新弹窗");
    setCreateStep("menu");
    setShowCreate(true);
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCreateStep("menu");
    setNewAiName("");
    setNewRemark("");
  };

  const handleConfirmCreate = () => {
    if (!newAiName.trim()) {
      alert("请输入角色名字");
      return;
    }
    const finalRemark = newRemark.trim() || newAiName;

    const newContact: Contact = {
      id: Date.now().toString(),
      name: newAiName,
      remark: finalRemark,
      aiName: newAiName,
      avatar: "🐱",
      subtitle: "新创建的角色",
      myNickname: "我",
      group: "未分组",
      userPersonaId: "default",
    };

    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    localStorage.setItem("contacts", JSON.stringify(updatedContacts));

    closeCreateModal();
    router.push(`/chat/${newContact.id}`);
  };

  // --- 🔥🔥🔥 核心修改：导入角色卡 (.json) 与 自动创建前情概要 🔥🔥🔥 ---
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        const charName = data.name || data.char_name || "未知角色";
        const charPersona = data.description || data.persona || "";
        const firstMes = data.first_mes || data.greeting || "";
        const scenario = data.scenario || "";
        const charAvatar = "🐱";

        // 自动提取并导入世界书
        let importedWorldBookId = "";
        const worldBookData = data.character_book || data.lorebook;

        // 即使角色卡里没有世界书，我们也可能想为它创建一个空的并带上 summary
        if (
          worldBookData &&
          (worldBookData.entries || worldBookData.entries_list)
        ) {
          const existingWBStr = localStorage.getItem("worldbook_data");
          let existingWB: WorldBookData = existingWBStr
            ? JSON.parse(existingWBStr)
            : { categories: [], books: [] };

          if (!existingWB.books) existingWB.books = [];
          if (!existingWB.categories) existingWB.categories = [];

          const newCategoryId = Date.now();
          const entriesRaw =
            worldBookData.entries || worldBookData.entries_list || [];
          const entriesArray = Array.isArray(entriesRaw)
            ? entriesRaw
            : Object.values(entriesRaw);

          // 1. 转换标准条目
          const newBooks: Book[] = entriesArray.map(
            (entry: any, index: number) => {
              const keys = entry.keys || entry.key || [];
              const finalKeys = Array.isArray(keys)
                ? keys
                : typeof keys === "string"
                ? keys.split(",")
                : [];
              return {
                id: `${newCategoryId}_${index}`,
                categoryId: newCategoryId,
                name: finalKeys[0] || `条目 ${index}`,
                content: [
                  {
                    keys: finalKeys,
                    content: entry.content || "",
                    comment: entry.comment || "",
                    enabled: entry.enabled !== false,
                  },
                ],
              };
            }
          );

          // 🔥 2. 自动插入“前情概要”条目 (ID固定，方便 MemoryPage 查找)
          newBooks.unshift({
            id: `${newCategoryId}_summary_auto`, // 👈 关键：特定ID
            categoryId: newCategoryId,
            name: "前情概要 (自动记录)",
            content: [
              {
                keys: ["前情概要", "summary", "story so far"],
                content: "（暂无记录，当对话达到一定数量时会自动生成）",
                comment: "系统自动维护，请勿手动改ID",
                enabled: true,
              },
            ],
          });

          // 3. 保存分类和书籍
          existingWB.categories.push({
            id: newCategoryId,
            name: `${charName}的世界书 (导入)`,
          });
          existingWB.books.push(...newBooks);

          localStorage.setItem("worldbook_data", JSON.stringify(existingWB));

          importedWorldBookId = String(newCategoryId);
          alert(
            `✅ 检测到世界书，已自动导入：${charName}的世界书，并创建了前情概要条目。`
          );
        }

        const newContact: Contact = {
          id: Date.now().toString(),
          name: charName,
          remark: charName,
          aiName: charName,
          avatar: charAvatar,
          subtitle: firstMes.slice(0, 20) + "...",
          firstMessage: firstMes,
          aiPersona: `${charPersona}\n\n[Scenario]: ${scenario}`,
          worldBook: importedWorldBookId || "", // 关联世界书ID
          myNickname: "我",
          group: "未分组",
          userPersonaId: "default",
        };

        const updatedContacts = [...contacts, newContact];
        setContacts(updatedContacts);
        localStorage.setItem("contacts", JSON.stringify(updatedContacts));

        if (firstMes) {
          const initialMsg = [
            {
              id: Date.now().toString(),
              role: "assistant",
              content: firstMes,
              timestamp: new Date(),
              type: "text",
            },
          ];
          localStorage.setItem(
            `chat_${newContact.id}`,
            JSON.stringify(initialMsg)
          );
        }

        closeCreateModal();
        router.push(`/chat/${newContact.id}`);
      } catch (err) {
        console.error(err);
        alert("导入失败：请确保文件是标准的 JSON 角色卡格式。");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset input
  };

  const openFilePicker = (type: "ai" | "my") => {
    setShowAvatarPicker(type);
    fileInputRef.current?.click();
  };

  const aiPresetAvatars = [
    "🐱",
    "🤖",
    "👨‍🎓",
    "👩‍🎨",
    "🧙",
    "🧚",
    "🧜",
    "🦸",
    "🧙‍♀️",
    "👽",
    "🤡",
    "🎭",
    "💀",
    "👻",
    "🎃",
  ];
  const myPresetAvatars = [
    "🤖",
    "👨",
    "👩",
    "👨‍💼",
    "👩‍💼",
    "👨‍🎓",
    "👩‍🎓",
    "🧑",
    "👨‍🎨",
    "👩‍🎨",
    "🧔",
    "👴",
    "👵",
    "🧓",
    "🤷",
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <input
        ref={importFileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportFile}
      />

      <header className="h-14 flex items-center justify-between px-4 border-b bg-white">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 text-blue-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-lg font-medium">消息 ({contacts.length})</h2>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 text-sky-500">
            <Search className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-sky-500"
            onClick={handlePlusClick}
            aria-label="create new"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      {!selectedContact ? (
        <main className="px-4 pt-2 pb-28">
          <ul className="divide-y">
            {contacts.map((c) => {
              const preview = getMessagePreview(c.id);
              const unreadCount = unreadCounts[String(c.id)] || 0;

              return (
                <li
                  key={c.id}
                  className="py-3 flex items-center justify-between"
                >
                  <Link
                    href={`/chat/${c.id}`}
                    className="flex items-center gap-3 flex-1"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-100">
                        {c.avatar && c.avatar.startsWith("data:") ? (
                          <Image
                            src={c.avatar}
                            alt={c.name}
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-2xl">{c.avatar || "🐱"}</div>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 z-50 min-w-[1.2rem] h-[1.2rem] bg-red-500 text-white text-[10px] font-bold px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 ml-1">
                      <div className="flex justify-between items-baseline mb-1">
                        <h3 className="text-base font-medium text-gray-900 truncate">
                          {c.remark || c.name}
                        </h3>
                        <span className="text-xs text-gray-400"></span>
                      </div>
                      <div
                        className={`text-sm truncate ${
                          unreadCount > 0
                            ? "text-gray-800 font-medium"
                            : "text-gray-400"
                        }`}
                      >
                        {preview || c.subtitle || "点击开始聊天"}
                      </div>
                    </div>
                  </Link>
                  <button
                    className="p-2 text-gray-500 hover:text-gray-700"
                    onClick={() => setSelectedContact(c)}
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </main>
      ) : (
        <main className="pb-28 overflow-y-auto">
          {/* Chat Info Panel Header */}
          <header className="sticky top-0 z-50 bg-white border-b flex items-center justify-between px-4 h-14">
            <button
              className="p-2 text-blue-500 flex items-center gap-1"
              onClick={() => {
                setSelectedContact(null);
                setIsEditing(false);
              }}
            >
              <ChevronLeft className="w-5 h-5" />
              <span>返回</span>
            </button>
            <h1 className="text-lg font-bold flex-1 text-center">
              {isEditing ? "编辑信息" : "聊天详情"}
            </h1>
            {isEditing ? (
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium active:scale-95 transition"
              >
                保存
              </button>
            ) : (
              <button
                onClick={handleEditClick}
                className="px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium active:scale-95 transition"
              >
                编辑
              </button>
            )}
          </header>

          <section className="p-4 space-y-4">
            {/* 详情展示逻辑 */}
            {!isEditing && (
              <div className="text-center text-gray-400 text-sm py-4">
                (详情设置已隐藏，点击编辑可修改)
              </div>
            )}
          </section>
        </main>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t h-14 flex items-center justify-around">
        <button className="flex flex-col items-center text-sky-600 text-sm">
          消息
        </button>
        <button className="flex flex-col items-center text-gray-500 text-sm">
          动态
        </button>
        <button className="flex flex-col items-center text-gray-500 text-sm">
          回忆
        </button>
        <button className="flex flex-col items-center text-gray-500 text-sm">
          收藏
        </button>
        <button className="flex flex-col items-center text-gray-500 text-sm">
          NPC
        </button>
      </nav>

      {showCreate && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeCreateModal}
        >
          <div
            className="relative w-[85%] max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {createStep === "menu" && (
              <>
                <div className="p-4 text-center border-b border-gray-100 font-medium">
                  创建新聊天
                </div>
                <button
                  onClick={() => setCreateStep("manual_input")}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      手动创建角色
                    </div>
                    <div className="text-xs text-gray-500">
                      自定义名字和头像
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => importFileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      从角色卡导入
                    </div>
                    <div className="text-xs text-gray-500">支持 .json 格式</div>
                  </div>
                </button>
                <div className="p-2 bg-gray-50">
                  <button
                    onClick={closeCreateModal}
                    className="w-full py-3 bg-white text-gray-600 rounded-lg shadow-sm font-medium hover:bg-gray-100"
                  >
                    取消
                  </button>
                </div>
              </>
            )}

            {createStep === "manual_input" && (
              <div className="flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                  <span className="font-medium">填写信息</span>
                  <button
                    onClick={() => setCreateStep("menu")}
                    className="text-sm text-gray-500"
                  >
                    返回
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      角色名字 <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={newAiName}
                      onChange={(e) => setNewAiName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white transition-colors outline-none focus:border-blue-500"
                      placeholder="例如：沈墨"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">
                      备注名
                    </label>
                    <input
                      value={newRemark}
                      onChange={(e) => setNewRemark(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 bg-gray-50 focus:bg-white transition-colors outline-none focus:border-blue-500"
                      placeholder="例如：哼呀鬼"
                    />
                  </div>
                </div>
                <div className="p-4 flex gap-3 bg-gray-50">
                  <button
                    onClick={closeCreateModal}
                    className="flex-1 py-2 bg-white border rounded-lg text-gray-600 font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmCreate}
                    className="flex-1 py-2 bg-[#07c160] text-white rounded-lg shadow-md font-medium"
                  >
                    创建
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAvatarPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAvatarPicker(null)}
          />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-lg font-medium">
                {showAvatarPicker === "ai" ? "选择对方头像" : "选择我的头像"}
              </h3>
              <button
                onClick={() => setShowAvatarPicker(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3 p-4">
              {(showAvatarPicker === "ai"
                ? aiPresetAvatars
                : myPresetAvatars
              ).map((avatar, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (showAvatarPicker === "ai") {
                      setEditData({ ...editData, aiAvatar: avatar });
                    } else if (showAvatarPicker === "my") {
                      setEditData({ ...editData, myAvatar: avatar });
                    }
                    setShowAvatarPicker(null);
                  }}
                  className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-2xl hover:bg-gray-200 transition hover:scale-110 cursor-pointer"
                >
                  {avatar}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsList;
