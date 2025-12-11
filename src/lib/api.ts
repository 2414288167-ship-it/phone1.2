// API 请求工具函数
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export const sendChatMessage = async (
  messages: ChatMessage[]
): Promise<Response> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response;
};

export const readStreamResponse = async (
  response: Response,
  onChunk?: (chunk: string) => void
): Promise<string> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  let result = "";
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      result += chunk;
      onChunk?.(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  return result;
};
