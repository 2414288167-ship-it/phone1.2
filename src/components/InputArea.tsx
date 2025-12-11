"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  Keyboard,
  Smile,
  Plus,
  Mic,
  Heart,
  Search,
  Settings,
  CheckCircle2,
  Circle,
  ImagePlus,
  X,
  GripHorizontal,
  Delete,
  FolderInput,
  Layers,
  UploadCloud, // 新图标
} from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

// ================= 常量定义 =================
const EMOJI_LIST = [
  "😀",
  "😁",
  "😂",
  "🤣",
  "😃",
  "😄",
  "😅",
  "😆",
  "😉",
  "😊",
  "😋",
  "😎",
  "😍",
  "😘",
  "🥰",
  "😗",
  "😙",
  "😚",
  "🙂",
  "🤗",
  "🤩",
  "🤔",
  "🤨",
  "😐",
  "😑",
  "😶",
  "🙄",
  "😏",
  "😣",
  "😥",
  "😮",
  "🤐",
  "😯",
  "😪",
  "😫",
  "😴",
  "😌",
  "😛",
  "😜",
  "😝",
  "🤤",
  "😒",
  "😓",
  "😔",
  "😕",
  "🙃",
  "🤑",
  "😲",
  "☹️",
  "🙁",
  "😖",
  "😞",
  "😟",
  "😤",
  "😢",
  "😭",
  "🙏",
  "🤝",
  "👍",
  "👎",
  "✌️",
  "👌",
  "🐮",
  "🍺",
  "🌹",
  "💔",
  "💩",
  "👻",
  "🎉",
  "🎁",
  "红包",
];

interface CustomSticker {
  id: string;
  url: string;
  desc: string;
  category?: string;
}

const DEFAULT_STICKERS: CustomSticker[] = [
  {
    id: "s1",
    // Base64 示例
    url: "data:image/gif;base64,R0lGODlhZABkAIQAAP///+7u7t3d3czMzbu7u6qqqmZmZjMzMwAAAP///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJBwAAACwAAAAAZABkAAAF/yAkjmRpnmiqrmzrvnAsz3Rt33iu73zv/8CgcEgsGo/IpHLJbDqf0Kh0Sq1ar9isdsvter/gsHhMLpvP6LR6zW673/C4fE6v2+/4vH7P7/v/gIGCg4SFhoeIiYqLjI2Oj5CRkpOUlZaXmJmam5ydnp+goaKjpKWmp6ipqqusra6vsLGys7S1tre4ubq7vL2+v8DBwsPExcbHyMnKy8zNzs/Q0dLT1NXW19jZ2tvc3d7f4OHi4+Tl5ufo6err7O3u7/Dx8vP09fb3+Pn6+/z9/v8AAwocSLCgwYMIEypcyLChw4cQI0qcSLGixYsYM2rcyLGjx48gQ4ocSbKkyZMoU/6aXMmypcuXMGPKnEmzps2bOHPq3Mmzp8+fQIMKHUq0qNGjSJMqXcq0qdOnUKNKnUq1qtWrWLNq3cq1q9evYMOKHUu2rNmzZgEBADs=",
    desc: "加载中...",
    category: "默认",
  },
];

interface InputAreaProps {
  input: string;
  isLoading: boolean;
  onInputChange: (val: string) => void;
  onSendText: () => void;
  onSendAudio: (
    text: string,
    duration: number,
    blob: Blob | null,
    imageDesc?: string
  ) => void;
  onPanelChange?: (isOpen: boolean) => void;
}

