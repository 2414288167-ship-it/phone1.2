import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // 1. 安全解构，设置默认值
    const {
      messages = [],
      contactInfo = {},
      worldBook = "",
      config = {},
      triggerType = "reply",
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

    // 2. 构建 System Prompt
    // 修复：添加反引号，修正变量插值 ${}，清理重复的文本逻辑使其符合 JS 语法
    let systemPrompt = `你现在进行角色扮演。名字：${
      contactInfo.aiName || "AI"
    }。核心人设：${contactInfo.aiPersona || "无"}。${
      worldBook || ""
    } 当前时间：${new Date().toLocaleTimeString("zh-CN", { hour12: false })};`;

    // 修复：为每个分支的字符串添加反引号或引号，确保语法正确
    if (triggerType === "active_idle") {
      systemPrompt += `
【指令 - 主动发起话题】：
用户很久没说话了。请回顾历史记录：
如果话题未结束，请继续。
如果已结束，请根据人设开启新话题。
语气自然，严禁使用换行符，用 "||" 分隔。`;
    } else if (triggerType === "active_batch") {
      systemPrompt += `【指令】：这是连续发送的追加消息。不要重复上一句。严禁换行。`;
    } else if (triggerType === "active_schedule") {
      systemPrompt += `【指令】：这是定时问候。请结合时间发送。严禁换行。`;
    } else {
      systemPrompt += `【指令】：回复用户。严禁换行，用 "||" 分隔。`;
    }

    // 3. 🔥🔥🔥 核心修复：强力清洗历史消息 🔥🔥🔥
    // 过滤掉内容为空、格式不对的消息，防止 400 错误
    const validMessages = Array.isArray(messages)
      ? messages
          .slice(-20) // 只取最后 20 条
          .filter(
            (m: any) =>
              m &&
              m.role &&
              typeof m.content === "string" &&
              m.content.trim() !== ""
          ) // 过滤坏数据
          .map((m: any) => ({
            role: m.role,
            // 再次确保内容是字符串，防止 'undefined' 进入
            content: String(m.content).substring(0, 2000), // 防止单条消息过长
          }))
      : [];

    // 4. 调用 API
    // 修正 URL 拼接问题，防止出现 /v1/v1/
    // 修复：添加模板字符串的反引号
    const baseUrl = proxyUrl.endsWith("/v1") ? proxyUrl : `${proxyUrl}/v1`;
    const fetchUrl = `${baseUrl}/chat/completions`;

    // 修复：添加模板字符串的反引号
    console.log(
      `[API] 发送请求: ${triggerType}, 历史消息数: ${validMessages.length}`
    );

    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 修复：添加模板字符串的反引号
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...validMessages],
        temperature: 0.85,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API Error] OpenAI 返回错误:", errorText);
      // 把 OpenAI 的错误原样返回给前端，方便调试
      // 修复：对象属性值添加反引号
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
