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
  // ✨ 修改接口定义，支持 extraData
  triggerActiveMessage: (
    conversationId: string,
    contactInfo: any,
    type: string,
    extraData?: any
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

// ✨✨✨ 终极防幻觉 Prompt：电子日程表模式 ✨✨✨
const getTasksContext = () => {
  if (typeof window === "undefined") return "";
  const tasksStr = localStorage.getItem("my_focus_tasks");
  const tasks = tasksStr ? JSON.parse(tasksStr) : [];
  const pending = tasks.filter((t: any) => !t.done);

  // 1. 构建数据部分
  let dataPart = `[CURRENT TIME: ${new Date().toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  })}]\n`;
  if (pending.length > 0) {
    dataPart += `[PENDING TASKS]: ${pending
      .map((t: any) => `${t.text}${t.startTime ? `(${t.startTime})` : ""}`)
      .join(", ")}`;
  } else {
    dataPart += `[PENDING TASKS]: None`;
  }

  // 2. 构建指令部分 (使用特殊标记防止 AI 忽略)
  return `
${dataPart}

<<< SYSTEM_OVERRIDE_INSTRUCTION >>>
You are a "Scheduler Bot" wrapped in a character persona.
IF the user implies a plan/schedule/arrangement:
1. Speak in character briefly (1-2 sentences).
2. MUST APPEND the schedule using this code block:
:::STUDY_PLAN_START:::
- [ ] HH:MM TaskName
- [ ] HH:MM TaskName
:::STUDY_PLAN_END:::
3. DO NOT output the schedule as normal text bubbles.
4. DO NOT split the response into multiple messages. Keep it in ONE message.
`;
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
      | "continue"
      | "task_reminder", // ✨ 新增类型
    existingMessages: any[] = [],
    extraData?: any // ✨ 新增参数
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
        worldBookContent = getWorldBookContent(contactInfo.worldBookId);
      }
      if (!worldBookContent && contactInfo.worldBook) {
        worldBookContent = getWorldBookContent(contactInfo.worldBook);
      }
      if (contactInfo.customWorldBook) {
        worldBookContent += `\n${contactInfo.customWorldBook}`;
      }

      // ✨✨✨ 注入待办事项上下文 ✨✨✨
      let tasksContent = "";
      if (contactInfo.syncTasks) {
        // 只有开启了同步开关才注入
        tasksContent = getTasksContext();
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

      // ✨✨✨ 处理任务催促模式 ✨✨✨
      if (triggerType === "task_reminder") {
        const taskNames = extraData?.taskNames || "某个任务";
        const timeStr = extraData?.time || "";
        currentStyle = `【模式：强制催促】
现在时间是 ${timeStr}。
系统检测到用户尚未开始以下任务：【${taskNames}】。
请根据你的人设（如果是严格角色就严厉，如果是温柔角色就软磨硬泡），主动发消息催促用户去完成任务！
不要只是问候，要直接切入正题。`;
      }

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

      // 🔥🔥🔥 核心修改开始：强制注入 System 指令到队列末尾 🔥🔥🔥
      // 这样 AI 会在生成回复前的最后一刻看到这条指令，权重最高！
      if (contactInfo.syncTasks) {
        const tasksContext = getTasksContext();
        // 只有当用户最后一条消息像是要计划时，才注入强指令，或者始终注入但保持 Token 消耗
        // 这里选择始终注入，保证稳定性
        apiMessages.push({
          role: "system",
          content: tasksContext,
        });
        console.log("[AI核心] 已注入待办事项 System 指令到队尾");
      }
      // 🔥🔥🔥 核心修改结束 🔥🔥🔥

      const finalTemp = Number(localStorage.getItem("ai_temperature")) || 0.7;
      const finalPenalty =
        Number(localStorage.getItem("ai_presence_penalty")) || 0.0;

      console.log("[AIContext] 准备发送请求，TaskSync:", !!tasksContent);

      const fetchUrl = "/api/chat";
      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: apiMessages,
          contactInfo,
          triggerType,
          // 传递动态环境数据
          dynamicContext: {
            weatherInfo,
            worldBookContent,
            stickerPrompt,
            currentStyle,
            tasksContent, // ✨ 传递任务上下文
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
        let processedContent = fullContent;
        const extraMsgs: any[] = [];

        // 1. 解析专注邀请暗号
        const inviteRegex = /:::FOCUS_INVITE\|(\d+)\|(\d+)\|(\d+)\|(.*?):::/;
        const matchInvite = fullContent.match(inviteRegex);
        if (matchInvite) {
          processedContent = processedContent
            .replace(matchInvite[0], "")
            .trim();
          const [_, duration, breakTime, cycles, taskName] = matchInvite;
          extraMsgs.push({
            id: (Date.now() + 999).toString(),
            role: "assistant",
            type: "focus_invite",
            content: "邀请专注",
            timestamp: new Date(Date.now() + 600),
            status: "sent",
            extra: {
              duration: Number(duration),
              breakTime: Number(breakTime),
              cycles: Number(cycles),
              taskName: taskName,
            },
          });
        }

        // ✨ 2. 解析学习计划卡片暗号 (STUDY_PLAN) ✨
        // 格式: :::STUDY_PLAN_START::: ...内容... :::STUDY_PLAN_END:::
        const planRegex =
          /:::STUDY_PLAN_START:::([\s\S]*?):::STUDY_PLAN_END:::/;
        const matchPlan = fullContent.match(planRegex);
        if (matchPlan) {
          // 移除原始文本中的卡片代码块，避免重复显示
          processedContent = processedContent.replace(matchPlan[0], "").trim();
          const planContent = matchPlan[1].trim();

          extraMsgs.push({
            id: (Date.now() + 888).toString(),
            role: "assistant",
            type: "study_card", // 对应 MessageList 里的新类型
            content: planContent, // 原始 Markdown 内容
            timestamp: new Date(Date.now() + 700),
            status: "sent",
          });
          console.log("[AIContext] 解析到学习计划卡片");
        }

        // 处理图片链接
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

        // 追加特殊卡片消息
        if (extraMsgs.length > 0) {
          finalMsgs.push(...extraMsgs);
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
        triggerActiveMessage: (id, info, type, extra) =>
          performAIRequest(id, info, type as any, [], extra), // ✨ 支持传入 extra
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
