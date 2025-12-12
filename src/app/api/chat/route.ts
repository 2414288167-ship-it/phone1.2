import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. 解构参数，新增了 dynamicContext 用来接收前端计算好的动态信息
    const {
      messages = [],
      contactInfo = {},
      config = {},
      triggerType = "reply",
      dynamicContext = {}, // 🔥 新增：接收天气、表情包、世界书等动态文本
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

    // --- 2. 构建 System Prompt (核心修复部分) ---

    // (A) 提取基础信息
    const aiName = contactInfo.aiName || contactInfo.name || "AI";
    const userNickname = contactInfo.myNickname || "User";
    const currentTime = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
    });

    // (B) 提取新字段 (我们在 ChatListPage 里加的那些)
    // 如果没有 description，就回退使用 old persona
    const charIdentity =
      contactInfo.description ||
      contactInfo.aiPersona ||
      contactInfo.intro ||
      "暂无设定";
    const charStyle = contactInfo.stylePreset || "";
    const charExamples = contactInfo.exampleDialogue || "";

    // (C) 提取动态环境 (来自前端 AIContext)
    const {
      weatherInfo = "",
      worldBookContent = "",
      stickerPrompt = "",
      currentStyle = "",
    } = dynamicContext;

    // (D) 🔥🔥🔥 核心：分层构建 System Prompt 🔥🔥🔥
    // 使用 XML 标签隔离语义，防止 AI 混淆“我是谁”和“我该怎么说话”
    let systemPrompt = `
<system_instruction>
You are a roleplay engine. Do not act as an AI assistant.
Current Time: ${currentTime}
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

<trigger_instruction>
`;

    // (E) 追加触发器指令
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

    // 3. 清洗历史消息
    const validMessages = Array.isArray(messages)
      ? messages
          .slice(-30) // 稍微增加上下文长度
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

    // 4. 调用 API
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
        // 这里把精心构建的 systemPrompt 放在最前面
        messages: [{ role: "system", content: systemPrompt }, ...validMessages],
        temperature: 0.9, // 稍微提高一点创造力
        presence_penalty: 0.4, // 增加话题丰富度
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
