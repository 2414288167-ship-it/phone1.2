// components/NarratorInput.tsx 或直接放在 ChatPage.tsx 底部

import { Send, X, Feather } from "lucide-react";
import { useState } from "react";

interface NarratorInputProps {
  onSend: (text: string) => void;
  onClose: () => void;
}

export const NarratorInput = ({ onSend, onClose }: NarratorInputProps) => {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim()) return;
    // 发送时，建议自动包裹括号，或者保持原样由用户输入
    // 这里演示保持原样，或者你可以改成 `(${text})`
    onSend(text);
    setText("");
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      {/* 毛玻璃背景容器 */}
      <div className="bg-white/30 backdrop-blur-md border border-white/40 shadow-xl rounded-2xl overflow-hidden flex flex-col p-4 relative">
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-2 text-gray-700/80">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Feather className="w-4 h-4" />
            <span>旁白/剧情描写</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 输入区域 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="在此描写动作、环境或心理活动... (AI将根据此内容续写)"
          className="w-full h-24 bg-transparent border-none outline-none resize-none text-gray-800 placeholder-gray-500/70 text-sm leading-relaxed"
          autoFocus
        />

        {/* 发送按钮 */}
        <div className="flex justify-end mt-2">
          <button
            onClick={handleSend}
            className="flex items-center gap-1 bg-[#07c160]/90 hover:bg-[#07c160] text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-sm transition-all active:scale-95"
          >
            <Send className="w-3 h-3" />
            写入剧情
          </button>
        </div>
      </div>
    </div>
  );
};
