"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MessageList, { Message } from "@/components/MessageList";
import { InputArea } from "@/components/InputArea";
import {
  Menu,
  ChevronLeft,
  Share,
  Star,
  Trash2,
  X,
  BookMarked,
} from "lucide-react";
import { useAI } from "@/context/AIContext";
import { useUnread } from "@/context/UnreadContext";

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// 🔥🔥🔥 新增：辅助函数：根据输入内容和世界书ID，获取相关的设定文本 🔥🔥🔥
const getWorldBookContext = (
  text: string,
  worldBookId: string | undefined
): string => {
  if (!worldBookId || !text) return "";

  try {
    // 1. 读取所有世界书数据
    const wbDataStr = localStorage.getItem("worldbook_data");
    if (!wbDataStr) return "";
    const wbData = JSON.parse(wbDataStr);

    // 2. 找到当前角色对应的书
    // 假设 worldBookId 对应的是 categoryId (你在 page.tsx 里是这么存的)
    const books = wbData.books.filter(
      (b: any) => String(b.categoryId) === String(worldBookId)
    );

    if (!books || books.length === 0) return "";

    let foundContexts: string[] = [];

    // 3. 遍历这本书里的所有条目
    books.forEach((book: any) => {
      // 兼容两种结构
      const entries = Array.isArray(book.content) ? book.content : [];

      entries.forEach((entry: any) => {
        // 检查是否启用
        if (entry.enabled === false) return;

        // 4. 检查关键词匹配 (entry.keys)
        if (entry.keys && Array.isArray(entry.keys)) {
          const isMatch = entry.keys.some((key: string) =>
            text.toLowerCase().includes(key.toLowerCase())
          );

          if (isMatch) {
            console.log(
              `[世界书触发] 关键词: ${entry.keys} -> 内容: ${entry.content}`
            );
            foundContexts.push(entry.content);
          }
        }
      });
    });

    // 5. 返回拼接后的设定内容
    if (foundContexts.length > 0) {
      // 去重
      const uniqueContexts = Array.from(new Set(foundContexts));
      return `\n\n[World Info / Additional Context]:\n${uniqueContexts.join(
        "\n"
      )}\n`;
    }
  } catch (e) {
    console.error("世界书检索失败", e);
  }
  return "";
};

interface UserProfile {
  avatar: string;
  personas: { id: string; name: string; avatar: string }[];
}

interface PageProps {
  params: { id: string };
}

