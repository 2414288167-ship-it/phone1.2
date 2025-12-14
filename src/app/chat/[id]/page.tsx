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
  ChevronDown,
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

// --- 辅助函数：记忆注入 ---
const getMemoryPrompt = (contact: any) => {
  const groups = contact.permanentMemory || [];
  if (!Array.isArray(groups) || groups.length === 0) return "";

  let memoryText = "\n\n[Long-term Memory / Important Facts about User]:\n";
  groups.forEach((group: any) => {
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

interface PageProps {
  params: { id: string };
}

export default function ChatPage({ params }: PageProps) {
  const conversationId = params?.id || "";

  const { requestAIReply, getChatState, triggerActiveMessage, regenerateChat } =
    useAI();
  const { clearUnread } = useUnread();

  // 获取音乐全局状态
  const {
    currentSong,
    isPlaying,
    isSharedMode,
    startSharedMode,
    stopSharedMode,
  } = useMusicPlayer();

  // --- 本地状态 ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [contactInfo, setContactInfo] = useState<any>(null);
  const [myAvatar, setMyAvatar] = useState<string>("");

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 🔥 新增：是否正在录音 (用于判断交互状态)
  const [isRecording, setIsRecording] = useState(false);

  // --- 🔥🔥🔥 滚动控制核心 Ref 🔥🔥🔥 ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLength = useRef(0);

  // isSticky: 标记"当前是否应该跟随到底部"。默认 true (跟随)
  const isSticky = useRef(true);
  // isUserInteracting: 标记"用户正在操作"。如果为 true，强行暂停自动滚动
  const isUserInteracting = useRef(false);
  // 交互锁定时器
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 是否显示回到底部按钮
  const [showScrollButton, setShowScrollButton] = useState(false);

  // 获取 AI 状态
  const aiStatus = conversationId ? getChatState(conversationId) : "idle";

  // --- 1. 加载数据 ---
  const reloadMessages = useCallback(() => {
    if (!conversationId) return;
    const savedMsgs = localStorage.getItem(`chat_${conversationId}`);
    if (savedMsgs) {
      try {
        setMessages(JSON.parse(savedMsgs));
      } catch (e) {
        console.error("解析消息失败", e);
      }
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      const saved = localStorage.getItem(`chat_${conversationId}`);
      if (saved) setMessages(JSON.parse(saved));

      const contacts = JSON.parse(localStorage.getItem("contacts") || "[]");
      const contact = contacts.find((c: any) => c.id === conversationId);
      if (contact) setContactInfo(contact);

      const profile = JSON.parse(
        localStorage.getItem("user_profile_v4") || "{}"
      );
      setMyAvatar(profile.avatar || "");

      const savedBg = localStorage.getItem(`chat_bg_${conversationId}`);
      if (savedBg) setBgImage(savedBg);

      clearUnread(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (conversationId && typeof window !== "undefined") {
      // 加载联系人
      const contactsStr = localStorage.getItem("contacts");
      if (contactsStr) {
        const contacts = JSON.parse(contactsStr);
        const currentContact = contacts.find(
          (c: any) => String(c.id) === String(conversationId)
        );
        if (currentContact) {
          const menstrualPrompt = getMenstrualPrompt(currentContact);
          const memoryPrompt = getMemoryPrompt(currentContact);
          const prefPrompt = currentContact.userPreferences
            ? `\n\n[User Preferences/Dislikes]:\n${currentContact.userPreferences}`
            : "";

          setContactInfo({
            ...currentContact,
            name: currentContact.remark || currentContact.name,
            aiName: currentContact.aiName || currentContact.name,
            aiPersona:
              (currentContact.aiPersona || "") +
              prefPrompt +
              memoryPrompt +
              menstrualPrompt,
            myNickname: "我",
          });
        }
      }

      // 加载用户头像
      const userProfileStr = localStorage.getItem("user_profile_v4");
      if (userProfileStr) {
        try {
          const profile = JSON.parse(userProfileStr);
          setMyAvatar(profile.avatar || "");
        } catch (e) {}
      }

      // 加载背景
      const savedBg = localStorage.getItem(`chat_bg_${conversationId}`);
      if (savedBg) setBgImage(savedBg);

      reloadMessages();
      clearUnread(conversationId);
    }
  }, [conversationId, reloadMessages, clearUnread]);

  // 🔥🔥🔥 核心修复 1：主动轮询消息 🔥🔥🔥
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (aiStatus === "thinking" || aiStatus === "typing") {
      intervalId = setInterval(() => {
        reloadMessages();
      }, 500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [aiStatus, reloadMessages]);

  // 🔥🔥🔥 核心修复 2：状态结束兜底 🔥🔥🔥
  const prevAiStatus = useRef(aiStatus);
  useEffect(() => {
    if (prevAiStatus.current !== "idle" && aiStatus === "idle") {
      setTimeout(() => {
        reloadMessages();
      }, 200);
    }
    prevAiStatus.current = aiStatus;
  }, [aiStatus, reloadMessages]);

  // 监听 chat_updated 事件
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

  // 初始化加载
  useEffect(() => {
    if (conversationId) {
      const saved = localStorage.getItem(`chat_${conversationId}`);
      if (saved) setMessages(JSON.parse(saved));

      const contacts = JSON.parse(localStorage.getItem("contacts") || "[]");
      const contact = contacts.find((c: any) => c.id === conversationId);
      if (contact) setContactInfo(contact);

      const profile = JSON.parse(
        localStorage.getItem("user_profile_v4") || "{}"
      );
      setMyAvatar(profile.avatar || "");

      const savedBg = localStorage.getItem(`chat_bg_${conversationId}`);
      if (savedBg) setBgImage(savedBg);

      clearUnread(conversationId);
    }
  }, [conversationId]);

  // 消息持久化
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      localStorage.setItem(`chat_${conversationId}`, JSON.stringify(messages));
    }
  }, [messages, conversationId]);

  // --- 🔥🔥🔥 核心修复：滚动逻辑全重写 (防失效版) 🔥🔥🔥 ---

  // 1. 滚动到底部 (执行者) - 引入 requestAnimationFrame
  const scrollToBottom = (behavior: "smooth" | "auto" = "auto") => {
    // 使用 requestAnimationFrame 确保在浏览器重绘之前执行，解决偶发失效
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const { scrollHeight, clientHeight } = scrollContainerRef.current;
        const maxScrollTop = scrollHeight - clientHeight;

        scrollContainerRef.current.scrollTo({
          top: maxScrollTop > 0 ? maxScrollTop : 0,
          behavior: behavior,
        });

        // 只要触发了强制到底，就恢复锁定 (除非用户正在按着屏幕)
        if (!isUserInteracting.current) {
          isSticky.current = true;
          setShowScrollButton(false);
        }
      }
    });
  };

  // 2. 监听用户交互 (防抖)
  const handleUserInteraction = () => {
    isUserInteracting.current = true;
    isSticky.current = false; // 用户操作时，立刻解除吸附

    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    // 1秒后如果没有后续操作，认为交互结束 (解除锁，但 sticky 需要手动滚回底部才恢复)
    interactionTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false;
    }, 1000);
  };

  // 3. 滚动位置监听 (计算是否应该吸附) - 增加容错
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    // 使用 Math.abs 并允许一定误差，防止高分屏小数问题
    const distance = Math.abs(scrollHeight - scrollTop - clientHeight);

    // 阈值：50px (增加容错，手指抖动不容易误触)
    if (distance > 50) {
      isSticky.current = false;
      setShowScrollButton(true);
    } else {
      isSticky.current = true;
      setShowScrollButton(false);
    }
  };

  // 4. 🔥 引入 ResizeObserver：监听内容高度变化 (如 AI 打字、图片加载)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      // 只有当：1. 处于吸附模式 AND 2. 用户没有按住屏幕
      if (isSticky.current && !isUserInteracting.current && !isSelectionMode) {
        scrollToBottom("auto"); // 使用 auto 防止抖动
      }
    });

    // 监听第一个子元素（通常是 MessageList 的 wrapper），这样能准确捕捉内容变化
    if (container.firstElementChild) {
      observer.observe(container.firstElementChild);
    } else {
      observer.observe(container);
    }

    return () => observer.disconnect();
  }, [isSelectionMode]);

  // 5. 监听窗口大小变化 (处理软键盘弹出)
  useEffect(() => {
    const handleResize = () => {
      if (isSticky.current && !isUserInteracting.current) {
        scrollToBottom("auto");
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 6. 响应消息数据变化 (作为 ResizeObserver 的双重保险)
  useEffect(() => {
    if (isSticky.current && !isUserInteracting.current && !isSelectionMode) {
      scrollToBottom("auto");
    }
  }, [messages, aiStatus, currentSong]);

  // (首次加载时保留原有行为)
  useLayoutEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      if (isSticky.current && !isUserInteracting.current) {
        scrollToBottom("auto");
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages]);

  // --- 🔥🔥🔥 智能计时器逻辑 🔥🔥🔥 ---
  useEffect(() => {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

    if (input.length > 0 || isPanelOpen || isRecording) {
      console.log("⏳ 用户正在交互 (打字/选图/录音)，计时暂停...");
      return;
    }

    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === "user" && lastMsg.status === "sent") {
      const isInvite = lastMsg.type === "music_invite";
      const isFocusShare = lastMsg.type === "focus_share";
      const delay = isInvite || isFocusShare ? 1000 : 4000;

      console.log(`⏱️ 用户停止交互，开始倒计时 ${delay}ms ...`);

      replyTimerRef.current = setTimeout(() => {
        triggerAI(messages);
      }, delay);
    }
  }, [messages, input, isPanelOpen, isRecording]);

  // 触发 AI
  const triggerAI = (currentMessages: Message[]) => {
    if (!conversationId || !contactInfo) return;
    console.log("🚀 倒计时结束，触发 AI 回复！");

    const lastUserMsg = [...currentMessages]
      .reverse()
      .find((m) => m.role === "user" && m.type !== "music_invite");
    const textContext = lastUserMsg?.content || "";
    const worldBookContext = getWorldBookContext(
      textContext,
      contactInfo.worldBookId
    );
    const presetContext = getPresetContext(contactInfo.presetId);

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

    let focusPrompt = "";
    const lastMsg = currentMessages[currentMessages.length - 1];
    if (lastMsg.type === "focus_share") {
      focusPrompt = `\n[SYSTEM EVENT: FOCUS SUMMARY SHARE]\nThe user has just completed a focus/study session and shared the summary card.\n- Total duration: ${lastMsg.extra?.totalSeconds} seconds.\n- Task description: ${lastMsg.extra?.taskName}.\n- INSTRUCTION: Praise the user warmly and encourage them. You can ask what they learned or suggest a break. Be proud of them.`;
    }

    let additionalPrompt = "";
    if (presetContext) additionalPrompt += `\n${presetContext}`;
    if (worldBookContext) additionalPrompt += worldBookContext;
    if (musicPrompt) additionalPrompt += musicPrompt;
    if (focusPrompt) additionalPrompt += focusPrompt;

    const enhancedContactInfo = {
      ...contactInfo,
      aiPersona: (contactInfo.aiPersona || "") + additionalPrompt,
    };
    requestAIReply(conversationId, enhancedContactInfo, currentMessages);
  };

  // --- 4. 音乐共听检测 ---
  useEffect(() => {
    if (messages.length === 0) return;

    if (!isSharedMode) {
      let inviteIndex = -1;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "music_invite") {
          if (messages[i].extra?.accepted) break;
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
                const lastMsg = prev[prev.length - 1];
                if (lastMsg.type === "system_notice") return prev;

                const newMsgs = [...prev];
                const targetIndex = newMsgs.findIndex(
                  (m) => m.timestamp === messages[inviteIndex].timestamp
                );
                if (targetIndex !== -1) {
                  newMsgs[targetIndex] = {
                    ...newMsgs[targetIndex],
                    extra: { ...newMsgs[targetIndex].extra, accepted: true },
                  };
                }

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

                // 手动保存
                localStorage.setItem(
                  `chat_${conversationId}`,
                  JSON.stringify(newMsgs)
                );
                return newMsgs;
              });
            }, 600);
          }
        }
      }
    }
  }, [messages, isSharedMode]);

  // --- 5. 功能函数区 ---

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
              { id: "default_group", title: "默认分组", items: existingData },
            ];
          } else if (existingData.length === 0) {
            existingData = [
              { id: "default_group", title: "未分类收藏", items: [] },
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

          return { ...c, permanentMemory: existingData };
        }
        return c;
      });

      localStorage.setItem("contacts", JSON.stringify(updatedContacts));
      window.dispatchEvent(
        new CustomEvent("chat_updated", { detail: { conversationId } })
      );

      alert(`已保存 ${selectedMsgs.length} 条记忆`);
      exitSelectionMode();
    } catch (e) {
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
      // @ts-ignore
      triggerActiveMessage(conversationId, contactInfo, "continue");
    }
  };

  const handleEditMessage = (msg: Message) => {
    if (msg.role === "user" && msg.type === "text") {
      setInput(msg.content);
      handleDeleteMessage(msg.id);
    }
  };

  // 🔥 升级版 handleUserSend
  const handleUserSend = (
    text: string,
    type: string = "text",
    duration?: number,
    audioUrl?: string,
    tempId?: string,
    imageDesc?: string,
    inviteCard?: boolean,
    extraData?: any
  ) => {
    if (type === "text" && !text?.trim() && !inviteCard) return;

    // 1. 更新 UI 和本地存储
    setMessages((prev) => {
      let newMessages = [...prev];
      if (tempId) {
        newMessages = newMessages.map((msg) =>
          msg.id === tempId
            ? { ...msg, content: text, status: "sent" as const }
            : msg
        );
      } else {
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
        const status = type === "audio" && !text ? "sending" : "sent";

        newMessages.push({
          id: Date.now().toString(),
          role: "user",
          content: contentText,
          timestamp: new Date(),
          type: finalType,
          duration,
          audioUrl,
          status,
          alt: inviteCard ? currentSong?.cover : imageDesc,
          extra: inviteCard ? { songTitle: currentSong?.title } : extraData,
        });
      }
      return newMessages;
    });
    if (type === "text" && !inviteCard) setInput("");
    if (type === "audio" && !text) setIsRecording(true);
    if (type === "audio" && text) setIsRecording(false);

    // 🔥 用户发送时，强制锁定并滚动
    isSticky.current = true;
    isUserInteracting.current = false;
    setTimeout(() => scrollToBottom("smooth"), 100);

    // 2. 触发 AI 防抖逻辑
    const isReadyToSendToAI = !(type === "audio" && !text);

    if (isReadyToSendToAI || inviteCard) {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

      const delay = inviteCard || type === "focus_share" ? 1000 : 4000;

      replyTimerRef.current = setTimeout(() => {
        setMessages((currentMsgs) => {
          if (conversationId && contactInfo) {
            triggerAI(currentMsgs);
          }
          return currentMsgs;
        });
      }, delay);
    }
  };

  // 延迟发送 pending_share_message
  useEffect(() => {
    const timer = setTimeout(() => {
      const pendingShare = localStorage.getItem("pending_share_message");
      if (pendingShare && conversationId) {
        try {
          const data = JSON.parse(pendingShare);
          handleUserSend(
            "我刚刚完成了一次专注学习！",
            "focus_share",
            undefined,
            undefined,
            undefined,
            undefined,
            false,
            {
              totalSeconds: data.totalSeconds,
              taskName: data.taskName,
            }
          );
          localStorage.removeItem("pending_share_message");
          console.log("✅ 专注分享卡片已发送");
        } catch (e) {
          console.error("解析专注分享数据失败", e);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [conversationId]);

  const getHeaderStatus = () => {
    if (aiStatus === "thinking") return "对方正在输入...";
    if (aiStatus === "typing") return "对方正在输入...";
    return contactInfo?.name || "AI角色";
  };
  const safeContactInfo = contactInfo || { name: "AI", avatar: "🐱" };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 relative">
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

      {/* 
          🔥 滚动容器：绑定交互事件 🔥
          onWheel, onTouchMove, onTouchStart -> 识别用户意图
      */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onWheel={handleUserInteraction} // 鼠标滚轮 -> 判定为交互
        onTouchMove={handleUserInteraction} // 手指滑动 -> 判定为交互
        onTouchStart={handleUserInteraction} // 手指按下 -> 立即判定为交互
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

      {/* ✨ 悬浮按钮：回到底部 (当用户查看历史时显示) ✨ */}
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

      {!isSelectionMode ? (
        <InputArea
          input={input}
          isLoading={aiStatus === "thinking" || aiStatus === "typing"}
          onInputChange={setInput}
          onSendText={() => handleUserSend(input, "text")}
          onPanelChange={(isOpen) => {
            setIsPanelOpen(isOpen);
            // 面板打开时，如果原本在底部，则适应性滚动
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
