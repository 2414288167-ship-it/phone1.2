"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Compass,
  User,
  ChevronLeft,
  X,
  Upload,
  FileJson,
  PenLine,
} from "lucide-react";
import { SwipeableItem } from "@/components/swipeableItem";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useUnread } from "@/context/UnreadContext";

// --- 接口定义 ---

interface Contact {
  id: string;
  name: string;
  avatar: string;
  remark?: string;
  intro?: string;
  aiName?: string;
  myNickname?: string;
  isPinned?: boolean;

  // 🔥🔥🔥 修改 1: 拆分人设与风格，防止 AI 混淆 🔥🔥🔥
  description?: string; // 纯粹的角色背景、身份、性格
  stylePreset?: string; // 这里的预设只包含：写作风格、回复格式、系统指令
  exampleDialogue?: string; // 对话示例 (mes_example)，这对 AI 模仿语气至关重要
  // 🔥🔥🔥 修改结束 🔥🔥🔥

  firstMessage?: string;
  worldBookId?: string;
}

// 对应 NotesPage 的数据结构
interface BookContent {
  keys: string[];
  comment: string;
  content: string;
  enabled: boolean;
}
interface Book {
  id: string;
  name: string;
  content: BookContent[];
  categoryId: number;
}
interface Category {
  name: string;
  id: number;
}
interface WorldBookData {
  books: Book[];
  categories: Category[];
}

// PNG 解析工具 (保持不变)
const extractPngMetadata = (buffer: ArrayBuffer): string | null => {
  const view = new DataView(buffer);
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a)
    return null;
  let offset = 8;
  const decoder = new TextDecoder("utf-8");
  while (offset < buffer.byteLength) {
    const length = view.getUint32(offset);
    const type = decoder.decode(new Uint8Array(buffer, offset + 4, 4));
    if (type === "tEXt") {
      const dataStart = offset + 8;
      const data = new Uint8Array(buffer, dataStart, length);
      let separatorIndex = -1;
      for (let i = 0; i < length; i++) {
        if (data[i] === 0) {
          separatorIndex = i;
          break;
        }
      }
      if (separatorIndex !== -1) {
        const keyword = decoder.decode(data.slice(0, separatorIndex));
        const text = decoder.decode(data.slice(separatorIndex + 1));
        if (keyword === "chara") {
          try {
            const binaryString = atob(text);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder("utf-8").decode(bytes);
          } catch (e) {
            return text;
          }
        }
      }
    }
    offset += length + 12;
  }
  return null;
};

export const dynamic = "force-dynamic";

