import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      messages = [],
      contactInfo = {}, // 前端传来的联系人信息，包含 timeAwareness 和 timezone
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

    // --- 🔥🔥🔥 新增：时间感知逻辑开始 🔥🔥🔥 ---
    let timeContextString = "";

    // 检查前端是否开启了“时间感知”开关 (timeAwareness)
    if (contactInfo.timeAwareness) {
      const now = new Date();
      // 使用 Intl.DateTimeFormat 获取包含日期、星期、时间的详细字符串
      const detailedTime = now.toLocaleString("zh-CN", {
        timeZone: contactInfo.timezone || "Asia/Shanghai", // 使用设置的时区，默认上海
        year: "numeric",
        month: "long", // x月
        day: "numeric", // x日
        weekday: "long", // 星期x
        hour: "2-digit",
        minute: "2-digit",
        hour12: false, // 24小时制
      });

      // 生成提示词片段
      timeContextString = `Real-World Time: ${detailedTime}\n[System Note: You have "Time Awareness". Please adjust your greeting, tone, or topic based on the specific time and day above (e.g., say "Good morning/night", comment on it being Monday/Friday, etc.).]`;

      console.log(`[Time Awareness] 注入时间: ${detailedTime}`);
    } else {
      // 如果没开启，保留一个基础的简单时间，或者留空
      const simpleTime = new Date().toLocaleTimeString("zh-CN", {
        hour12: false,
      });
      timeContextString = `Current Time: ${simpleTime}`;
    }
    // --- 🔥🔥🔥 时间感知逻辑结束 🔥🔥🔥 ---

    // --- 构建 System Prompt ---

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

    // 将 timeContextString 插入到 system_instruction 中
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
[SYSTEM NOTE: The following text describes your WRITING STYLE and FORMATTING RULES. It is NOT part of the character's fictional history.]

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
If you think the user needs to study, work, or focus (e.g., they say "I need to work", "go away I'm busy", or you want to encourage them to start working), you MUST append a special code at the end of your response.
Format: :::FOCUS_INVITE|duration|break|cycles|TaskName:::
- duration: work time in minutes (e.g., 25)
- break: break time in minutes (e.g., 5)
- cycles: number of cycles (e.g., 4)
- TaskName: short description (e.g., Reading, Coding, Homework)

Example:
User: "我得去写作业了。"
You: "好的，加油哦！等你写完我们再聊。||:::FOCUS_INVITE|25|5|4|写作业:::"
</special_functions>

<trigger_instruction>
`;

    // (E) 追加触发器指令 (保持不变)
    if (triggerType === "active_idle") {
      systemPrompt += `
[Instruction]: 用户很久没说话了。请回顾历史记录：
- 如果话题未结束，请继续。
- 如果已结束，请根据人设开启新话题。
- 语气自然，严禁使用换行符，用 "||" 分隔多句话。
`;
    } else if (triggerType === "active_batch") {
      systemPrompt += `[Instruction]: 这是连续发送的追加消息。不要重复上一句意思。严禁换行，用 "||" 分隔。`;
    } else if (triggerType === "active_schedule") {
      systemPrompt += `[Instruction]: 这是定时问候。请结合当前时间发送。严禁换行，用 "||" 分隔。`;
    } else {
      systemPrompt += `[Instruction]: 回复用户。严禁换行，务必用 "||" 符号将你的回复切分为多条短消息。`;
    }

    systemPrompt += `\n</trigger_instruction>`;

    // 3. 清洗历史消息 (保持不变)
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

    // 4. 调用 API (保持不变)
    const baseUrl = proxyUrl.endsWith("/v1") ? proxyUrl : `${proxyUrl}/v1`;
    const fetchUrl = `${baseUrl}/chat/completions`;

    console.log(
      `[API] 发送请求: ${triggerType}, 历史消息数: ${validMessages.length}, 模型: ${model}`
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
        messages: [{ role: "system", content: systemPrompt }, ...validMessages],
        temperature: 0.9,
        presence_penalty: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API Error] OpenAI 返回错误:", errorText);
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
