"use client";
import React, { useState } from "react";
import { Send } from "lucide-react";

interface NarratorInputProps {
  isLoading?: boolean;
  onSend: (text: string) => void;
}

export default function NarratorInput({
  isLoading = false,
  onSend,
}: NarratorInputProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim() && !isLoading) {
      onSend(text.trim());
      setText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 按下 Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-3 shadow-up z-20">
      <div className="flex items-start gap-3 bg-gray-100 border border-gray-200 rounded-xl p-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入旁白、动作或场景描述..."
          className="flex-1 bg-transparent outline-none resize-none text-base text-gray-800 placeholder-gray-400 min-h-[40px] max-h-32 pt-2 px-2"
          rows={1} // 高度会自动增长
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !text.trim()}
          className="mt-1 w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-full transition-opacity duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:bg-green-600 shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