export function InputArea({
  input,
  isLoading,
  onInputChange,
  onSendText,
  onSendAudio,
  onPanelChange,
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startY = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null); // 🔥 新增：文件选择引用

  const [activePanel, setActivePanel] = useState<"none" | "emoji" | "plus">(
    "none"
  );
  const [emojiTab, setEmojiTab] = useState<"emoji" | "favorite">("emoji");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [recordState, setRecordState] = useState<
    "idle" | "recording" | "cancel"
  >("idle");

  const [stickers, setStickers] = useState<CustomSticker[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStickers, setSelectedStickers] = useState<string[]>([]);

  const [currentCategory, setCurrentCategory] = useState<string>("全部");
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetCategoryInput, setTargetCategoryInput] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<"single" | "batch">("single");
  const [newStickerUrl, setNewStickerUrl] = useState("");
  const [newStickerDesc, setNewStickerDesc] = useState("");
  const [batchText, setBatchText] = useState("");

  const { startListening, stopListening, abortListening } =
    useSpeechRecognition((text, duration, audioBlob) => {
      onSendAudio(text || "", duration, audioBlob);
    });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("custom_stickers");
      if (saved) {
        let parsed = JSON.parse(saved);
        parsed = parsed.map((s: any) => ({
          ...s,
          category: s.category || "默认",
        }));
        setStickers(parsed);
      } else {
        setStickers(DEFAULT_STICKERS);
      }
    }
  }, []);

  useEffect(() => {
    if (onPanelChange) {
      onPanelChange(activePanel !== "none");
    }
  }, [activePanel, onPanelChange]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 100) + "px";
    }
  }, [input]);

  const categories = useMemo(() => {
    const cats = new Set(stickers.map((s) => s.category || "默认"));
    return ["全部", ...Array.from(cats)];
  }, [stickers]);

  const filteredStickers = useMemo(() => {
    if (currentCategory === "全部") return stickers;
    return stickers.filter((s) => s.category === currentCategory);
  }, [stickers, currentCategory]);

  const handleInputFocus = () => setActivePanel("none");

  const toggleEmojiPanel = () => {
    if (activePanel === "emoji") {
      setActivePanel("none");
      setTimeout(() => textareaRef.current?.focus(), 10);
    } else {
      setActivePanel("emoji");
      setInputMode("text");
      setEmojiTab("emoji");
      setIsSelectionMode(false);
      setTimeout(() => textareaRef.current?.blur(), 10);
    }
  };

  const handleAddEmoji = (emoji: string) => onInputChange(input + emoji);

  const handleSendSticker = (sticker: CustomSticker) => {
    if (isSelectionMode) {
      if (selectedStickers.includes(sticker.id)) {
        setSelectedStickers((prev) => prev.filter((id) => id !== sticker.id));
      } else {
        setSelectedStickers((prev) => [...prev, sticker.id]);
      }
      return;
    }
    onSendAudio(sticker.url, 0, null, sticker.desc);
  };

  // 🔥 核心逻辑：读取本地文件并转 Base64
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制大小 (例如 1MB)
    if (file.size > 1024 * 1024) {
      alert("图片太大啦，请上传小于 1MB 的图片");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewStickerUrl(event.target.result as string);
        // 自动提取文件名作为描述
        const name = file.name.split(".")[0];
        if (!newStickerDesc) setNewStickerDesc(name);
      }
    };
    reader.readAsDataURL(file);
  };

  const confirmUpload = () => {
    let newItems: CustomSticker[] = [];
    const defaultCat = currentCategory === "全部" ? "默认" : currentCategory;

    if (uploadMode === "single") {
      if (!newStickerUrl) return;
      newItems.push({
        id: Date.now().toString(),
        url: newStickerUrl,
        desc: newStickerDesc || "自定义表情",
        category: defaultCat,
      });
    } else {
      if (!batchText.trim()) return;
      const lines = batchText.split("\n");
      lines.forEach((line, index) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        let url = "";
        let desc = "自定义表情";
        const httpIndex = cleanLine.indexOf("http");
        if (httpIndex > 0) {
          url = cleanLine.substring(httpIndex).trim();
          const prefix = cleanLine.substring(0, httpIndex).trim();
          desc =
            prefix.endsWith("：") || prefix.endsWith(":")
              ? prefix.slice(0, -1).trim()
              : prefix;
        } else if (httpIndex === 0) {
          url = cleanLine;
        } else {
          return;
        }

        if (url) {
          newItems.push({
            id: (Date.now() + index).toString(),
            url: url,
            desc: desc,
            category: defaultCat,
          });
        }
      });
    }

    if (newItems.length > 0) {
      const updated = [...stickers, ...newItems];
      setStickers(updated);
      localStorage.setItem("custom_stickers", JSON.stringify(updated));
      setNewStickerUrl("");
      setNewStickerDesc("");
      setBatchText("");
      setShowUploadModal(false);
      setEmojiTab("favorite");
    }
  };

  const executeDelete = () => {
    if (!confirm(`确定删除选中的 ${selectedStickers.length} 个表情吗？`))
      return;
    const updated = stickers.filter((s) => !selectedStickers.includes(s.id));
    setStickers(updated);
    localStorage.setItem("custom_stickers", JSON.stringify(updated));
    setSelectedStickers([]);
    setIsSelectionMode(false);
  };

  const executeMove = () => {
    if (!targetCategoryInput.trim()) return;
    const updated = stickers.map((s) => {
      if (selectedStickers.includes(s.id)) {
        return { ...s, category: targetCategoryInput.trim() };
      }
      return s;
    });
    setStickers(updated);
    localStorage.setItem("custom_stickers", JSON.stringify(updated));
    setCurrentCategory(targetCategoryInput.trim());
    setSelectedStickers([]);
    setIsSelectionMode(false);
    setShowMoveModal(false);
    setTargetCategoryInput("");
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    startY.current = clientY;
    setRecordState("recording");
    startListening();
  };
  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (recordState === "idle") return;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    if (startY.current - clientY > 80) setRecordState("cancel");
    else setRecordState("recording");
  };
  const handleEnd = () => {
    if (recordState === "cancel") abortListening();
    else if (recordState === "recording") stopListening();
    setRecordState("idle");
  };

  return (
    <>
      {recordState !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
          <div
            className={`w-40 h-40 rounded-lg flex flex-col items-center justify-center shadow-lg transition-colors duration-200 bg-opacity-95 ${
              recordState === "cancel"
                ? "bg-[#fa5151]"
                : "bg-black/70 backdrop-blur-sm"
            }`}
          >
            {recordState === "cancel" ? (
              <>
                <div className="mb-4 w-14 h-14 rounded-full bg-red-600 border-2 border-white flex items-center justify-center">
                  <span className="text-white text-3xl font-bold">!</span>
                </div>
                <span className="text-white text-[15px] font-bold px-1 rounded">
                  松开手指
                </span>
                <span className="text-white/80 text-xs mt-1">取消发送</span>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <span className="text-white text-[15px] font-bold tracking-wider">
                  手指上滑，取消发送
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800">
                添加表情 ({uploadMode === "single" ? "单张" : "批量"})
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex border-b border-gray-100">
              <button
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  uploadMode === "single"
                    ? "text-[#07c160] border-b-2 border-[#07c160] bg-green-50/20"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setUploadMode("single")}
              >
                单张添加
              </button>
              <button
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  uploadMode === "batch"
                    ? "text-[#07c160] border-b-2 border-[#07c160] bg-green-50/20"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setUploadMode("batch")}
              >
                批量导入
              </button>
            </div>
            <div className="p-5 space-y-4">
              {uploadMode === "single" ? (
                <>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block font-medium">
                      图片 (支持本地上传或 URL)
                    </label>

                    <div className="flex gap-2">
                      <input
                        value={newStickerUrl}
                        onChange={(e) => setNewStickerUrl(e.target.value)}
                        placeholder="输入图片链接..."
                        className="flex-1 bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#07c160]/20 focus:border-[#07c160] transition-all"
                      />
                      {/* 🔥🔥🔥 本地上传按钮 🔥🔥🔥 */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 rounded-lg border border-gray-200"
                        title="上传本地图片"
                      >
                        <UploadCloud className="w-5 h-5" />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block font-medium">
                      含义描述
                    </label>
                    <input
                      value={newStickerDesc}
                      onChange={(e) => setNewStickerDesc(e.target.value)}
                      placeholder="例如: 震惊"
                      className="w-full bg-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#07c160]/20 focus:border-[#07c160] transition-all"
                    />
                  </div>
                  {newStickerUrl && (
                    <div className="flex justify-center pt-1">
                      <img
                        src={newStickerUrl}
                        alt="preview"
                        className="h-20 w-20 object-contain rounded border bg-gray-50"
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-500 font-medium">
                      批量列表 (仅支持 URL)
                    </label>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      格式: 含义：链接
                    </span>
                  </div>
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    className="w-full h-32 bg-gray-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#07c160]/20 focus:border-[#07c160] transition-all resize-none font-mono leading-relaxed"
                    placeholder={`开心：https://img1.com/a.gif\nhttps://img2.com/b.webp`}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5 pt-0">
              <button
                onClick={() => setShowUploadModal(false)}
                className="flex-1 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmUpload}
                className="flex-1 py-2 text-sm font-medium bg-[#07c160] hover:bg-[#06ad56] text-white rounded-lg shadow-md shadow-green-500/20 active:scale-95 transition-all"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {showMoveModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-xs p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-gray-800 text-center">
              移动到分组
            </h3>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">
                选择或输入新分组名称
              </label>
              <input
                list="category-suggestions"
                value={targetCategoryInput}
                onChange={(e) => setTargetCategoryInput(e.target.value)}
                className="w-full bg-gray-100 border border-transparent focus:bg-white focus:border-[#07c160] rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
                placeholder="例如：猫咪系列"
              />
              <datalist id="category-suggestions">
                {categories
                  .filter((c) => c !== "全部")
                  .map((c) => (
                    <option key={c} value={c} />
                  ))}
              </datalist>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowMoveModal(false)}
                className="flex-1 py-2 text-sm font-medium bg-gray-100 text-gray-600 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={executeMove}
                className="flex-1 py-2 text-sm font-medium bg-[#07c160] text-white rounded-lg shadow-lg shadow-green-500/30"
              >
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full shrink-0 bg-[#F7F7F7] border-t border-[#ECECEC] select-none flex flex-col transition-all duration-200 z-30">
        <div className="px-3 py-2 flex gap-2 items-end">
          <button
            onClick={() => {
              setActivePanel("none");
              setInputMode((prev) => (prev === "text" ? "voice" : "text"));
            }}
            className="flex-shrink-0 w-8 h-10 flex items-center justify-center text-[#181818] mb-[1px]"
          >
            {inputMode === "text" ? (
              <svg
                className="w-7 h-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            ) : (
              <Keyboard className="w-7 h-7" strokeWidth={1.5} />
            )}
          </button>
          {inputMode === "text" ? (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onClick={handleInputFocus}
              onFocus={handleInputFocus}
              className="flex-1 bg-white text-[16px] text-black rounded-[6px] px-3 resize-none focus:outline-none max-h-32 min-h-[40px] leading-5"
              style={{ paddingTop: "9px" }}
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) onSendText();
                }
              }}
            />
          ) : (
            <button
              className={`flex-1 h-[40px] rounded-[6px] text-[16px] font-bold text-[#181818] flex items-center justify-center ${
                recordState === "idle" ? "bg-white" : "bg-[#DEDEDE]"
              }`}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onContextMenu={(e) => e.preventDefault()}
            >
              {recordState === "idle" ? "按住 说话" : "松开 结束"}
            </button>
          )}
          <div className="flex gap-2 flex-shrink-0 items-center h-10 mb-[1px]">
            <button
              onClick={toggleEmojiPanel}
              className={`w-8 flex items-center justify-center ${
                activePanel === "emoji" ? "text-[#07c160]" : "text-[#181818]"
              }`}
            >
              <Smile className="w-7 h-7" strokeWidth={1.5} />
            </button>
            {input.trim() && inputMode === "text" ? (
              <button
                onClick={() => onSendText()}
                disabled={isLoading}
                className="h-8 px-4 ml-1 rounded-[4px] bg-[#07c160] text-white text-[13px] font-medium flex items-center justify-center"
              >
                发送
              </button>
            ) : (
              <button
                onClick={() =>
                  setActivePanel(activePanel === "plus" ? "none" : "plus")
                }
                className="w-8 flex items-center justify-center text-[#181818]"
              >
                <div
                  className="w-7 h-7 rounded-full border border-[#181818] border-opacity-70 flex items-center justify-center transition-transform"
                  style={{
                    transform:
                      activePanel === "plus" ? "rotate(45deg)" : "rotate(0)",
                  }}
                >
                  <Plus className="w-5 h-5 opacity-80" strokeWidth={2} />
                </div>
              </button>
            )}
          </div>
        </div>

        <div
          className="bg-[#F7F7F7] overflow-hidden transition-all duration-300 ease-in-out border-t border-[#ECECEC]"
          style={{ height: activePanel === "none" ? "0px" : "300px" }}
        >
          {activePanel === "emoji" && (
            <div className="h-full flex flex-col relative">
              {isSelectionMode && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gray-900/90 text-white z-20 flex items-center justify-between px-4 text-sm backdrop-blur-md shadow-md animate-in slide-in-from-bottom-2">
                  <span className="font-medium pl-1">
                    已选 {selectedStickers.length} 项
                  </span>
                  <div className="flex gap-4 items-center">
                    {selectedStickers.length > 0 && (
                      <>
                        <button
                          onClick={() => setShowMoveModal(true)}
                          className="flex items-center gap-1 hover:text-[#07c160] transition-colors"
                        >
                          <FolderInput className="w-4 h-4" /> 移动
                        </button>
                        <button
                          onClick={executeDelete}
                          className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Delete className="w-4 h-4" /> 删除
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setIsSelectionMode(false);
                        setSelectedStickers([]);
                      }}
                      className="text-gray-400 hover:text-white ml-2"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {emojiTab === "favorite" && !isSelectionMode && (
                <div className="h-10 border-b border-gray-200 flex items-center px-2 gap-2 overflow-x-auto no-scrollbar bg-gray-50">
                  <Layers className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCurrentCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                        currentCategory === cat
                          ? "bg-[#07c160] text-white shadow-sm"
                          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div
                className={`flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/50 ${
                  isSelectionMode ? "pb-16" : ""
                }`}
              >
                {emojiTab === "emoji" && (
                  <div className="grid grid-cols-8 gap-y-4 gap-x-2">
                    {EMOJI_LIST.map((emoji, i) => (
                      <button
                        key={i}
                        onClick={() => handleAddEmoji(emoji)}
                        className="text-2xl hover:scale-125 select-none transition-transform"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {emojiTab === "favorite" && (
                  <>
                    {filteredStickers.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                        <ImagePlus className="w-10 h-10 opacity-20" />
                        <span className="text-xs">该分组下暂无表情</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-4 pb-10">
                        {filteredStickers.map((s) => (
                          <div
                            key={s.id}
                            onClick={() => handleSendSticker(s)}
                            className={`aspect-square relative flex items-center justify-center bg-white rounded-xl p-2 shadow-sm border border-gray-100 cursor-pointer overflow-hidden group ${
                              isSelectionMode
                                ? "active:scale-95"
                                : "hover:-translate-y-1 hover:shadow-md transition-all duration-200"
                            }`}
                          >
                            {isSelectionMode && (
                              <div className="absolute top-1 right-1 z-10 transition-transform duration-200">
                                {selectedStickers.includes(s.id) ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#07c160] fill-white" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-300 fill-white" />
                                )}
                              </div>
                            )}
                            <img
                              src={s.url}
                              alt={s.desc}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="max-w-full max-h-full object-contain pointer-events-none"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                e.currentTarget.parentElement?.classList.add(
                                  "bg-gray-100"
                                );
                              }}
                            />
                            {!isSelectionMode && (
                              <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] px-1 py-0.5 text-center truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {s.desc}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="h-10 bg-white border-t border-[#ECECEC] flex items-center relative shadow-sm z-10">
                <div className="flex-1 flex overflow-x-auto no-scrollbar h-full items-center pl-2">
                  <button className="w-10 h-full flex items-center justify-center hover:bg-gray-100">
                    <Search className="w-5 h-5 text-gray-500" />
                  </button>
                  <button
                    onClick={() => {
                      setEmojiTab("emoji");
                      setIsSelectionMode(false);
                    }}
                    className={`w-10 h-full flex items-center justify-center hover:bg-gray-100 ${
                      emojiTab === "emoji" ? "bg-gray-100" : ""
                    }`}
                  >
                    <Smile className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => {
                      setEmojiTab("favorite");
                      setIsSelectionMode(false);
                    }}
                    className={`w-10 h-full flex items-center justify-center hover:bg-gray-100 ${
                      emojiTab === "favorite" ? "bg-gray-100" : ""
                    }`}
                  >
                    <Heart className="w-5 h-5 text-red-500 fill-current" />
                  </button>
                  <div className="w-[1px] h-5 bg-gray-200 mx-2"></div>
                  <button className="w-10 h-full flex items-center justify-center hover:bg-gray-100">
                    <GripHorizontal className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <div className="flex items-center h-full border-l border-gray-100 bg-white z-10 pr-2">
                  {emojiTab === "favorite" && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="w-10 h-full flex items-center justify-center hover:bg-gray-100 text-[#07c160]"
                    >
                      <ImagePlus className="w-5 h-5" />
                    </button>
                  )}
                  {emojiTab === "favorite" ? (
                    <button
                      onClick={() => setIsSelectionMode(!isSelectionMode)}
                      className={`w-10 h-full flex items-center justify-center hover:bg-gray-100 ${
                        isSelectionMode
                          ? "text-[#07c160] bg-green-50"
                          : "text-gray-500"
                      }`}
                    >
                      {isSelectionMode ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Settings className="w-5 h-5" />
                      )}
                    </button>
                  ) : (
                    <button
                      className="w-12 h-full flex items-center justify-center hover:bg-gray-100"
                      onClick={() => onInputChange(input.slice(0, -1))}
                    >
                      <Delete className="w-5 h-5 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {activePanel === "plus" && (
            <div className="h-full grid grid-cols-4 gap-6 p-6">
              <div className="flex flex-col items-center gap-2 group cursor-pointer active:opacity-60">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center border border-gray-200 text-3xl">
                  🖼️
                </div>
                <span className="text-xs text-gray-500">相册</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