export default function ChatPage({ params }: PageProps) {
  const conversationId = params?.id || "";

  const { requestAIReply, getChatState, triggerActiveMessage, regenerateChat } =
    useAI();
  const { clearUnread } = useUnread();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [myAvatar, setMyAvatar] = useState<string>("");

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reloadMessages = () => {
    if (!conversationId) return;
    const savedMsgs = localStorage.getItem(`chat_${conversationId}`);
    if (savedMsgs) setMessages(JSON.parse(savedMsgs));
  };

  // --- 1. 生理期感知提示词 ---
  const getMenstrualPrompt = (contact: any) => {
    if (!contact?.menstrualData) return "";
    const { lastDate, duration, cycle } = contact.menstrualData;
    if (!lastDate) return "";

    const start = new Date(lastDate);
    const today = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((today.getTime() - start.getTime()) / oneDay);
    const currentCycleDay = diffDays % cycle;

    if (currentCycleDay >= 0 && currentCycleDay < duration) {
      const dayCount = currentCycleDay + 1;
      return `\n\n[System Note: User is currently on day ${dayCount} of her menstrual period. She might feel physical discomfort or emotional fluctuations. Please naturally show care, comfort her, or offer gentle company in your character's tone. Do NOT mention "System Note" or "AI". Just act like you know and care.]`;
    }
    if (currentCycleDay >= cycle - 2) {
      return `\n\n[System Note: User's menstrual period is expected to start in 1-2 days. She might be irritable or tired. Be extra patient and gentle.]`;
    }
    return "";
  };

  // --- 2. 永久记忆注入逻辑 ---
  const getMemoryPrompt = (contact: any) => {
    // 读取 memoryGroups
    const groups = contact.permanentMemory || [];
    if (!Array.isArray(groups) || groups.length === 0) return "";

    let memoryText = "\n\n[Long-term Memory / Important Facts about User]:\n";

    // 遍历分组
    groups.forEach((group: any) => {
      // 如果是旧数据结构(没有items)，跳过
      if (!group.items) return;
      if (group.items.length === 0) return;

      memoryText += `\n### ${group.title}:\n`;
      group.items.forEach((item: any) => {
        memoryText += `- ${item.content}\n`;
      });
    });

    memoryText +=
      "\n[Instruction: Keep these memories in mind. If the user mentions related topics, reference these facts naturally.]";
    return memoryText;
  };

  useEffect(() => {
    if (conversationId && typeof window !== "undefined") {
      const contactsStr = localStorage.getItem("contacts");
      let currentContact = null;
      if (contactsStr) {
        const contacts = JSON.parse(contactsStr);
        currentContact = contacts.find(
          (c: any) => String(c.id) === String(conversationId)
        );
        if (currentContact) {
          // 获取各种提示词
          const periodPrompt = getMenstrualPrompt(currentContact);
          const memoryPrompt = getMemoryPrompt(currentContact); // ✅ 获取记忆提示词

          // 用户喜好提示词
          const prefPrompt = currentContact.userPreferences
            ? `\n\n[User Preferences/Dislikes]:\n${currentContact.userPreferences}`
            : "";

          setContactInfo({
            ...currentContact,
            name: currentContact.remark || currentContact.name,
            aiName: currentContact.aiName || currentContact.name,
            // 🔥 将所有“外挂”记忆拼接到 AI 人设后面
            aiPersona:
              (currentContact.aiPersona || "") +
              prefPrompt +
              memoryPrompt +
              periodPrompt,
            myNickname: "我",
          });
        } else {
          setContactInfo({
            name: "AI角色",
            avatar: "🐱",
            aiName: "AI角色",
            myNickname: "我",
          });
        }
      }

      const userProfileStr = localStorage.getItem("user_profile_v4");
      let finalMyAvatar = "";
      if (userProfileStr) {
        try {
          const profile: UserProfile = JSON.parse(userProfileStr);
          const boundPersonaId = currentContact?.userPersonaId || "default";
          const targetPersona = profile.personas?.find(
            (p) => p.id === boundPersonaId
          );
          if (targetPersona && targetPersona.avatar)
            finalMyAvatar = targetPersona.avatar;
          else if (profile.avatar) finalMyAvatar = profile.avatar;
          else if (profile.personas && profile.personas.length > 0)
            finalMyAvatar = profile.personas[0].avatar;
        } catch (e) {
          console.error(e);
        }
      }
      setMyAvatar(finalMyAvatar);

      const savedBg = localStorage.getItem(`chat_bg_${conversationId}`);
      if (savedBg) setBgImage(savedBg);

      reloadMessages();
      clearUnread(conversationId);
    }
  }, [conversationId, clearUnread]);

  // 监听更新事件
  useEffect(() => {
    const handleUpdate = (e: CustomEvent) => {
      if (String(e.detail.conversationId) === String(conversationId)) {
        reloadMessages();
        clearUnread(conversationId);
      }
    };
    window.addEventListener("chat_updated" as any, handleUpdate);
    return () =>
      window.removeEventListener("chat_updated" as any, handleUpdate);
  }, [conversationId, clearUnread]);

  useEffect(() => {
    if (!isSelectionMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isPanelOpen, isSelectionMode]);

  useEffect(() => {
    if (input.trim().length > 0 && replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, [input]);

  // === 多选逻辑 ===
  const enterSelectionMode = (initialMsgId?: string) => {
    setIsSelectionMode(true);
    if (initialMsgId) {
      setSelectedIds(new Set([initialMsgId]));
    } else {
      setSelectedIds(new Set());
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelection = (msgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // ✅ 升级版：存入永久记忆逻辑（支持分组）
  const handleSaveToMemory = () => {
    if (selectedIds.size === 0) return;

    const selectedMsgs = messages.filter((m) => selectedIds.has(m.id));
    if (!conversationId) return;

    const contactsStr = localStorage.getItem("contacts");
    if (!contactsStr) return;

    try {
      const contacts = JSON.parse(contactsStr);
      const updatedContacts = contacts.map((c: any) => {
        if (String(c.id) === String(conversationId)) {
          let existingData = c.permanentMemory || [];

          if (
            Array.isArray(existingData) &&
            existingData.length > 0 &&
            !existingData[0].items
          ) {
            existingData = [
              {
                id: "default_group",
                title: "默认分组",
                items: existingData,
              },
            ];
          } else if (existingData.length === 0) {
            existingData = [
              {
                id: "default_group",
                title: "未分类收藏",
                items: [],
              },
            ];
          }

          const newMemories = selectedMsgs.map((msg) => ({
            id: msg.id,
            content: msg.content,
            date: new Date().toISOString(),
            source: "chat_selection",
          }));

          const targetGroup = existingData[0];
          const contentSet = new Set(
            targetGroup.items.map((m: any) => m.content)
          );
          const uniqueNewMemories = newMemories.filter(
            (m) => !contentSet.has(m.content)
          );

          targetGroup.items = [...targetGroup.items, ...uniqueNewMemories];

          return {
            ...c,
            permanentMemory: existingData,
          };
        }
        return c;
      });

      localStorage.setItem("contacts", JSON.stringify(updatedContacts));
      // ✅ 触发更新事件，让界面（比如记忆管理页）能感知到
      window.dispatchEvent(
        new CustomEvent("chat_updated", { detail: { conversationId } })
      );

      alert(
        `已将 ${selectedMsgs.length} 条消息存入记忆分组：“${
          updatedContacts.find(
            (c: any) => String(c.id) === String(conversationId)
          ).permanentMemory[0].title
        }”`
      );
      exitSelectionMode();
    } catch (e) {
      console.error("保存记忆失败", e);
      alert("保存失败");
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`确定删除这 ${selectedIds.size} 条消息吗？`)) {
      const newMessages = messages.filter((m) => !selectedIds.has(m.id));
      setMessages(newMessages);
      if (conversationId) {
        localStorage.setItem(
          `chat_${conversationId}`,
          JSON.stringify(newMessages)
        );
      }
      exitSelectionMode();
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    setMessages((prev) => {
      const newMessages = prev.filter((m) => m.id !== msgId);
      if (conversationId)
        localStorage.setItem(
          `chat_${conversationId}`,
          JSON.stringify(newMessages)
        );
      return newMessages;
    });
  };

  const handleResendMessage = (msg: Message) => {
    if (conversationId && contactInfo) {
      regenerateChat(conversationId, msg.id, contactInfo);
    }
  };

  const handleContinueMessage = (msg: Message) => {
    if (conversationId && contactInfo) {
      // @ts-ignore
      triggerActiveMessage(conversationId, contactInfo, "continue");
    }
  };

  const handleEditMessage = (msg: Message) => {
    if (msg.role !== "user" || msg.type !== "text") return;
    setInput(msg.content);
    handleDeleteMessage(msg.id);
  };

  // 🔥🔥🔥 核心修改：handleUserSend 🔥🔥🔥
  const handleUserSend = (
    text: string,
    type: "text" | "audio" | "image" | "sticker" = "text",
    duration?: number,
    audioUrl?: string,
    tempId?: string,
    imageDesc?: string
  ) => {
    if (type === "text" && !text?.trim()) return;

    let updatedMessages: Message[] = [];
    setMessages((prev) => {
      let newMessages = [...prev];
      if (tempId) {
        newMessages = newMessages.map((msg) =>
          msg.id === tempId
            ? { ...msg, content: text, status: "sent" as const }
            : msg
        );
      } else {
        const finalType = imageDesc ? "sticker" : (type as any);
        const userMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: text || "",
          timestamp: new Date(),
          type: finalType,
          duration: duration,
          audioUrl: audioUrl,
          status: type === "audio" && !text ? "sending" : "sent",
          alt: imageDesc,
        };
        newMessages.push(userMessage);
      }
      if (conversationId)
        localStorage.setItem(
          `chat_${conversationId}`,
          JSON.stringify(newMessages)
        );
      updatedMessages = newMessages;
      return newMessages;
    });

    if (type === "text") setInput("");

    const isReadyToSendToAI = !(type === "audio" && !text);
    if (isReadyToSendToAI) {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

      replyTimerRef.current = setTimeout(() => {
        if (conversationId && contactInfo) {
          // 🔥 1. 获取针对当前用户输入的“世界书设定”
          // 这里我们传入当前的文本 (text)，以及角色的 worldBookId
          const worldBookContext = getWorldBookContext(
            text,
            contactInfo.worldBookId
          );
          // 🔥 2. 获取预设设定 (新增) 🔥
          // contactInfo.presetId 是我们在 preset page 里绑定到 localStorage 里的
          const getPresetContext = (presetId: string | undefined): string => {
            if (!presetId) return "";
            try {
              const presetsStr = localStorage.getItem("app_presets");
              if (!presetsStr) return "";
              const presets = JSON.parse(presetsStr);
              const targetPreset = presets.find((p: any) => p.id === presetId);

              if (!targetPreset || !targetPreset.prompts) return "";

              // 筛选出 enabled 为 true 的 prompt，并按顺序拼接
              return targetPreset.prompts
                .filter((p: any) => p.enabled)
                .map((p: any) => p.content)
                .join("\n\n");
            } catch (e) {
              console.error("预设读取失败", e);
              return "";
            }
          };
          const presetContext = getPresetContext(contactInfo.presetId);

          // 3. 组合所有“外挂”
          // 世界书通常是对名词的解释，放在 [World Info] 里
          // 预设通常是文风控制，放在开头或结尾

          let additionalPrompt = "";

          if (presetContext) {
            additionalPrompt += `\n\n[System Directives / Writing Style Guide]:\n${presetContext}\n`;
          }

          if (worldBookContext) {
            additionalPrompt += worldBookContext;
          }

          const enhancedContactInfo = {
            ...contactInfo,
            aiPersona: (contactInfo.aiPersona || "") + additionalPrompt,
          };

          // 🔥🔥🔥 新增：打印最终发给 AI 的人设，检查预设是否在里面 🔥🔥🔥
          console.log(
            "====== 最终发送给 AI 的系统提示词 (System Prompt) ======"
          );
          console.log(enhancedContactInfo.aiPersona);
          console.log("======================================================");

          requestAIReply(conversationId, enhancedContactInfo, updatedMessages);
        }
      }, 6000);
    }
  };

  const aiStatus = conversationId ? getChatState(conversationId) : "idle";
  const getHeaderStatus = () => {
    if (aiStatus === "thinking") return "对方正在思考...";
    if (aiStatus === "typing") return "对方正在输入...";
    return contactInfo?.name || "AI角色";
  };
  const safeContactInfo = contactInfo || {
    name: "AI角色",
    avatar: "🐱",
    aiName: "AI角色",
    myNickname: "我",
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white/90 backdrop-blur-sm shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="-ml-2 p-2 text-gray-700 hover:bg-gray-100 rounded-full"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          {safeContactInfo.avatar && (
            <div className="relative w-9 h-9 shrink-0">
              <img
                src={safeContactInfo.avatar}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover border border-gray-200"
              />
              {aiStatus === "idle" && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
              )}
            </div>
          )}
          <div className="flex flex-col justify-center">
            <div className="font-semibold text-base leading-tight">
              {getHeaderStatus()}
            </div>
          </div>
        </div>
        <Link
          href={`/chat/${conversationId}/info`}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
        >
          <Menu className="w-5 h-5" />
        </Link>
      </header>

      <div
        className="flex-1 overflow-y-auto px-1 pt-1 pb-7"
        style={{
          backgroundColor: bgImage ? "transparent" : "#f5f5f5",
          backgroundImage: bgImage ? `url(${bgImage})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <MessageList
          messages={messages}
          isLoading={aiStatus === "thinking" || aiStatus === "typing"}
          contactInfo={safeContactInfo}
          contactAvatar={safeContactInfo.avatar}
          myAvatar={myAvatar}
          conversationId={conversationId}
          onDeleteMessage={handleDeleteMessage}
          onResendMessage={handleResendMessage}
          onContinueMessage={handleContinueMessage}
          onEditMessage={handleEditMessage}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onEnterSelectionMode={enterSelectionMode}
        />
        <div ref={messagesEndRef} />
      </div>

      {isSelectionMode ? (
        <div className="h-16 bg-white border-t flex items-center justify-around px-4 z-50 shadow-up">
          <button
            onClick={handleSaveToMemory}
            className="flex flex-col items-center gap-1 text-gray-600 active:text-green-600"
          >
            <BookMarked className="w-5 h-5" />
            <span className="text-[10px]">存记忆</span>
          </button>
          <button
            onClick={() => alert("暂未实现")}
            className="flex flex-col items-center gap-1"
          >
            <Share className="w-5 h-5 text-gray-600" />
            <span className="text-[10px] text-gray-500">转发</span>
          </button>
          <button
            onClick={() => alert("暂未实现")}
            className="flex flex-col items-center gap-1"
          >
            <Star className="w-5 h-5 text-gray-600" />
            <span className="text-[10px] text-gray-500">收藏</span>
          </button>
          <button
            onClick={handleBatchDelete}
            className="flex flex-col items-center gap-1 text-red-500"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[10px]">删除</span>
          </button>
          <div className="w-[1px] h-6 bg-gray-200"></div>
          <button
            onClick={exitSelectionMode}
            className="flex flex-col items-center gap-1"
          >
            <X className="w-6 h-6 text-gray-500" />
            <span className="text-[10px] text-gray-500">取消</span>
          </button>
        </div>
      ) : (
        <InputArea
          input={input}
          isLoading={aiStatus === "thinking" || aiStatus === "typing"}
          onInputChange={setInput}
          onSendText={() => handleUserSend(input, "text")}
          onPanelChange={(isOpen) => {
            setIsPanelOpen(isOpen);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 300);
          }}
          onSendAudio={async (text, duration, audioBlob, imageDesc) => {
            if (imageDesc) {
              handleUserSend(text, "image", 0, undefined, undefined, imageDesc);
              return;
            }
            let audioDataUrl = undefined;
            if (audioBlob) audioDataUrl = await blobToBase64(audioBlob);
            const tempId = Date.now().toString();
            handleUserSend("", "audio", duration, audioDataUrl, undefined);
            if (audioBlob) {
              const formData = new FormData();
              formData.append("file", audioBlob);
              const res = await fetch("/api/audio", {
                method: "POST",
                body: formData,
              });
              if (res.ok) {
                const data = await res.json();
                handleUserSend(
                  data.text || "[听不清]",
                  "audio",
                  duration,
                  audioDataUrl,
                  tempId
                );
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === tempId
                      ? { ...m, content: "[转写失败]", status: "error" }
                      : m
                  )
                );
              }
            }
          }}
        />
      )}
    </div>
  );
}
