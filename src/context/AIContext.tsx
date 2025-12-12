"use client";
import { useUnread } from "./UnreadContext";
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";

interface AIContextType {
  requestAIReply: (
    conversationId: string,
    contactInfo: any,
    currentMessages: any[]
  ) => void;
  triggerActiveMessage: (
    conversationId: string,
    contactInfo: any,
    type: string
  ) => void;
  getChatState: (
    conversationId: string
  ) => "idle" | "waiting" | "thinking" | "typing";
  regenerateChat: (
    conversationId: string,
    targetMessageId: string,
    contactInfo: any
  ) => void;

  totalAiBubbles: number;
}

const AIContext = createContext<AIContextType | null>(null);

const fetchWeatherText = async (location: string): Promise<string> => {
  if (!location) return "";
  try {
    const params = `?location=${encodeURIComponent(location)}`;
    const res = await fetch(`/api/weather${params}`);
    if (res.ok) {
      const data = await res.json();
      return data.text || "";
    }
  } catch (e) {
    console.warn("[AIContext] 天气服务暂不可用");
  }
  return "";
};

// 夜间模式判断
const isNightMode = (now: Date, startStr: string, endStr: string) => {
  if (!startStr || !endStr) return false;
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startStr.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const [eh, em] = endStr.split(":").map(Number);
  const endMins = eh * 60 + em;

  if (startMins > endMins) {
    return currentMins >= startMins || currentMins < endMins;
  } else {
    return currentMins >= startMins && currentMins < endMins;
  }
};

const getStickerPrompt = () => {
  if (typeof window === "undefined") return "";
  try {
    const saved = localStorage.getItem("custom_stickers");
    const safeBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    let stickers: any[] = [];
    if (saved) {
      stickers = JSON.parse(saved);
    } else {
      stickers = [{ desc: "发呆", url: safeBase64 }];
    }

    if (stickers.length === 0) return "";

    const stickerListStr = stickers
      .map((s) => `• 当你想表达【${s.desc}】时，必须输出：![sticker](${s.url})`)
      .join("\n");

    return `
【💥 强制表情包指令 💥】
你拥有以下表情包库存。为了模仿真实人类，你必须中高频率使用它们！
规则：平均每 5 句话中，至少要有 1 句包含表情包图片。

⚠️⚠️⚠️ 绝对重要规则：
1. **只能**使用下方列表中明确提供的 URL。
2. **严禁**捏造 URL。
3. **严禁**使用 files.catbox.moe 或 postimg.cc 的链接，除非它们出现在下表中。
4. 必须完全照抄 URL（通常是很长的 data:image... 字符串），不要截断。

### 🖼️【表情包发送协议 (最高优先级)】
你无法生成图片，也无法看到图片。你只能通过**“检索数据库”**来发送预设的图片。

**严禁行为：**
❌ 严禁使用文字描述画面（如：*发送了一张开心的图片*、[图片]、(jpg) 等）。
❌ 严禁捏造 URL。必须完全匹配下方列表。

**执行规则：**
1. 分析你当前的回复情绪。
2. 在下方的【表情包数据库】中查找是否有匹配的关键词。
3. **如果找到：** 直接复制对应的 Markdown 代码插入到回复中。
4. **如果没找到：** 就不要发送图片！绝对不要自己编！

你的表情包库存：
${stickerListStr}

【使用格式】：
请直接在回复文本中插入 Markdown 图片代码：
![alt text](URL)
`;
  } catch (e) {
    return "";
  }
};

