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
  ChevronDown,
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
  const { requestAIReply, getChatState, triggerActiveMessage, regenerateChat } =
    useAI();
  const { clearUnread } = useUnread();

  // --- 🔥 滚动控制核心 Ref ---
  // isSticky: 标记"当前是否应该跟随到底部"。默认 true (跟随)
  const isSticky = useRef(true);
  // isUserInteracting: 标记"用户正在操作"。如果为 true，强行暂停自动滚动
  const isUserInteracting = useRef(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [myAvatar, setMyAvatar] = useState<string>("");

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const replyTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 交互锁定时器
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const reloadMessages = () => {
    if (!conversationId) return;
    const savedMsgs = localStorage.getItem(`chat_${conversationId}`);
    if (savedMsgs) setMessages(JSON.parse(savedMsgs));
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
            timeAwareness: currentContact.timeAwareness || false,
            asideMode: currentContact.asideMode || false,
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

  // --- 🔥🔥🔥 终极滚动逻辑 (含交互锁) 🔥🔥🔥 ---

  // 1. 滚动到底部 (执行者)
  const scrollToBottom = (behavior: "smooth" | "auto" = "auto") => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: behavior,
      });
      // 只要触发了强制到底，就恢复锁定 (除非用户正在按着屏幕)
      if (!isUserInteracting.current) {
        isSticky.current = true;
        setShowScrollButton(false);
      }
    }
  };

  // 2. 监听用户交互 (防抖)
  // 当用户 触摸屏幕、滚动滚轮、按下鼠标 时触发
  const handleUserInteraction = () => {
    isUserInteracting.current = true;
    // 同时也暂时解除锁定，防止手指一停就被拽回去
    isSticky.current = false;
    setShowScrollButton(true);

    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    // 1秒后如果没有后续操作，认为交互结束，解除"交互锁"
    // (注意：isSticky 不会自动变回 true，必须等用户滚到底部)
    interactionTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false;
    }, 1000);
  };

  // 3. 滚动位置监听
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    // 物理距离
    const distance = scrollHeight - scrollTop - clientHeight;

    // 阈值：20px
    if (distance > 20) {
      // 离底部远了 -> 用户在看历史
      isSticky.current = false;
      setShowScrollButton(true);
    } else if (distance < 5) {
      // 极其接近底部 -> 用户回到了最新
      isSticky.current = true;
      setShowScrollButton(false);
    }
  };

  // 4. 响应 AI 消息更新
  useEffect(() => {
    // 只有当：1. 之前锁定在底部  AND  2. 用户现在没按着屏幕
    if (!isSelectionMode && isSticky.current && !isUserInteracting.current) {
      // 使用 auto (瞬移)，防止动画冲突
      scrollToBottom("auto");
    }
  }, [messages, isSelectionMode, isPanelOpen]);

  // --- 输入框逻辑 ---
  useEffect(() => {
    if (input.trim().length > 0 && replyTimerRef.current) {
      clearTimeout(replyTimerRef.current);
      replyTimerRef.current = null;
    }
  }, [input]);

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

  const handleResendMessage = (msg: Message) => {
    if (conversationId && contactInfo) {
      regenerateChat(conversationId, msg.id, contactInfo);
    }
  };

  const handleContinueMessage = (msg: Message) => {
    if (conversationId && contactInfo) {
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

    // 用户发送时，强制锁定并滚动
    isSticky.current = true;
    isUserInteracting.current = false;
    setTimeout(() => scrollToBottom("smooth"), 100);

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
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 relative">
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

      {/* 
        🔥 滚动容器 
        - 绑定 onWheel, onTouchMove: 拦截用户意图
        - 绑定 onScroll: 监听位置
        - 移除 scroll-smooth
      */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleUserInteraction} // 鼠标滚轮 -> 判定为交互
        onTouchMove={handleUserInteraction} // 手指滑动 -> 判定为交互
        onMouseDown={handleUserInteraction} // 拖动滚动条 -> 判定为交互
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
        {/* 底部垫片 */}
        <div className="h-4" />
      </div>

      {/* ✨ 悬浮按钮：回到底部 ✨ */}
      {showScrollButton && !isSelectionMode && (
        <div
          className="absolute bottom-[80px] right-4 z-30 cursor-pointer animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200"
          onClick={() => {
            isUserInteracting.current = false; // 点击按钮，解除交互锁
            scrollToBottom("smooth"); // 主动点击，可以使用平滑滚动
          }}
        >
          <div className="bg-white text-[#07c160] shadow-md rounded-full p-2 border border-[#07c160]/20 flex items-center justify-center hover:bg-green-50 transition-colors active:scale-90">
            <ChevronDown className="w-6 h-6" />
          </div>
        </div>
      )}

      {/* 底部输入框或多选操作栏 */}
      {isSelectionMode ? (
        <div className="h-16 bg-white border-t flex items-center justify-around px-4 z-50 shadow-up shrink-0">
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
            if (isSticky.current) {
              setTimeout(() => scrollToBottom("smooth"), 300);
            }
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
