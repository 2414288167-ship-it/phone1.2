"use client";
import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import MessageList, { Message } from "@/components/MessageList";
import { InputArea } from "@/components/InputArea";
import { Menu, ChevronLeft, Share, Star, Trash2, X } from "lucide-react";
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

interface ChatPageProps {
  conversationId: string;
  contactName?: string;
}

interface UserProfile {
  avatar: string;
  personas: { id: string; name: string; avatar: string }[];
}

export default function ChatPage({
  conversationId,
  contactName = "AI助手",
}: ChatPageProps) {
  // ✅ 获取 regenerateChat
  const { requestAIReply, getChatState, triggerActiveMessage, regenerateChat } =
    useAI();
  const { clearUnread } = useUnread();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [myAvatar, setMyAvatar] = useState<string>("");

  // ✅ 多选模式状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<NodeJS.Timeout | null>(null);

  const reloadMessages = () => {
    if (!conversationId) return;
    const savedMsgs = localStorage.getItem(`chat_${conversationId}`);
    if (savedMsgs) setMessages(JSON.parse(savedMsgs));
  };

  // 🔥🔥🔥 新增：辅助函数：获取预设上下文 🔥🔥🔥
  const getPresetContext = (presetId: string | undefined): string => {
    if (!presetId) return "";
    try {
      const presetsStr = localStorage.getItem("app_presets");
      if (!presetsStr) return "";
      const presets = JSON.parse(presetsStr);
      const targetPreset = presets.find((p: any) => p.id === presetId);

      if (!targetPreset || !targetPreset.prompts) return "";

      // 筛选出 enabled 为 true 的 prompt，并按顺序拼接
      // 注意：Tavern JSON 通常有 prompt_order，这里简化处理，直接按数组顺序
      // 并且我们只提取 content
      return targetPreset.prompts
        .filter((p: any) => p.enabled)
        .map((p: any) => {
          // 这里可以根据 p.role 做一些特殊处理，比如如果是 user role，可以加前缀
          // 但通常 Tavern 预设直接拼接到 System Prompt 里效果最好
          return p.content;
        })
        .join("\n\n");
    } catch (e) {
      console.error("预设读取失败", e);
      return "";
    }
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
          setContactInfo({
            ...currentContact,
            name: currentContact.remark || currentContact.name,
            aiName: currentContact.aiName || currentContact.name,
            myNickname: "我",
          });
        } else {
          setContactInfo({
            name: contactName,
            avatar: "🐱",
            aiName: contactName,
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
  }, [conversationId, clearUnread, contactName]);

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
    // 仅在非多选模式下自动滚动
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

  // ✅ 智能重新说
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
        if (conversationId && contactInfo)
          requestAIReply(conversationId, contactInfo, updatedMessages);
      }, 6000);
    }
  };

  const aiStatus = conversationId ? getChatState(conversationId) : "idle";
  const getHeaderStatus = () => {
    if (aiStatus === "thinking") return "对方正在思考...";
    if (aiStatus === "typing") return "对方正在输入...";
    return contactInfo?.name || contactName;
  };
  const safeContactInfo = contactInfo || {
    name: contactName,
    avatar: "🐱",
    aiName: contactName,
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
          // ✅ 传递多选 Props
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onToggleSelection={toggleSelection}
          onEnterSelectionMode={enterSelectionMode}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* 底部根据模式切换 */}
      {isSelectionMode ? (
        <div className="h-16 bg-white border-t flex items-center justify-around px-4 z-50 shadow-up">
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
