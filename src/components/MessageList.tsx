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
  Music, // 🔥 新增：音乐图标
  CheckCircle2, // 🔥 新增：选中图标
} from "lucide-react";

export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: Date | string;
  // 🔥 新增 system_notice 类型
  type?:
    | "text"
    | "image"
    | "audio"
    | "sticker"
    | "music_invite"
    | "system_notice";
  duration?: number;
  audioUrl?: string;
  status?: "sending" | "sent" | "error";
  alt?: string; // 用于存储音乐封面
  extra?: {
    // 🔥 用于存储额外状态 (如已接受邀请)
    songTitle?: string;
    songArtist?: string;
    accepted?: boolean;
  };
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

// Markdown 图片提取正则
const extractMarkdownImage = (content: string) => {
  const match = content.match(/^\s*!?\[(.*?)\]\((.*?)\)\s*$/);
  if (match) {
    return { alt: match[1], src: match[2] };
  }
  return null;
};

// 文本渲染组件 (支持混合图片)
const RenderContentWithImages = ({ content }: { content: string }) => {
  const parts = content.split(/(!?\[.*?\]\(.*?\))/g);
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, index) => {
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
  contactInfo, // 🔥 需要用到这个显示昵称
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col gap-3 py-4" ref={scrollRef}>
      {messages.map((msg, index) => {
        // 🔥🔥🔥 核心新增：如果是系统提示 (灰色条) 🔥🔥🔥
        if (msg.type === "system_notice") {
          return (
            <div
              key={msg.id}
              className="flex justify-center my-2 animate-in fade-in zoom-in-95 duration-300"
            >
              <div className="bg-[#f3f3f3] text-[#999999] text-[11px] px-3 py-1 rounded-full shadow-sm max-w-[80%] text-center font-medium">
                {msg.content}
              </div>
            </div>
          );
        }

        const isUser = msg.role === "user";
        const isSelected = selectedIds?.has(msg.id);

        const markdownImage =
          !msg.type || msg.type === "text"
            ? extractMarkdownImage(msg.content)
            : null;

        const isImageFailed = failedImages.has(msg.id);
        const isStickerMode = msg.type === "sticker" || !!markdownImage;
        const isInviteMode = msg.type === "music_invite"; // 🔥 邀请卡片模式

        // 气泡样式处理
        let bubbleClass = isUser
          ? "bg-[#95ec69] text-black rounded-[6px]"
          : "bg-white text-black rounded-[6px] border border-gray-100";

        if (isStickerMode || msg.type === "image" || isInviteMode) {
          bubbleClass = "bg-transparent shadow-none p-0 border-none";
        }

        return (
          <div
            key={msg.id}
            className={`flex w-full mb-2 items-start ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            {/* 多选模式勾选框 (放在最左边) */}
            {isSelectionMode && (
              <div
                className="mr-3 shrink-0 cursor-pointer animate-in fade-in zoom-in duration-200 self-center"
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

            {/* AI 头像 (仅非用户消息显示) */}
            {!isUser && (
              <img
                src={contactAvatar}
                className="w-10 h-10 rounded-[6px] object-cover bg-gray-200 mr-2 shrink-0"
              />
            )}

            <div
              className={`flex flex-col max-w-[75%] ${
                isUser ? "items-end" : "items-start"
              }`}
            >
              {/* 昵称显示 (仅 AI 且非用户) */}
              {!isUser && contactInfo?.name && (
                <span className="text-[10px] text-gray-400 mb-1 ml-1">
                  {contactInfo.name}
                </span>
              )}

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
                {/* 🔥🔥🔥 情况 0: 音乐邀请卡片 (仿网易云) 🔥🔥🔥 */}
                {isInviteMode && (
                  <div className="flex flex-col items-end">
                    {/* 卡片主体 */}
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 w-60 active:scale-95 transition-transform overflow-hidden relative">
                      <div className="flex items-start gap-3 mb-3 relative z-10">
                        <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden shrink-0 border border-gray-100">
                          <img
                            src={
                              msg.alt ||
                              "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80"
                            }
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] text-gray-900 font-medium leading-tight mb-1 line-clamp-2">
                            我的耳机分你一半，和我一起听歌吧～
                          </div>
                          <div className="text-[10px] text-gray-400 truncate">
                            by {isUser ? "我" : contactInfo?.name || "AI"}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-2 flex items-center gap-1.5 text-[10px] text-gray-400 relative z-10">
                        <div className="bg-red-50 p-0.5 rounded-full">
                          <Music className="w-3 h-3 text-red-500" />
                        </div>
                        网易云音乐
                      </div>
                      {/* 装饰背景圆 */}
                      <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-red-500/5 rounded-full blur-xl pointer-events-none"></div>
                    </div>

                    {/* 🔥 同意后的小灰字提示 (暂时保留以兼容旧数据，新版用 system_notice) 🔥 */}
                    {msg.extra?.accepted && (
                      <div className="mt-1.5 text-[10px] text-white/60 bg-black/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in slide-in-from-top-1 backdrop-blur-sm self-center">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {(contactInfo?.name || "对方") + " 已同意听歌"}
                      </div>
                    )}
                  </div>
                )}

                {/* 情况 1: Markdown 图片 */}
                {markdownImage && (
                  <>
                    <img
                      src={markdownImage.src}
                      alt={markdownImage.alt}
                      className="w-32 h-32 object-contain cursor-zoom-in bg-white rounded-lg"
                      style={{ display: isImageFailed ? "none" : "block" }}
                      onClick={() =>
                        !isSelectionMode && setPreviewImage(markdownImage.src)
                      }
                      onError={() => {
                        setFailedImages((prev) => new Set(prev).add(msg.id));
                      }}
                    />
                    {isImageFailed && (
                      <div className="w-32 h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 border border-gray-200 border-dashed">
                        <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px] opacity-70">图片失效</span>
                      </div>
                    )}
                  </>
                )}

                {/* 情况 2: 原生图片 */}
                {msg.type === "image" && (
                  <img
                    src={msg.content}
                    alt="img"
                    onClick={() =>
                      !isSelectionMode && setPreviewImage(msg.content)
                    }
                    className="max-w-[200px] max-h-[200px] rounded-[6px] cursor-zoom-in bg-white border border-gray-200"
                  />
                )}

                {/* 情况 3: 贴纸 */}
                {msg.type === "sticker" && (
                  <img
                    src={msg.content || msg.audioUrl}
                    className="w-32 h-32 object-contain"
                    alt="sticker"
                  />
                )}

                {/* 情况 4: 普通文本 */}
                {!isStickerMode &&
                  !isInviteMode &&
                  msg.type !== "image" &&
                  msg.type !== "audio" && (
                    <RenderContentWithImages content={msg.content || ""} />
                  )}

                {/* 情况 5: 语音消息 */}
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

            {/* 用户头像 (仅用户消息显示) */}
            {isUser && (
              <div className="ml-2 shrink-0">
                {myAvatar ? (
                  <img
                    src={myAvatar}
                    className="w-10 h-10 rounded-[6px] object-cover bg-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-[6px] bg-[#07c160]"></div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Loading 状态 */}
      {isLoading && (
        <div className="flex w-full mb-2 justify-start items-start">
          <img
            src={contactAvatar}
            className="w-10 h-10 rounded-[6px] mr-2 bg-gray-200 shrink-0"
          />
          <div className="bg-white rounded-[6px] border border-gray-100 px-4 py-3 shadow-sm">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        </div>
      )}

      {/* 长按菜单 (保持你原有的) */}
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
                  selectedMsg.type !== "music_invite" &&
                  selectedMsg.type !== "system_notice" && // 🔥 排除系统消息
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

      {/* 图片预览 */}
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