export default function ChatListPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { unreadCounts, totalUnread } = useUnread();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState<"menu" | "manual">("menu");
  const [newName, setNewName] = useState("");
  const [newRemark, setNewRemark] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultContacts: Contact[] = [
    {
      id: "1",
      name: "哼呀鬼",
      avatar: "🐱",
      remark: "哼呀鬼",
      intro: "在办公室...",
      isPinned: false,
    },
  ];

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("contacts");
        let parsedContacts = saved ? JSON.parse(saved) : defaultContacts;
        if (!saved)
          localStorage.setItem("contacts", JSON.stringify(defaultContacts));
        const contactsWithLatestMsg = parsedContacts.map((contact: Contact) => {
          const chatHistoryStr = localStorage.getItem(`chat_${contact.id}`);
          if (chatHistoryStr) {
            try {
              const messages = JSON.parse(chatHistoryStr);
              if (messages.length > 0) {
                const lastMsg = messages[messages.length - 1];
                return { ...contact, intro: lastMsg.content };
              }
            } catch (e) {}
          }
          return contact;
        });
        setContacts(sortContacts(contactsWithLatestMsg));
      } catch (e) {
        setContacts(defaultContacts);
      }
      setIsLoaded(true);
    }
  }, []);

  const sortContacts = (list: Contact[]) => {
    return [...list].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  };

  const handlePlusClick = () => {
    setCreateStep("menu");
    setNewName("");
    setNewRemark("");
    setShowCreateModal(true);
  };

  const handleManualCreate = () => {
    if (!newName.trim()) {
      alert("请输入角色名字");
      return;
    }
    const randomId = Date.now().toString();
    const newContact: Contact = {
      id: randomId,
      name: newName,
      avatar: "🤖",
      remark: newRemark || newName,
      intro: "你好",
      aiName: newName,
      myNickname: "我",
      isPinned: false,
      // 手动创建时，给一个基础的风格预设
      stylePreset: "请用自然的口语与我对话，不要像个机器人。",
    };
    const updated = [newContact, ...contacts];
    setContacts(sortContacts(updated));
    localStorage.setItem("contacts", JSON.stringify(updated));
    setShowCreateModal(false);
    router.push(`/chat/${newContact.id}`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let characterData: any = null;
      let cardAvatar: string = "🐱";

      if (file.type === "image/png") {
        const arrayBuffer = await file.arrayBuffer();
        const extractedJson = extractPngMetadata(arrayBuffer);
        if (extractedJson) {
          try {
            const parsed = JSON.parse(extractedJson);
            characterData = parsed.data || parsed;
          } catch (err) {
            console.error(err);
          }
        }
        if (characterData) {
          cardAvatar = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          alert("无法识别此 PNG 图片中的角色信息 (非 Tavern 格式?)");
          return;
        }
      } else {
        const text = await file.text();
        characterData = JSON.parse(text);
      }

      if (characterData) {
        const charName =
          characterData.name || characterData.char_name || "导入角色";

        // --- 核心修复：分离数据字段 ---

        // 1. 基础描述 (Identity)
        const baseDesc = characterData.description || "";
        const personality = characterData.personality || "";
        const scenario = characterData.scenario || "";

        // 将身份相关内容合并到 description
        let finalDescription = baseDesc;
        if (personality)
          finalDescription += `\n\n[Personality]: ${personality}`;
        if (scenario) finalDescription += `\n\n[Scenario]: ${scenario}`;

        // 2. 风格与预设 (Style Preset)
        // 提取系统指令、越狱指令或风格指导
        const systemPrompt = characterData.system_prompt || "";
        const postHistory = characterData.post_history_instructions || "";
        // 许多酒馆卡把风格写在 "note" 或扩展字段里，这里主要提取 V2 标准字段

        const extractedPreset = [
          systemPrompt ? `[System Instruction]: ${systemPrompt}` : "",
          postHistory ? `[Writing Style]: ${postHistory}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        // 3. 对话示例 (Dialogue Examples) - 只要这个混在 description 里，AI 就容易错乱
        const mesExample =
          characterData.mes_example || characterData.example_dialogue || "";

        const charIntro =
          characterData.first_mes || characterData.greeting || "你好";

        // --- 世界书处理 (保持原有逻辑) ---
        let importedWorldBookId = "";
        const wbData = characterData.character_book || characterData.lorebook;

        if (wbData && (wbData.entries || wbData.entries_list)) {
          const existingWBStr = localStorage.getItem("worldbook_data");
          let existingWB: WorldBookData = existingWBStr
            ? JSON.parse(existingWBStr)
            : { books: [], categories: [] };

          if (!existingWB.books) existingWB.books = [];
          if (!existingWB.categories) existingWB.categories = [];

          const newCategoryId = Date.now();
          const entriesRaw = wbData.entries || wbData.entries_list || [];
          const entriesArray = Array.isArray(entriesRaw)
            ? entriesRaw
            : Object.values(entriesRaw);

          const newBooks: Book[] = entriesArray.map(
            (entry: any, index: number) => {
              const keys = entry.keys || entry.key || [];
              const finalKeys = Array.isArray(keys)
                ? keys
                : typeof keys === "string"
                ? keys.split(",")
                : [];
              const enabled = entry.enabled !== false;

              return {
                id: `${newCategoryId}_${index}`,
                categoryId: newCategoryId,
                name: finalKeys[0] || `条目 ${index + 1}`,
                content: [
                  {
                    keys: finalKeys,
                    content: entry.content || "",
                    comment: entry.comment || "",
                    enabled: enabled,
                  },
                ],
              };
            }
          );

          newBooks.unshift({
            id: `${newCategoryId}_summary_auto`,
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

          if (newBooks.length > 0) {
            existingWB.categories.push({
              id: newCategoryId,
              name: `${charName}的世界书 (导入)`,
            });
            existingWB.books.push(...newBooks);

            localStorage.setItem("worldbook_data", JSON.stringify(existingWB));
            importedWorldBookId = String(newCategoryId);
            alert(
              `📖 成功导入世界书：《${charName}的世界书》，共 ${newBooks.length} 条设定。`
            );
          }
        }

        // 🔥🔥🔥 核心：将清洗后的数据存入 Contact 🔥🔥🔥
        const newContact: Contact = {
          id: Date.now().toString(),
          name: charName,
          avatar: cardAvatar,
          remark: charName,
          intro: charIntro,
          aiName: charName,
          myNickname: "我",
          isPinned: false,

          // 这里是关键：我们把数据分开放，而不是全塞进 description
          description: finalDescription,
          stylePreset: extractedPreset, // 存入独立的风格字段
          exampleDialogue: mesExample, // 存入独立的示例字段

          firstMessage: charIntro,
          worldBookId: importedWorldBookId,
        };

        const updated = [newContact, ...contacts];
        setContacts(sortContacts(updated));
        localStorage.setItem("contacts", JSON.stringify(updated));

        if (charIntro) {
          const initialMsg = [
            {
              id: Date.now().toString(),
              role: "assistant",
              content: charIntro,
              timestamp: new Date(),
              type: "text",
            },
          ];
          localStorage.setItem(
            `chat_${newContact.id}`,
            JSON.stringify(initialMsg)
          );
        }

        setShowCreateModal(false);
        router.push(`/chat/${newContact.id}`);
      } else {
        alert("文件解析失败：未找到有效的角色数据。");
      }
    } catch (err) {
      console.error("导入失败", err);
      alert("导入失败：请确保文件是标准的 PNG 角色卡或 JSON 格式。");
    }
    e.target.value = "";
  };

  const handlePin = (id: string) => {
    const updated = contacts.map((c) =>
      c.id === id ? { ...c, isPinned: !c.isPinned } : c
    );
    setContacts(sortContacts(updated));
    localStorage.setItem("contacts", JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    if (confirm("确认删除？")) {
      const updated = contacts.filter((c) => c.id !== id);
      setContacts(updated);
      localStorage.setItem("contacts", JSON.stringify(updated));
      localStorage.removeItem(`chat_${id}`);
    }
  };

  const handleRead = (id: string) => {};

  const goBackHome = () => {
    console.log("正在跳转回首页...");
    router.push("/");
  };

  if (!isLoaded) return null;

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 overflow-hidden relative">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,.png"
        className="hidden"
        onChange={handleImportFile}
      />

      <header className="px-4 h-14 flex items-center justify-between bg-[#ededed] border-b border-gray-200 shrink-0 z-50 relative">
        <button
          onClick={goBackHome}
          className="p-1 -ml-2 text-gray-900 active:bg-gray-200 rounded-full z-30 cursor-pointer"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium text-gray-900 absolute left-1/2 transform -translate-x-1/2 pointer-events-none">
          消息 ({contacts.length})
        </h1>
        <div className="flex gap-4 z-30">
          <button className="text-gray-900 p-1">
            <Search className="w-5 h-5" />
          </button>
          <button onClick={handlePlusClick} className="text-gray-900 p-1">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-16">
        {contacts.map((contact) => {
          const unreadCount = unreadCounts[String(contact.id)] || 0;
          return (
            <SwipeableItem
              key={contact.id}
              isPinned={contact.isPinned}
              onPin={() => handlePin(contact.id)}
              onDelete={() => handleDelete(contact.id)}
              onRead={() => handleRead(contact.id)}
            >
              <Link
                href={`/chat/${contact.id}`}
                className={`flex items-center gap-3 px-4 py-3 active:bg-gray-100 transition-colors ${
                  contact.isPinned ? "bg-gray-50" : "bg-white"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-2xl overflow-hidden">
                    {contact.avatar?.startsWith("http") ||
                    contact.avatar?.startsWith("data:") ? (
                      <Image
                        src={contact.avatar}
                        alt={contact.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">{contact.avatar}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 z-50 min-w-[1.125rem] h-[1.125rem] bg-red-500 text-white text-[10px] font-bold px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="font-medium text-base text-gray-900 truncate">
                      {contact.remark || contact.name}
                    </h3>
                    <span className="text-xs text-gray-300">刚刚</span>
                  </div>
                  <p
                    className={`text-sm truncate ${
                      unreadCount > 0 ? "text-gray-800" : "text-gray-400"
                    }`}
                  >
                    {unreadCount > 0 ? `[${unreadCount}条] ` : ""}
                    {contact.intro || "点击开始聊天..."}
                  </p>
                </div>
              </Link>
            </SwipeableItem>
          );
        })}
      </div>

      <div className="h-16 bg-[#f7f7f7] border-t border-gray-200 flex items-center justify-around text-[11px] shrink-0 fixed bottom-0 w-full z-30 pb-1 safe-area-bottom">
        <div className="flex flex-col items-center justify-center h-full w-1/4 cursor-default text-[#07c160]">
          <div className="relative">
            <MessageSquare className="w-7 h-7 mb-0.5 fill-current" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[0.5rem] h-2 w-2 bg-red-500 rounded-full border border-white"></span>
            )}
          </div>
          <span>微信</span>
        </div>
        <Link
          href="/contacts"
          className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
        >
          <Users className="w-7 h-7 mb-0.5" />
          <span>通讯录</span>
        </Link>
        <Link
          href="/discover"
          className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
        >
          <Compass className="w-7 h-7 mb-0.5" />
          <span>发现</span>
        </Link>
        <Link
          href="/me"
          className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
        >
          <User className="w-7 h-7 mb-0.5" />
          <span>我</span>
        </Link>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-[320px] bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {createStep === "menu" ? (
              <>
                <div className="py-4 text-center border-b border-gray-100">
                  <h3 className="text-[17px] font-semibold text-gray-900">
                    创建新聊天
                  </h3>
                </div>
                <div className="flex flex-col">
                  <button
                    onClick={() => setCreateStep("manual")}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 text-left"
                  >
                    <PenLine className="w-5 h-5 text-blue-500" />
                    <span className="text-blue-500 font-medium text-[16px]">
                      手动创建角色
                    </span>
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                  >
                    <FileJson className="w-5 h-5 text-blue-500" />
                    <div>
                      <span className="text-blue-500 font-medium text-[16px] block">
                        从角色卡导入 (.json)
                      </span>
                      <span className="text-xs text-gray-400 mt-0.5">
                        支持 JSON / PNG (自动导入世界书)
                      </span>
                    </div>
                  </button>
                </div>
                <div className="h-2 bg-gray-100/50"></div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-3.5 text-center text-gray-600 font-medium text-[16px] hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  取消
                </button>
              </>
            ) : (
              <div className="p-5">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-bold text-gray-900 text-[17px]">
                    填写角色信息
                  </h3>
                  <button
                    onClick={() => setCreateStep("menu")}
                    className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                  >
                    返回
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">
                      角色名字 <span className="text-red-500">*</span>
                    </label>
                    <input
                      autoFocus
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#07c160] focus:bg-white transition-all caret-[#07c160]"
                      placeholder="例如：沈墨"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block font-medium">
                      备注名 (列表显示)
                    </label>
                    <input
                      value={newRemark}
                      onChange={(e) => setNewRemark(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#07c160] focus:bg-white transition-all caret-[#07c160]"
                      placeholder="例如：猫猫头"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-2.5 text-[15px] font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleManualCreate}
                    className="flex-1 py-2.5 text-[15px] font-medium text-white bg-[#07c160] rounded-lg hover:bg-[#06ad56] shadow-md shadow-green-500/20 active:scale-95 transition-all"
                  >
                    确认创建
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
