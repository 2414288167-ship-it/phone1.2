import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      messages = [],
      contactInfo = {}, // 包含 offlineStyle, novelWordCount 等
      config = {},
      triggerType = "reply",
      dynamicContext = {},
    } = body;

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    const proxyUrl = (
      config.proxyUrl ||
      process.env.OPENAI_BASE_URL ||
      "https://api.openai.com"
    ).replace(/\/+$/, "");
    const model = config.model || "gpt-3.5-turbo";

    if (!apiKey) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 401 });
    }

    // --- 1. 时间感知逻辑 ---
    const enableTimeAwareness = contactInfo.timeAwareness !== false;
    let currentDetailedTime = "";

    if (enableTimeAwareness) {
      const now = new Date();
      currentDetailedTime = now.toLocaleString("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    }

    let timeContextString = "";
    if (currentDetailedTime) {
      timeContextString = `Real-World Time: ${currentDetailedTime}\n[System Note: Strictly follow this time.]`;
    } else {
      const simpleTime = new Date().toLocaleTimeString("zh-CN", {
        hour12: false,
        timeZone: "Asia/Shanghai",
      });
      timeContextString = `Current Time: ${simpleTime}`;
    }

    // --- 2. 模式参数提取 ---
    const enableAsideMode = !!contactInfo.asideMode;
    const enableOnlineMode = !!contactInfo.absoluteOnlineMode;
    // ✨ 线下模式相关参数
    const enableDescMode = !!contactInfo.descMode;
    const offlineStyle = contactInfo.offlineStyle || "normal"; // normal | novel
    const targetWordCount = contactInfo.novelWordCount || 500;

    let styleInstruction = "";

    // 旁白模式逻辑 (优先级最高，控制格式)
    if (enableAsideMode) {
      styleInstruction = `
[SYSTEM FORCE OVERRIDE: IMMERSIVE VISUAL NOVEL MODE]
You are a Novel Writer.
1. **HIGH DENSITY**: Detailed descriptions of expressions/actions.
2. **FORMAT**: ALL actions in **（ parentheses ）**.
3. **NO QUOTES**: Dialogue is PLAIN TEXT.
4. **RATIO**: Narrative > 40%.
`;
    }

    // --- 3. 构建 System Prompt ---

    const aiName = contactInfo.aiName || contactInfo.name || "AI";
    const userNickname = contactInfo.myNickname || "User";
    const charIdentity =
      contactInfo.description ||
      contactInfo.aiPersona ||
      contactInfo.intro ||
      "暂无设定";
    const charStyle = contactInfo.stylePreset || "";
    const charExamples = contactInfo.exampleDialogue || "";

    const {
      weatherInfo = "",
      worldBookContent = "",
      stickerPrompt = "",
      currentStyle = "",
    } = dynamicContext;

    let systemPrompt = `
<system_instruction>
You are a roleplay engine. Do not act as an AI assistant.
${timeContextString}
User's Name: ${userNickname}
${weatherInfo}
</system_instruction>

<world_lore>
${worldBookContent}
</world_lore>

<character_profile>
Name: ${aiName}
Description: 
${charIdentity}
</character_profile>

<acting_guidelines>
1. 必须使用中文回复。
2. ${stickerPrompt ? "Strictly follow the sticker rules below." : ""}
${charStyle}
${currentStyle}
${stickerPrompt}
</acting_guidelines>

<dialogue_examples>
${charExamples}
</dialogue_examples>

<special_functions>
[Special Function: Focus Invitation]
Format: :::FOCUS_INVITE|duration|break|cycles|TaskName:::
</special_functions>

<trigger_instruction>
${styleInstruction}
`;

    if (triggerType === "active_idle") {
      systemPrompt += `[Instruction]: 用户很久没说话了。若话题结束则开启新话题。语气自然。`;
    } else if (triggerType === "active_batch") {
      systemPrompt += `[Instruction]: 这是连续追加消息。不要重复上一句。严禁换行，用 "||" 分隔。`;
    } else if (triggerType === "active_schedule") {
      systemPrompt += `[Instruction]: 这是定时问候。结合当前时间发送。严禁换行，用 "||" 分隔。`;
    } else {
      if (enableAsideMode) {
        systemPrompt += `[Instruction]: 回复用户。请根据"Novel Mode"的规则进行大量描写。务必用 "||" 符号切分消息。`;
      } else {
        systemPrompt += `
[SYSTEM MODE: PURE DIALOGUE]
1. **NO ACTIONS/DESCRIPTIONS**: Do NOT describe any actions/expressions.
2. **NO BRACKETS**: Do NOT use parentheses () or （）.
3. **SPEECH ONLY**: Output ONLY verbal speech.
4. 严禁换行，务必用 "||" 符号将你的回复切分为多条短消息。
`;
      }
    }
    systemPrompt += `\n</trigger_instruction>`;

    // --- 4. 清洗历史消息 ---
    const validMessages = Array.isArray(messages)
      ? messages
          .slice(-30)
          .filter(
            (m: any) =>
              m &&
              m.role &&
              typeof m.content === "string" &&
              m.content.trim() !== ""
          )
          .map((m: any) => ({
            role: m.role,
            content: String(m.content).substring(0, 3000),
          }))
      : [];

    // --- 🔥🔥🔥 5. 构建最终消息数组 (逻辑核心) 🔥🔥🔥 ---
    let finalMessagesToSend = [
      { role: "system", content: systemPrompt },
      ...validMessages,
    ];

    // (A) 时间锚点
    if (enableTimeAwareness && currentDetailedTime) {
      finalMessagesToSend.push({
        role: "system",
        content: `
[SYSTEM: TIME ANCHOR]
Current Real Time: ${currentDetailedTime}
Instruction: Align response (energy, schedule) with this time.
`,
      });
    }

    // (B) 绝对线上模式 (优先级最高，屏蔽物理接触)
    if (enableOnlineMode) {
      finalMessagesToSend.push({
        role: "system",
        content: `
[SYSTEM FORCE OVERRIDE: ABSOLUTE ONLINE MODE]
Current Status: Separated by internet. **Physical interaction IMPOSSIBLE.**
1. **NO PHYSICAL CONTACT**: No hugs, touches, or presence in the same room.
2. **VERBAL ONLY**: Use words to comfort or virtual actions (e.g., "Sending a hug").
`,
      });
    }
    // (C) 线下模式 (只有在未开启绝对线上的情况下生效)
    else if (enableDescMode) {
      // ✨ 情况 1: 小说模式 (酒馆风格)
      if (offlineStyle === "novel") {
        finalMessagesToSend.push({
          role: "system",
          content: `
[SYSTEM FORCE OVERRIDE: OFFLINE REALITY - NOVEL MODE]
**Setting**: You and the user are physically together in the same space.

### 🖋️ WRITING INSTRUCTIONS (TAVERN STYLE):
1. **LENGTH**: You MUST write a long response, approximately **${targetWordCount} words** or more.
2. **IMMERSION**: Focus heavily on sensory details (sight, sound, smell, touch), environmental atmosphere, and internal psychological monologue.
3. **PACING**: Slow down the scene. Don't just say "I cook dinner", describe the chopping sound, the smell of spices, the heat of the stove.
4. **PHYSICALITY**: You can touch, hug, or interact with the user freely.
5. **FORMAT**: Use paragraphs. If "Aside Mode" is off, do not use brackets. If "Aside Mode" is on, wrap actions in brackets.
`,
        });
      }
      // ✨ 情况 2: 普通模式 (普通闲聊)
      else {
        finalMessagesToSend.push({
          role: "system",
          content: `
[SYSTEM: OFFLINE REALITY - NORMAL MODE]
**Setting**: You and the user are physically together.
1. **Physical Presence**: You can perform actions (handing objects, touching) naturally.
2. **Length**: Keep it conversational and natural (short to medium length).
3. **Style**: Casual interaction.
`,
        });
      }
    }

    // (D) 关闭旁白模式清洗
    if (!enableAsideMode) {
      finalMessagesToSend.push({
        role: "system",
        content: `
[SYSTEM UPDATE: INSTANT MESSENGER MODE]
1. IGNORE previous novel style (actions/parentheses).
2. Output **ONLY spoken dialogue**.
3. **FORBIDDEN**: Do not use parentheses （）.
`,
      });
    }
    // ✨ 特殊修正：如果开启了"线下小说模式"但没有开启"旁白模式"，我们需要允许它输出描写，否则会被上面的指令屏蔽
    // 所以这里做一个修正：如果 offlineStyle=novel，我们允许描写，覆盖掉 (D) 的限制
    if (enableDescMode && offlineStyle === "novel" && !enableAsideMode) {
      // 移除最后一条清洗指令 (即上面 push 进去的那条)
      finalMessagesToSend.pop();
      // 插入允许描写的指令
      finalMessagesToSend.push({
        role: "system",
        content: `
[SYSTEM UPDATE: NOVEL PROSE MODE]
1. You are writing a story in prose format.
2. Do NOT use brackets for actions. Write them as normal narration sentences.
3. Mix dialogue and narration naturally.
`,
      });
    }

    // --- 6. 发送请求 ---
    const baseUrl = proxyUrl.endsWith("/v1") ? proxyUrl : `${proxyUrl}/v1`;
    const fetchUrl = `${baseUrl}/chat/completions`;

    console.log(
      `[API] Req | 线下:${enableDescMode}(${offlineStyle}) | 线上:${enableOnlineMode}`
    );

    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        stream: true,
        messages: finalMessagesToSend,
        temperature: offlineStyle === "novel" ? 1.0 : 0.9, // 小说模式增加创造性
        presence_penalty: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `OpenAI Error: ${errorText}` },
        { status: response.status }
      );
    }

    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" },
    });
  } catch (error: any) {
    console.error("[Server Error]", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