const getWorldBookContent = (categoryId: string | number): string => {
  if (!categoryId || categoryId === "default") return "";
  try {
    const wbDataStr = localStorage.getItem("worldbook_data");
    if (!wbDataStr) return "";
    const wbData = JSON.parse(wbDataStr);
    if (!wbData.categories) return "";

    const category = wbData.categories.find(
      (cat: any) => String(cat.id) === String(categoryId)
    );

    if (!category || !category.entries) return "";

    const activeEntries = category.entries.filter(
      (e: any) => e.enabled !== false
    );
    if (activeEntries.length === 0) return "";

    const contentParts = activeEntries.map((e: any) => {
      const keys = e.keys ? `[触发词: ${e.keys.join(", ")}]` : "";
      return `${keys}\n${e.content}`;
    });

    return `【重要世界观与角色设定 (最高优先级)】\n${contentParts.join(
      "\n\n"
    )}`;
  } catch (e) {
    console.error("[AIContext] 读取世界书失败", e);
    return "";
  }
};

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { incrementUnread } = useUnread();
  const [chatStates, setChatStates] = useState<
    Record<string, "idle" | "waiting" | "thinking" | "typing">
  >({});

  const [totalAiBubbles, setTotalAiBubbles] = useState(0);

  const processingChats = useRef<Set<string>>(new Set());
  const batchState = useRef<{
    [key: string]: { remaining: number; minInt: number; maxInt: number };
  }>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedCount = localStorage.getItem("total_ai_bubbles");
      if (savedCount) setTotalAiBubbles(Number(savedCount));
      processingChats.current.clear();
    }
  }, []);

  useEffect(() => {
    if (totalAiBubbles > 0) {
      localStorage.setItem("total_ai_bubbles", String(totalAiBubbles));
    }
  }, [totalAiBubbles]);

  const updateChatState = (
    id: string,
    state: "idle" | "waiting" | "thinking" | "typing"
  ) => {
    setChatStates((prev) => ({ ...prev, [id]: state }));
  };

  const performAIRequest = async (
    conversationId: string,
    contactInfo: any,
    triggerType:
      | "reply"
      | "active_idle"
      | "active_schedule"
      | "active_batch"
      | "continue",
    existingMessages: any[] = []
  ) => {
    const chatId = String(conversationId);

    if (processingChats.current.has(chatId)) {
      console.log(`[AI核心] ⚠️ ID: ${chatId} 正在处理中，跳过本次请求`);
      return;
    }

    processingChats.current.add(chatId);
    updateChatState(chatId, "thinking");

    try {
      console.log(`[AI核心] 🚀 ID: ${chatId}, 触发类型: ${triggerType}`);
      const localKey = `chat_${chatId}`;
      let currentMessages = existingMessages;
      if (currentMessages.length === 0) {
        const savedStr = localStorage.getItem(localKey);
        currentMessages = savedStr ? JSON.parse(savedStr) : [];
      }

      if (triggerType === "reply") {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (!lastMsg || lastMsg.role !== "user") {
          processingChats.current.delete(chatId);
          updateChatState(chatId, "idle");
          return;
        }
      }

      const userApiKey = localStorage.getItem("ai_api_key")?.trim();
      let userProxyUrl = localStorage.getItem("ai_proxy_url")?.trim();
      const model = localStorage.getItem("ai_model")?.trim() || "gpt-3.5-turbo";

      if (!userApiKey) {
        console.error("API Key 未设置");
        throw new Error("API Key Missing");
      }

      // --- 构建动态上下文 ---
      let weatherInfo = "";
      if (contactInfo.weatherSync && contactInfo.location) {
        const w = await fetchWeatherText(contactInfo.location);
        if (w) weatherInfo = `(当前你所在地的天气：${w})`;
      }

      let worldBookContent = "";
      if (contactInfo.worldBookId) {
        // 注意：ChatPage里存的是 worldBookId
        worldBookContent = getWorldBookContent(contactInfo.worldBookId);
      }
      // 兼容旧字段
      if (!worldBookContent && contactInfo.worldBook) {
        worldBookContent = getWorldBookContent(contactInfo.worldBook);
      }

      if (contactInfo.customWorldBook) {
        worldBookContent += `\n${contactInfo.customWorldBook}`;
      }

      const stickerPrompt = getStickerPrompt();

      const styleOptions = [
        "回复稍微短促一点。",
        "先发一个短句表达情绪。",
        "情绪稍微激动一点。",
        "言简意赅，适当用Emoji。",
        "语气慵懒随意。",
      ];
      let currentStyle =
        triggerType === "reply"
          ? styleOptions[Math.floor(Math.random() * styleOptions.length)]
          : "【模式：主动发起话题】你感觉有点无聊，或者突然想起一件事情，于是主动给对方发消息。不要太生硬，要自然。";

      if (triggerType === "active_schedule") {
        currentStyle =
          "【模式：定时提醒/问候】根据当前时间，自然地发起问候或提醒。";
      }
      if (triggerType === "continue") currentStyle = "【模式：继续说】";

      // --- 构建 API 消息数组 (仅历史记录) ---
      const apiMessages = currentMessages.map((m: any) => {
        let cleanContent = m.content;
        const isSticker = m.type === "sticker";
        if (isSticker) {
          const explicitMeaning = m.alt || m.meaning || m.description || m.text;
          cleanContent = explicitMeaning
            ? `【用户发了表情包：“${explicitMeaning}”】\n(请回复一个表情包)`
            : `(用户发了表情包，请回复一个表情包)`;
        } else if (m.type === "image") {
          cleanContent = "(用户发了一张图片)";
        }
        return { role: m.role, content: cleanContent };
      });

      // 🔥🔥🔥 核心修改：不在这里拼接 system prompt，而是传数据给后端 🔥🔥🔥
      const finalTemp = Number(localStorage.getItem("ai_temperature")) || 0.7;
      const finalPenalty =
        Number(localStorage.getItem("ai_presence_penalty")) || 0.0;

      const fetchUrl = "/api/chat";
      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: apiMessages, // 只传历史消息，system prompt 交给后端组装
          contactInfo, // 包含 description, stylePreset 等
          triggerType,
          // 传递动态环境数据
          dynamicContext: {
            weatherInfo,
            worldBookContent,
            stickerPrompt,
            currentStyle,
          },
          config: {
            apiKey: userApiKey,
            proxyUrl: userProxyUrl,
            model: model,
            temperature: finalTemp,
            presence_penalty: finalPenalty,
          },
        }),
      });

      if (!response.ok) throw new Error(response.statusText);
      updateChatState(chatId, "typing");

      if (!response.body) throw new Error("Response body is null");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            try {
              const dataStr = trimmed.slice(6);
              const json = JSON.parse(dataStr);
              const content =
                json.choices?.[0]?.delta?.content ||
                json.choices?.[0]?.text ||
                "";

              if (content) {
                fullContent += content;
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      if (fullContent) {
        // 🔥🔥🔥 第二步：解析暗号 & 生成专注卡片 (新增逻辑) 🔥🔥🔥
        let processedContent = fullContent;
        let extraCardMsg: any = null;

        // 正则匹配：:::FOCUS_INVITE|25|5|4|Task:::
        const inviteRegex = /:::FOCUS_INVITE\|(\d+)\|(\d+)\|(\d+)\|(.*?):::/;
        const match = fullContent.match(inviteRegex);

        if (match) {
          // 1. 从文本中移除暗号
          processedContent = fullContent.replace(match[0], "").trim();

          // 2. 提取参数
          const [_, duration, breakTime, cycles, taskName] = match;

          // 3. 构建卡片消息对象
          extraCardMsg = {
            id: (Date.now() + 999).toString(), // 确保ID唯一
            role: "assistant",
            type: "focus_invite", // 关键类型
            content: "邀请专注", // 兼容旧版显示的文本
            timestamp: new Date(Date.now() + 600), // 稍微晚一点的时间戳
            status: "sent",
            extra: {
              duration: Number(duration),
              breakTime: Number(breakTime),
              cycles: Number(cycles),
              taskName: taskName,
            },
          };
          console.log("[AIContext] 解析到专注邀请:", extraCardMsg);
        }

        // 处理图片链接 (原逻辑)
        const rawUrlRegex =
          /(?<!\]\()(https?:\/\/[^\s]+\.(?:jpeg|jpg|gif|png|webp))/gi;
        processedContent = processedContent.replace(
          rawUrlRegex,
          "\n![image]($1)\n"
        );

        const imgRegex = /(!?\[.*?\]\(.*?\))/g;
        processedContent = processedContent.replace(imgRegex, "\n$1\n");
        // 处理分隔符
        processedContent = processedContent.replace(/\|\|/g, "\n");
        processedContent = processedContent.replace(/\|SPLIT/g, "");

        const parts = processedContent
          .split(/\n+/)
          .map((s) => s.trim())
          .map((s) => s.replace(/^\|+/, "").trim())
          .filter((s) => s && s !== "|");

        const bubbleCount = parts.length;
        setTotalAiBubbles((prev) => prev + bubbleCount);

        const finalMsgs = parts.map((part, i) => ({
          id: (Date.now() + i + 10).toString(),
          role: "assistant",
          content: part,
          timestamp: new Date(Date.now() + i * 500),
        }));

        // 🔥 如果有专注卡片，追加到最后
        if (extraCardMsg) {
          finalMsgs.push(extraCardMsg);
        }

        const latestStored = localStorage.getItem(localKey);
        const baseMsgs = latestStored ? JSON.parse(latestStored) : [];
        const finalToSave = [...baseMsgs, ...finalMsgs];

        localStorage.setItem(localKey, JSON.stringify(finalToSave));
        window.dispatchEvent(
          new CustomEvent("chat_updated", {
            detail: { conversationId: chatId },
          })
        );

        incrementUnread(chatId, parts[parts.length - 1], parts.length);

        localStorage.removeItem(`ai_target_time_${chatId}`);

        if (triggerType === "active_idle" && contactInfo.batchEnabled) {
          const min = Number(contactInfo.batchMinCount) || 2;
          const max = Number(contactInfo.batchMaxCount) || 4;
          const count = Math.floor(Math.random() * (max - min + 1)) + min - 1;
          if (count > 0) {
            batchState.current[chatId] = {
              remaining: count,
              minInt: Number(contactInfo.batchIntervalMin) || 5,
              maxInt: Number(contactInfo.batchIntervalMax) || 15,
            };

            const state = batchState.current[chatId];
            const delay =
              Math.floor(Math.random() * (state.maxInt - state.minInt + 1)) +
              state.minInt;
            setTimeout(() => {
              performAIRequest(chatId, contactInfo, "active_batch");
            }, delay * 1000);
          }
        }
      }
    } catch (e: any) {
      console.error("[AI核心] ❌ 请求失败:", e);
      const localKey = `chat_${chatId}`;
      const savedStr = localStorage.getItem(localKey);
      const msgs = savedStr ? JSON.parse(savedStr) : [];
      const errorMsg = {
        id: Date.now().toString(),
        role: "assistant",
        content: `(系统: AI连接失败 - ${e.message})`,
        timestamp: new Date(),
        status: "error",
      };
      localStorage.setItem(localKey, JSON.stringify([...msgs, errorMsg]));
      window.dispatchEvent(
        new CustomEvent("chat_updated", { detail: { conversationId: chatId } })
      );
    } finally {
      processingChats.current.delete(chatId);
      updateChatState(chatId, "idle");
    }
  };

  const regenerateChat = useCallback(
    (chatId: string, targetMsgId: string, contactInfo: any) => {
      const localKey = `chat_${chatId}`;
      const savedStr = localStorage.getItem(localKey);
      if (!savedStr) return;
      const messages = JSON.parse(savedStr);
      const targetIndex = messages.findIndex((m: any) => m.id === targetMsgId);
      if (targetIndex === -1) return;

      let userMsgIndex = -1;
      for (let i = targetIndex; i >= 0; i--) {
        if (messages[i].role === "user") {
          userMsgIndex = i;
          break;
        }
      }

      let newHistory =
        userMsgIndex === -1
          ? messages.slice(0, targetIndex)
          : messages.slice(0, userMsgIndex + 1);

      localStorage.setItem(localKey, JSON.stringify(newHistory));
      window.dispatchEvent(
        new CustomEvent("chat_updated", { detail: { conversationId: chatId } })
      );
      performAIRequest(chatId, contactInfo, "reply", newHistory);
    },
    []
  );

  useEffect(() => {
    const intervalId = setInterval(() => {
      const contactsStr = localStorage.getItem("contacts");
      if (!contactsStr) return;
      const contacts = JSON.parse(contactsStr);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      contacts.forEach((contact: any) => {
        const chatId = String(contact.id);

        if (contact.schedules && Array.isArray(contact.schedules)) {
          contact.schedules.forEach((t: any) => {
            if (!t.enabled) return;
            const key = `ai_sched_${chatId}_${t.id}_${
              now.toISOString().split("T")[0]
            }`;

            if (t.time === timeStr && !localStorage.getItem(key)) {
              if (processingChats.current.has(chatId)) {
                return;
              }
              localStorage.setItem(key, "true");
              performAIRequest(chatId, contact, "active_schedule");
            }
          });
        }

        if (!contact.bgActivity) return;

        const idleMin = Number(contact.idleMin) || 30;
        const idleMax = Number(contact.idleMax) || 120;

        if (
          contact.dndEnabled &&
          isNightMode(now, contact.dndStart, contact.dndEnd)
        ) {
          return;
        }

        let target = localStorage.getItem(`ai_target_time_${chatId}`);

        if (!target) {
          const randomMinutes =
            Math.floor(Math.random() * (idleMax - idleMin + 1)) + idleMin;
          const nextTime = Date.now() + randomMinutes * 60000;
          localStorage.setItem(`ai_target_time_${chatId}`, String(nextTime));
        } else {
          if (Number(target) <= Date.now()) {
            if (processingChats.current.has(chatId)) {
              return;
            }
            localStorage.removeItem(`ai_target_time_${chatId}`);
            performAIRequest(chatId, contact, "active_idle");
          }
        }
      });
    }, 5000);

    return () => clearInterval(intervalId);
  }, [incrementUnread]);

  return (
    <AIContext.Provider
      value={{
        requestAIReply: (id, info, msgs) => {
          localStorage.removeItem(`ai_target_time_${id}`);
          performAIRequest(id, info, "reply", msgs);
        },
        triggerActiveMessage: (id, info, type) =>
          performAIRequest(id, info, type as any),
        getChatState: (id) => chatStates[id] || "idle",
        regenerateChat,
        totalAiBubbles,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) throw new Error("useAI error");
  return context;
};
