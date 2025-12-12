"use client";
import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
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
  Music,
} from "lucide-react";
import { useAI } from "@/context/AIContext";
import { useUnread } from "@/context/UnreadContext";
import { useMusicPlayer } from "@/context/MusicContext";

// --- 辅助函数：Blob 转 Base64 ---
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// --- 辅助函数：世界书检索 ---
const getWorldBookContext = (
  text: string,
  worldBookId: string | undefined
): string => {
  if (!worldBookId || !text) return "";
  try {
    const wbDataStr = localStorage.getItem("worldbook_data");
    if (!wbDataStr) return "";
    const wbData = JSON.parse(wbDataStr);
    const books = wbData.books.filter(
      (b: any) => String(b.categoryId) === String(worldBookId)
    );
    if (!books || books.length === 0) return "";
    let foundContexts: string[] = [];
    books.forEach((book: any) => {
      const entries = Array.isArray(book.content) ? book.content : [];
      entries.forEach((entry: any) => {
        if (entry.enabled === false) return;
        if (entry.keys && Array.isArray(entry.keys)) {
          const isMatch = entry.keys.some((key: string) =>
            text.toLowerCase().includes(key.toLowerCase())
          );
          if (isMatch) {
            foundContexts.push(entry.content);
          }
        }
      });
    });
    if (foundContexts.length > 0) {
      const uniqueContexts = Array.from(new Set(foundContexts));
      return `\n\n[World Info / Additional Context]:\n${uniqueContexts.join(
        "\n"
      )}\n`;
    }
  } catch (e) {
    console.error("世界书读取失败", e);
  }
  return "";
};

// --- 辅助函数：预设检索 ---
const getPresetContext = (presetId: string | undefined): string => {
  if (!presetId) return "";
  try {
    const presetsStr = localStorage.getItem("app_presets");
    if (!presetsStr) return "";
    const presets = JSON.parse(presetsStr);
    const targetPreset = presets.find((p: any) => p.id === presetId);
    if (!targetPreset || !targetPreset.prompts) return "";
    return targetPreset.prompts
      .filter((p: any) => p.enabled)
      .map((p: any) => p.content)
      .join("\n\n");
  } catch (e) {
    console.error("预设读取失败", e);
    return "";
  }
};

