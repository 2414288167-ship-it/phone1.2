import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // 1. 检查 API Key 是否配置
  const API_KEY = process.env.DEEPGRAM_API_KEY;

  if (!API_KEY) {
    return NextResponse.json(
      { error: "Deepgram API Key 未配置" },
      { status: 500 }
    );
  }

  try {
    // 2. 从请求中获取录音文件
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "未接收到音频文件" }, { status: 400 });
    }

    // 3. 将文件转发给 Deepgram
    // model=nova-2: Deepgram 最快最准的模型
    // language=zh: 强制识别中文
    // smart_format=true: 自动加标点符号
    const deepgramUrl =
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=zh";

    const response = await fetch(deepgramUrl, {
      method: "POST",
      headers: {
        Authorization: `Token ${API_KEY}`,
        "Content-Type": file.type || "audio/webm", // 保持原始音频格式
      },
      body: file, // 直接把文件流传过去
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Deepgram Error:", errorText);
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const data = await response.json();

    // 4. 提取转写结果
    const transcript =
      data.results?.channels[0]?.alternatives[0]?.transcript || "";

    // 5. 返回给前端
    return NextResponse.json({ text: transcript });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: error.message || "转写服务出错" },
      { status: 500 }
    );
  }
}
