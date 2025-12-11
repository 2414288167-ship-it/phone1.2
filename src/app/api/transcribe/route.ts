import { NextResponse } from "next/server";
import { createClient } from "@deepgram/sdk";

export async function POST(req: Request) {
  try {
    // 1. 获取上传的音频文件
    const formData = await req.formData();
    const file = formData.get("file") as Blob;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 2. 将 Blob 转为 Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 3. 初始化 Deepgram
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

    // 4. 发送给 Deepgram 进行转录
    // model: 'nova-2' 是目前最快最准的
    // language: 'zh' 中文, 'en' 英文
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: "nova-2",
        smart_format: true,
        language: "zh",
      }
    );

    if (error) throw error;

    // 5. 返回转录文本
    const transcript = result.results.channels[0].alternatives[0].transcript;
    return NextResponse.json({ text: transcript });
  } catch (error: any) {
    console.error("Deepgram Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
