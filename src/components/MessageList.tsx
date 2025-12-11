import React, { useState, useRef, useEffect } from "react";
import {
  Trash2,
  Volume2,
  Copy,
  Quote,
  RefreshCw,
  Share,
  Box,
  Edit3,
  Play,
  Check,
  CheckSquare,
  ImageOff,
} from "lucide-react";

export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: Date | string;
  type?: "text" | "image" | "audio" | "sticker";
  duration?: number;
  audioUrl?: string;
  status?: "sending" | "sent" | "error";
  alt?: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  contactInfo: any;
  contactAvatar: string;
  myAvatar?: string;
  conversationId: string;
  onDeleteMessage: (id: string) => void;
  onResendMessage?: (msg: Message) => void;
  onContinueMessage?: (msg: Message) => void;
  onEditMessage?: (msg: Message) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onEnterSelectionMode?: (initialMsgId?: string) => void;
}

// 🔥 修改1：正则变宽容了，!? 表示感叹号可有可无
const extractMarkdownImage = (content: string) => {
  const match = content.match(/^\s*!?\[(.*?)\]\((.*?)\)\s*$/);
  if (match) {
    return { alt: match[1], src: match[2] };
  }
  return null;
};

const RenderContentWithImages = ({ content }: { content: string }) => {
  // 🔥 修改2：拆分正则也变宽容了
  const parts = content.split(/(!?\[.*?\]\(.*?\))/g);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
        // 🔥 修改3：匹配正则也变宽容了
        const imageMatch = part.match(/^!?\[(.*?)\]\((.*?)\)$/);
        if (imageMatch) {
          const [_, alt, src] = imageMatch;
          return (
            <img
              key={index}
              src={src}
              alt={alt}
              className="inline-block max-w-[120px] max-h-[120px] align-middle rounded-lg my-1 mx-1 border border-gray-100 bg-white cursor-pointer"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default function MessageList({
  messages,
  isLoading,
  contactAvatar,
  myAvatar,
  onDeleteMessage,
  onResendMessage,
  onContinueMessage,
  onEditMessage,
  isSelectionMode,
  selectedIds,
  onToggleSelection,
  onEnterSelectionMode,
}: MessageListProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({
    x: 0,
    y: 0,
    align: "center" as any,
  });
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const close = () => setMenuVisible(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    if (isSelectionMode) {
      e.preventDefault();
      onToggleSelection && onToggleSelection(msg.id);
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    const screenW = window.innerWidth;
    const menuW = 280;
    const menuH = 140;

    let x = e.clientX - menuW / 2;
    let y = e.clientY - menuH - 15;
    let align = "center";

    if (x < 10) {
      x = 10;
      align = "left";
    } else if (x + menuW > screenW - 10) {
      x = screenW - menuW - 10;
      align = "right";
    }
    if (y < 50) y = e.clientY + 20;

    setMenuPosition({ x, y, align });
    setSelectedMsg(msg);
    setMenuVisible(true);
    setIsCopied(false);
  };

  const playAudio = (url: string, id: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (playingAudioId === id) {
        setPlayingAudioId(null);
        return;
      }
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingAudioId(id);
    audio.play();
    audio.onended = () => setPlayingAudioId(null);
  };

  const handleCopy = () => {
    if (selectedMsg?.content) {
      navigator.clipboard.writeText(selectedMsg.content);
      setIsCopied(true);
      setTimeout(() => setMenuVisible(false), 500);
    }
  };

  const MenuItem = ({ icon: Icon, label, onClick }: any) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg hover:bg-white/10 active:bg-white/20 transition-colors"
    >
      <Icon className="w-5 h-5 text-white" />
      <span className="text-[11px] text-white/90 whitespace-nowrap">
        {label}
      </span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3 py-4">
      {messages.map((msg, index) => {
        const isUser = msg.role === "user";
        const isSelected = selectedIds?.has(msg.id);

        // 🔥 这里也用了新逻辑，只要是 [xxx](url) 格式就认为是图片
        const markdownImage =
          !msg.type || msg.type === "text"
            ? extractMarkdownImage(msg.content)
            : null;

        const isImageFailed = failedImages.has(msg.id);
        const isStickerMode = msg.type === "sticker" || !!markdownImage;

        const bubbleClass =
          isStickerMode || msg.type === "image"
            ? "bg-transparent shadow-none p-0"
            : isUser
            ? "bg-[#95ec69] text-black rounded-[6px]"
            : "bg-white text-black rounded-[6px] border border-gray-100";

        return (
          <div
            key={msg.id}
            className={`flex w-full mb-2 items-center ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            {isSelectionMode && (
              <div
                className="mr-3 shrink-0 cursor-pointer animate-in fade-in zoom-in duration-200"
                onClick={() => onToggleSelection && onToggleSelection(msg.id)}
              >
                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </div>
            )}

            {!isUser && (
              <img
                src={contactAvatar}
                className="w-12 h-12 rounded-[6px] object-cover border border-gray-200 bg-white mr-2"
              />
            )}

            <div
              className={`flex flex-col max-w-[75%] ${
                isUser ? "items-end" : "items-start"
              }`}
            >
              <div
                onContextMenu={(e) => handleContextMenu(e, msg)}
                onClick={(e) => {
                  if (isSelectionMode) {
                    e.stopPropagation();
                    onToggleSelection && onToggleSelection(msg.id);
                  }
                }}
                className={`relative px-3 py-2 text-[15px] leading-relaxed break-words shadow-sm select-text cursor-pointer ${bubbleClass}`}
              >
                {/* 1. Markdown 图片 */}
                {markdownImage && (
                  <>
                    <img
                      src={markdownImage.src}
                      alt={markdownImage.alt}
                      className="w-32 h-32 object-contain cursor-zoom-in"
                      style={{ display: isImageFailed ? "none" : "block" }}
                      onClick={() =>
                        !isSelectionMode && setPreviewImage(markdownImage.src)
                      }
                      onError={() => {
                        setFailedImages((prev) => new Set(prev).add(msg.id));
                      }}
                    />

                    {/* 占位符 */}
                    {isImageFailed && (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 border border-gray-200 border-dashed">
                        <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px] opacity-70">图片失效</span>
                      </div>
                    )}
                  </>
                )}

                {/* 2. 原生图片 */}
                {msg.type === "image" && (
                  <img
                    src={msg.content}
                    alt="img"
                    onClick={() =>
                      !isSelectionMode && setPreviewImage(msg.content)
                    }
                    className="max-w-[200px] max-h-[200px] rounded-[6px] cursor-zoom-in bg-white"
                  />
                )}

                {/* 3. 贴纸 */}
                {msg.type === "sticker" && (
                  <img
                    src={msg.content || msg.audioUrl}
                    className="w-32 h-32 object-contain"
                    alt="sticker"
                  />
                )}

                {/* 4. 普通文本 */}
                {!isStickerMode &&
                  msg.type !== "image" &&
                  msg.type !== "audio" && (
                    <RenderContentWithImages content={msg.content || ""} />
                  )}

                {msg.type === "audio" && (
                  <div
                    onClick={() =>
                      !isSelectionMode &&
                      msg.audioUrl &&
                      playAudio(msg.audioUrl, msg.id)
                    }
                    className="flex items-center gap-2 min-w-[80px]"
                  >
                    <Volume2
                      className={`w-4 h-4 ${
                        playingAudioId === msg.id
                          ? "animate-pulse text-green-700"
                          : ""
                      }`}
                    />
                    <span>{msg.duration ? `${msg.duration}"` : "语音"}</span>
                  </div>
                )}
              </div>
            </div>

            {isUser && (
              <div className="ml-2">
                {myAvatar ? (
                  <img
                    src={myAvatar}
                    className="w-12 h-12 rounded-[6px] object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-[6px] bg-[#07c160]"></div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex w-full mb-2 justify-start">
          <img src={contactAvatar} className="w-12 h-12 rounded-[6px] mr-2" />
          <div className="bg-white rounded-[6px] border border-gray-100 px-4 py-3">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
          </div>
        </div>
      )}

      {menuVisible && selectedMsg && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuVisible(false)}
          ></div>
          <div
            className="fixed z-50 animate-in fade-in zoom-in-95 duration-100 origin-bottom"
            style={{ top: menuPosition.y, left: menuPosition.x }}
          >
            <div className="bg-[#4c4c4c] rounded-xl shadow-2xl p-1.5 w-[280px]">
              <div className="grid grid-cols-5 gap-y-2 gap-x-1">
                <MenuItem
                  icon={Share}
                  label="转发"
                  onClick={() => setMenuVisible(false)}
                />
                <MenuItem
                  icon={Box}
                  label="收藏"
                  onClick={() => setMenuVisible(false)}
                />

                {selectedMsg.role !== "user" ? (
                  <MenuItem
                    icon={RefreshCw}
                    label="重新说"
                    onClick={() => {
                      onResendMessage && onResendMessage(selectedMsg);
                      setMenuVisible(false);
                    }}
                  />
                ) : (
                  <MenuItem
                    icon={Edit3}
                    label="编辑"
                    onClick={() => {
                      onEditMessage && onEditMessage(selectedMsg);
                      setMenuVisible(false);
                    }}
                  />
                )}

                <MenuItem
                  icon={Quote}
                  label="引用"
                  onClick={() => setMenuVisible(false)}
                />
                <MenuItem
                  icon={Trash2}
                  label="删除"
                  onClick={() => {
                    onDeleteMessage(selectedMsg.id);
                    setMenuVisible(false);
                  }}
                />

                <MenuItem
                  icon={CheckSquare}
                  label="多选"
                  onClick={() => {
                    setMenuVisible(false);
                    onEnterSelectionMode &&
                      onEnterSelectionMode(selectedMsg.id);
                  }}
                />

                {selectedMsg.role !== "user" && (
                  <MenuItem
                    icon={Play}
                    label="继续说"
                    onClick={() => {
                      onContinueMessage && onContinueMessage(selectedMsg);
                      setMenuVisible(false);
                    }}
                  />
                )}

                {selectedMsg.type !== "image" &&
                  selectedMsg.type !== "sticker" &&
                  !extractMarkdownImage(selectedMsg.content) && (
                    <MenuItem
                      icon={isCopied ? Check : Copy}
                      label={isCopied ? "已复制" : "复制"}
                      onClick={handleCopy}
                    />
                  )}
              </div>
              <div
                className="absolute -bottom-2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-[#4c4c4c]"
                style={{
                  left:
                    menuPosition.align === "left"
                      ? "20px"
                      : menuPosition.align === "right"
                      ? "calc(100% - 28px)"
                      : "calc(50% - 8px)",
                }}
              ></div>
            </div>
          </div>
        </>
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}