// --- 辅助函数：生理期提示词 ---
const getMenstrualPrompt = (contact: any) => {
  if (!contact?.menstrualData) return "";
  const { lastDate, duration, cycle } = contact.menstrualData;
  if (!lastDate || !cycle) return "";

  const start = new Date(lastDate);
  const today = new Date();
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((today.getTime() - start.getTime()) / oneDay);
  if (diffDays < 0) return "";
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

// --- 辅助函数：记忆注入 ---
const getMemoryPrompt = (contact: any) => {
  const groups = contact.permanentMemory || [];
  if (!Array.isArray(groups) || groups.length === 0) return "";

  let memoryText = "\n\n[Long-term Memory / Important Facts about User]:\n";
  groups.forEach((group: any) => {
    if (!group.items || group.items.length === 0) return;
    memoryText += `\n### ${group.title}:\n`;
    group.items.forEach((item: any) => {
      memoryText += `- ${item.content}\n`;
    });
  });
  memoryText +=
    "\n[Instruction: Keep these memories in mind. If the user mentions related topics, reference these facts naturally.]";
  return memoryText;
};

interface PageProps {
  params: { id: string };
}

export default function ChatPage({ params }: PageProps) {
  const conversationId = params?.id || "";
  // FIX: Added 'aiStatus' which was used but not destructured from the context.
  const { requestAIReply, regenerateChat, triggerActiveMessage, aiStatus } =
    useAI();
  const { clearUnread } = useUnread();
  const {
    currentSong,
    isPlaying,
    isSharedMode,
    startSharedMode,
    stopSharedMode,
  } = useMusicPlayer();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [myAvatar, setMyAvatar] = useState<string>("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLength = useRef(0);
  const isAutoScrolling = useRef(true);
  const prevAiStatus = useRef(aiStatus);

  // --- 核心状态：用户是否正在交互中？ ---
  const isUserInteracting = useMemo(() => {
    return input.length > 0 || isPanelOpen || isRecording;
  }, [input, isPanelOpen, isRecording]);

  // FIX: Implemented the 'reloadMessages' function that was previously missing.
  // Wrapped in useCallback to ensure stability when used as a dependency in useEffect.
  const reloadMessages = useCallback(() => {
    if (conversationId) {
      try {
        const saved = localStorage.getItem(`chat_${conversationId}`);
        if (saved) {
          const parsedMessages = JSON.parse(saved);
          setMessages(parsedMessages);
        } else {
          setMessages([]);
        }
      } catch (e) {
        console.error("Failed to load or parse messages:", e);
        setMessages([]);
      }
    }
  }, [conversationId]);

  // FIX: Merged two separate, redundant useEffect hooks into one for clean initialization.
  useEffect(() => {
    if (conversationId) {
      // Load contact info
      const contacts = JSON.parse(localStorage.getItem("contacts") || "[]");
      const contact = contacts.find((c: any) => c.id === conversationId);
      if (contact) setContactInfo(contact);

      // Load user profile avatar
      const profileStr = localStorage.getItem("user_profile_v4");
      if (profileStr) {
        try {
          const profile = JSON.parse(profileStr);
          setMyAvatar(profile.avatar || "");
        } catch (e) {
          console.error("Failed to parse user profile", e);
        }
      }

      // Load chat background
      const savedBg = localStorage.getItem(`chat_bg_${conversationId}`);
      if (savedBg) setBgImage(savedBg);

      // Load messages and clear unread count
      reloadMessages();
      clearUnread(conversationId);
    }
  }, [conversationId, reloadMessages, clearUnread]);

  // 消息持久化
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      localStorage.setItem(`chat_${conversationId}`, JSON.stringify(messages));
    }
  }, [messages, conversationId]);

  // 监听 chat_updated 事件 (来自其他页面的更新)
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
  }, [conversationId, reloadMessages, clearUnread]);

  // 主动轮询消息 (当AI正在活动时)
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (aiStatus === "thinking" || aiStatus === "typing") {
      intervalId = setInterval(() => {
        reloadMessages();
      }, 500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [aiStatus, reloadMessages]);

  // 状态结束时强制刷新，确保获取最新消息
  useEffect(() => {
    if (prevAiStatus.current !== "idle" && aiStatus === "idle") {
      setTimeout(reloadMessages, 200);
    }
    prevAiStatus.current = aiStatus;
  }, [aiStatus, reloadMessages]);

  // 智能滚动
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    isAutoScrolling.current = scrollHeight - scrollTop - clientHeight < 100;
  };

  useLayoutEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "user" || isAutoScrolling.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // --- AI 回复触发器 ---
  const triggerAI = useCallback(
    (currentMessages: Message[]) => {
      if (!conversationId || !contactInfo) return;
      console.log("🚀 倒计时结束，触发 AI 回复！");

      const lastUserMsg = [...currentMessages]
        .reverse()
        .find((m) => m.role === "user" && m.type !== "music_invite");

      const textContext = lastUserMsg?.content || "";

      // 组合所有上下文和提示词
      const presetContext = getPresetContext(contactInfo.presetId);
      const worldBookContext = getWorldBookContext(
        textContext,
        contactInfo.worldBookId
      );
      // FIX: Called the previously unused helper functions to include their context.
      const menstrualPrompt = getMenstrualPrompt(contactInfo);
      const memoryPrompt = getMemoryPrompt(contactInfo);

      let musicPrompt = "";
      if (currentSong) {
        const songInfo = `"${currentSong.title}" by ${currentSong.artist}`;
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (lastMsg.type === "music_invite") {
          musicPrompt = `\n[SYSTEM EVENT: MUSIC INVITATION]\nThe user sent a "Share Headphones" invitation card for the song: ${songInfo}.\n- Be yourself.\n- If you like the song or want to join, just say yes/okay/good naturally.\n- If you don't want to, refuse politely.`;
        } else if (isSharedMode) {
          musicPrompt = `\n[STATE: Shared Listening active] Playing: ${songInfo}. You are listening TOGETHER.`;
        } else if (isPlaying) {
          musicPrompt = `\n[STATE: User listening to ${songInfo} in bg]`;
        }
      }

      let additionalPrompt = [
        presetContext,
        worldBookContext,
        memoryPrompt,
        menstrualPrompt,
        musicPrompt,
      ]
        .filter(Boolean)
        .join("\n\n");

      const enhancedContactInfo = {
        ...contactInfo,
        aiPersona: (contactInfo.aiPersona || "") + "\n" + additionalPrompt,
      };
      requestAIReply(conversationId, enhancedContactInfo, currentMessages);
    },
    [
      conversationId,
      contactInfo,
      currentSong,
      isPlaying,
      isSharedMode,
      requestAIReply,
    ]
  );

  // --- 智能计时器 ---
  useEffect(() => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

    if (isUserInteracting) {
      console.log("⏳ 用户正在交互 (打字/选图/录音)，计时暂停...");
      return;
    }

    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === "user" && lastMsg.status === "sent") {
      const isInvite = lastMsg.type === "music_invite";
      const delay = isInvite ? 1000 : 4000;

      console.log(`⏱️ 用户停止交互，开始倒计时 ${delay}ms ...`);
      replyTimerRef.current = setTimeout(() => {
        triggerAI(messages);
      }, delay);
    }
  }, [messages, isUserInteracting, triggerAI]);

  // --- 音乐共听检测 ---
  useEffect(() => {
    if (messages.length === 0 || isSharedMode) return;

    let inviteIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === "music_invite") {
        // 如果邀请已经被处理过，就停止寻找
        if (messages[i].extra?.accepted || messages[i].extra?.rejected) break;
        inviteIndex = i;
        break;
      }
    }

    if (inviteIndex !== -1) {
      const followingMessages = messages.slice(inviteIndex + 1);
      const aiResponses = followingMessages.filter(
        (m) => m.role === "assistant"
      );

      if (aiResponses.length > 0) {
        const contentCombined = aiResponses
          .map((m) => m.content)
          .join(" ")
          .toLowerCase();

        const agreeKeywords = [
          "好",
          "嗯",
          "行",
          "来",
          "听",
          "ok",
          "yes",
          "sure",
          "可以",
          "没问题",
          "这就戴",
          "分我一半",
          "耳机",
          "接受",
          "播放",
          "音响",
          "蓝牙",
          "放吧",
          "想听",
        ];
        const rejectKeywords = [
          "不",
          "改天",
          "忙",
          "下次",
          "no",
          "sorry",
          "不要",
          "不想",
        ];

        const isAgreed = agreeKeywords.some((kw) =>
          contentCombined.includes(kw)
        );
        const isRejected = rejectKeywords.some((kw) =>
          contentCombined.includes(kw)
        );

        if (isAgreed && !isRejected) {
          console.log("🎵 检测到 AI 同意邀请！");
          startSharedMode();
          if (contactInfo?.avatar) {
            localStorage.setItem("shared_partner_avatar", contactInfo.avatar);
          }

          setTimeout(() => {
            setMessages((prev) => {
              const newMsgs = [...prev];
              // 标记邀请已被接受
              const targetMsg = newMsgs[inviteIndex];
              if (targetMsg) {
                newMsgs[inviteIndex] = {
                  ...targetMsg,
                  extra: { ...targetMsg.extra, accepted: true },
                };
              }

              // 添加系统消息
              const sysMsg: Message = {
                id: "sys_" + Date.now(),
                role: "system",
                type: "system_notice",
                content: `${
                  contactInfo?.name || "对方"
                } 已接受邀请，进入共听模式`,
                timestamp: new Date(),
              };
              newMsgs.push(sysMsg);

              localStorage.setItem(
                `chat_${conversationId}`,
                JSON.stringify(newMsgs)
              );
              return newMsgs;
            });
          }, 600);
        } else if (isRejected) {
          // (可选) 处理拒绝逻辑
        }
      }
    }
  }, [messages, isSharedMode, startSharedMode, conversationId, contactInfo]);

  // --- 消息发送处理 ---
  const handleUserSend = (
    text: string,
    type: "text" | "audio" | "image" | "sticker" | "music_invite" = "text",
    duration?: number,
    audioUrl?: string,
    tempId?: string,
    imageDesc?: string,
    inviteCard?: boolean
  ) => {
    if (type === "text" && !text?.trim() && !inviteCard) return;

    // 更新UI和本地存储
    setMessages((prev) => {
      let newMessages = [...prev];
      if (tempId) {
        // This is an update to an existing (e.g., audio) message
        newMessages = newMessages.map((msg) =>
          msg.id === tempId
            ? { ...msg, content: text, status: "sent" as const }
            : msg
        );
      } else {
        // This is a new message
        const finalType = imageDesc
          ? "sticker"
          : inviteCard
          ? "music_invite"
          : (type as any);
        const contentText =
          text ||
          (inviteCard
            ? `(发送了音乐邀请卡片) 正在听：${currentSong?.title || "歌曲"}`
            : "");
        const userMessage: Message = {
          id: tempId || Date.now().toString(),
          role: "user",
          content: contentText,
          timestamp: new Date(),
          type: finalType,
          duration: duration,
          audioUrl: audioUrl,
          status: type === "audio" && !text ? "sending" : "sent",
          alt: inviteCard ? currentSong?.cover : imageDesc,
          extra: inviteCard
            ? { songTitle: currentSong?.title || "未知歌曲" }
            : undefined,
        };
        newMessages.push(userMessage);
      }
      localStorage.setItem(
        `chat_${conversationId}`,
        JSON.stringify(newMessages)
      );
      return newMessages;
    });

    if (type === "text" && !inviteCard) setInput("");
    // FIX: Removed the redundant and conflicting setTimeout logic from here.
    // The main useEffect hook listening to `messages` changes will now handle triggering the AI reply,
    // which centralizes the logic and prevents race conditions.
  };

  const enterSelectionMode = (initialMsgId?: string) => {
    setIsSelectionMode(true);
    setSelectedIds(initialMsgId ? new Set([initialMsgId]) : new Set());
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

  const handleSaveToMemory = () => {
    if (selectedIds.size === 0 || !conversationId) return;
    const selectedMsgs = messages.filter((m) => selectedIds.has(m.id));

    try {
      const contactsStr = localStorage.getItem("contacts");
      if (!contactsStr) return;
      const contacts = JSON.parse(contactsStr);

      const updatedContacts = contacts.map((c: any) => {
        if (String(c.id) !== String(conversationId)) return c;

        let permanentMemory = c.permanentMemory || [];
        if (
          !Array.isArray(permanentMemory) ||
          permanentMemory.length === 0 ||
          !permanentMemory[0].items
        ) {
          permanentMemory = [
            { id: "default_group", title: "未分类收藏", items: [] },
          ];
        }

        const newMemories = selectedMsgs.map((msg) => ({
          id: msg.id,
          content: msg.content,
          date: new Date().toISOString(),
          source: "chat_selection",
        }));

        const targetGroup = permanentMemory[0];
        const contentSet = new Set(
          targetGroup.items.map((item: any) => item.content)
        );
        const uniqueNewMemories = newMemories.filter(
          (mem) => !contentSet.has(mem.content)
        );
        targetGroup.items.push(...uniqueNewMemories);

        return { ...c, permanentMemory };
      });

      localStorage.setItem("contacts", JSON.stringify(updatedContacts));
      window.dispatchEvent(
        new CustomEvent("contact_updated", {
          detail: { contactId: conversationId },
        })
      );
      alert(`已保存 ${uniqueNewMemories.length} 条新记忆`);
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
      localStorage.setItem(
        `chat_${conversationId}`,
        JSON.stringify(newMessages)
      );
      exitSelectionMode();
    }
  };

  const handleDeleteMessage = (id: string) => {
    setMessages((prev) => {
      const newMsgs = prev.filter((m) => m.id !== id);
      localStorage.setItem(`chat_${conversationId}`, JSON.stringify(newMsgs));
      return newMsgs;
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
    if (msg.role === "user" && msg.type === "text") {
      setInput(msg.content);
      handleDeleteMessage(msg.id);
    }
  };

  const getHeaderStatus = () => {
    if (aiStatus === "thinking") return "对方正在思考...";
    if (aiStatus === "typing") return "对方正在输入...";
    return contactInfo?.name || "AI角色";
  };

  const safeContactInfo = contactInfo || { name: "AI", avatar: "" };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900">
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-200 bg-white/90 backdrop-blur-sm shrink-0 z-10 relative">
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="-ml-2 p-2 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          {safeContactInfo.avatar && (
            <div className="relative w-9 h-9 shrink-0">
              <img
                src={safeContactInfo.avatar}
                className="w-full h-full rounded-full object-cover border border-gray-200"
                alt={safeContactInfo.name}
              />
              {aiStatus === "idle" && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
              )}
            </div>
          )}
          <div className="font-semibold text-base leading-tight">
            {getHeaderStatus()}
          </div>
        </div>
        <Link
          href={`/chat/${conversationId}/info`}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <Menu className="w-5 h-5" />
        </Link>
      </header>

      {/* 状态条 */}
      {isSharedMode && isPlaying && currentSong && (
        <div className="relative z-10 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 px-4 py-2 flex items-center gap-2 justify-center backdrop-blur-md border-b border-pink-100/30 shadow-sm animate-in slide-in-from-top duration-300">
          <div className="relative flex shrink-0">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-pink-400 animate-ping"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500"></span>
          </div>
          <Music className="w-3 h-3 text-pink-500" />
          <span className="text-[10px] text-gray-700 font-medium truncate max-w-[180px]">
            与 {safeContactInfo.name} 共听《{currentSong.title}》
          </span>
          <button
            onClick={stopSharedMode}
            className="ml-2 text-[10px] bg-white/50 px-2 py-0.5 rounded-full text-gray-500 hover:text-red-500"
          >
            退出
          </button>
        </div>
      )}

      {!isSharedMode && isPlaying && currentSong && (
        <div className="relative z-10 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 px-4 py-2 flex items-center justify-between backdrop-blur-md border-b border-blue-100/30 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 min-w-0">
            <Music className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-gray-500 truncate">
              后台播放: {currentSong.title}
            </span>
          </div>
          <button
            onClick={() =>
              handleUserSend(
                "邀请你一起听歌",
                "text",
                undefined,
                undefined,
                undefined,
                undefined,
                true
              )
            }
            className="shrink-0 text-[10px] bg-blue-500 text-white px-3 py-1 rounded-full shadow-sm hover:bg-blue-600 active:scale-95 transition"
          >
            分享耳机
          </button>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
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

      {!isSelectionMode ? (
        <InputArea
          input={input}
          isLoading={aiStatus === "thinking" || aiStatus === "typing"}
          onInputChange={setInput}
          onSendText={() => handleUserSend(input, "text")}
          onPanelChange={(isOpen) => {
            setIsPanelOpen(isOpen);
            if (!isOpen) {
              setTimeout(
                () =>
                  messagesEndRef.current?.scrollIntoView({
                    behavior: "smooth",
                  }),
                300
              );
            }
          }}
          onRecordingStateChange={setIsRecording} // FIX: Update recording state
          onSendAudio={async (text, duration, audioBlob, imageDesc) => {
            if (imageDesc) {
              handleUserSend(text, "image", 0, undefined, undefined, imageDesc);
              return;
            }
            const tempId = Date.now().toString();
            let audioDataUrl = audioBlob
              ? await blobToBase64(audioBlob)
              : undefined;

            // Immediately show the 'sending' audio message
            handleUserSend("", "audio", duration, audioDataUrl, tempId);

            if (audioBlob) {
              const formData = new FormData();
              formData.append("file", audioBlob);
              try {
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
                  throw new Error("Server response not OK");
                }
              } catch (error) {
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
      ) : (
        <div className="h-16 bg-white border-t flex items-center justify-around px-4 z-50 shadow-up">
          <button
            onClick={handleSaveToMemory}
            className="flex flex-col items-center gap-1 text-gray-600 active:text-green-600"
          >
            <BookMarked className="w-5 h-5" />
            <span className="text-[10px]">存记忆</span>
          </button>
          <button
            onClick={handleBatchDelete}
            className="flex flex-col items-center gap-1 text-red-500"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[10px]">删除</span>
          </button>
          <button
            onClick={exitSelectionMode}
            className="flex flex-col items-center gap-1"
          >
            <X className="w-6 h-6 text-gray-500" />
            <span className="text-[10px] text-gray-500">取消</span>
          </button>
        </div>
      )}
    </div>
  );
}
