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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevMessagesLength = useRef(0);
  const isAutoScrolling = useRef(true); // 是否允许自动滚动
  const isUserInteracting = useMemo(() => {
    return input.length > 0 || isPanelOpen || isRecording;
  }, [input, isPanelOpen, isRecording]);
  // 获取 AI 状态
  const aiStatus = conversationId ? getChatState(conversationId) : "idle";

  // --- 1. 加载数据 (使用 useCallback 保证引用稳定) ---
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
  // 解决 AI 发消息不刷新的问题。当 AI 处于思考或打字状态时，每 0.5 秒同步一次 LocalStorage
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
  // 确保 AI 回复完成瞬间（从 busy 变 idle），强制再刷新一次，防止漏掉最后的内容
  const prevAiStatus = useRef(aiStatus);
  useEffect(() => {
    if (prevAiStatus.current !== "idle" && aiStatus === "idle") {
      // 延时一点点确保 storage 写入完毕
      setTimeout(() => {
        reloadMessages();
      }, 200);
    }
    prevAiStatus.current = aiStatus;
  }, [aiStatus, reloadMessages]);

  // 监听 chat_updated 事件来更新消息 (作为辅助触发)
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

  // --- 3. 智能滚动逻辑 ---
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isAutoScrolling.current = distanceToBottom < 100;
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

  // --- 🔥🔥🔥 核心逻辑：智能计时器 🔥🔥🔥 ---
  useEffect(() => {
    // 1. 任何状态变化，先把旧计时器清了 (暂停)
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

    // 2. 如果用户正在交互，绝对不触发，直接返回 (等用户忙完)
    if (isUserInteracting) {
      console.log("⏳ 用户正在交互 (打字/选图/录音)，计时暂停...");
      return;
    }

    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    // 3. 只有当“最后一条是用户发的” 且 “状态是 sent” 时，才开始倒计时
    if (lastMsg.role === "user" && lastMsg.status === "sent") {
      const isInvite = lastMsg.type === "music_invite";
      const delay = isInvite ? 1000 : 4000;

      console.log(`⏱️ 用户停止交互，开始倒计时 ${delay}ms ...`);

      replyTimerRef.current = setTimeout(() => {
        triggerAI(messages);
      }, delay);
    }
  }, [messages, isUserInteracting]); // 🔥 依赖：消息变了 OR 交互状态变了

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

    let additionalPrompt = "";
    if (presetContext) additionalPrompt += `\n${presetContext}`;
    if (worldBookContext) additionalPrompt += worldBookContext;
    if (musicPrompt) additionalPrompt += musicPrompt;

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

  // 发送消息 (纯净版，不负责倒计时)
  const handleUserSend = (
    text: string,
    type: string = "text",
    duration?: number,
    audioUrl?: string,
    tempId?: string,
    imageDesc?: string,
    inviteCard?: boolean
  ) => {
    if (type === "text" && !text?.trim() && !inviteCard) return;

    // 1. 更新 UI 和本地存储 (立即上屏 + 保存)
    setMessages((prev) => {
      let newMessages = [...prev];
      if (tempId) {
        // 语音识别完成，更新状态为 sent -> 此时 useEffect 会检测到变化 -> 如果没有其他交互，4秒后触发 AI
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
        // 如果是语音还没转完文字，状态是 sending -> 此时 useEffect 会忽略它，不会计时
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
          extra: inviteCard ? { songTitle: currentSong?.title } : undefined,
        });
      }
      return newMessages;
    });
    if (type === "text" && !inviteCard) setInput("");
    // 如果是开始录音，标记交互状态
    if (type === "audio" && !text) setIsRecording(true);
    // 如果是录音完成(有text)，取消标记
    if (type === "audio" && text) setIsRecording(false);

    // 2. 触发 AI 防抖逻辑
    const isReadyToSendToAI = !(type === "audio" && !text);

    if (isReadyToSendToAI || inviteCard) {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);

      const delay = inviteCard ? 1000 : 4000;

      replyTimerRef.current = setTimeout(() => {
        setMessages((currentMsgs) => {
          if (conversationId && contactInfo) {
            const lastUserMsg = [...currentMsgs]
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

              if (inviteCard) {
                musicPrompt = `\n[SYSTEM EVENT: MUSIC INVITATION]\nThe user sent a "Share Headphones" invitation card for the song: ${songInfo}.\n- Be yourself.\n- If you like the song or want to join, just say yes/okay/good naturally.\n- If you don't want to, refuse politely.`;
              } else if (isSharedMode) {
                musicPrompt = `\n[STATE: Shared Listening active] Playing: ${songInfo}. You are listening TOGETHER.`;
              } else if (isPlaying) {
                musicPrompt = `\n[STATE: User listening to ${songInfo} in bg]`;
              }
            }

            let additionalPrompt = "";
            if (presetContext) additionalPrompt += `\n${presetContext}`;
            if (worldBookContext) additionalPrompt += worldBookContext;
            if (musicPrompt) additionalPrompt += musicPrompt;

            const enhancedContactInfo = {
              ...contactInfo,
              aiPersona: (contactInfo.aiPersona || "") + additionalPrompt,
            };

            console.log("🚀 触发 AI 回复...");
            // 发送请求给 AI
            requestAIReply(conversationId, enhancedContactInfo, currentMsgs);
          }
          return currentMsgs;
        });
      }, delay);
    }
  };

  const getHeaderStatus = () => {
    if (aiStatus === "thinking") return "对方正在输入...";
    if (aiStatus === "typing") return "对方正在输入...";
    return contactInfo?.name || "AI角色";
  };
  const safeContactInfo = contactInfo || { name: "AI", avatar: "🐱" };

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
