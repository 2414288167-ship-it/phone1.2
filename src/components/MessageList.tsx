"use client";
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
  Timer,
  Trophy,
  ArrowRight,
  PlayCircle,
  Music,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

// --- 🔥🔥🔥 FocusCard 组件定义 🔥🔥🔥 ---
interface FocusCardProps {
  type: "invite" | "share";
  duration?: number;
  taskName?: string;
  cycles?: number;
  breakTime?: number;
  isSelf?: boolean;
}

const FocusCard = ({
  type,
  duration = 25,
  taskName = "未命名任务",
  cycles = 4,
  breakTime = 5,
  isSelf,
}: FocusCardProps) => {
  const isInvite = type === "invite";
  const inviteLink = `/focus?auto=1&work=${duration}&break=${breakTime}&cycles=${cycles}&task=${encodeURIComponent(
    taskName || ""
  )}`;
  const shareLink = "/focus";

  const formatShareTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0 && m > 0) return `${h}小时${m}分钟`;
    if (h > 0) return `${h}小时`;
    return `${m}分钟`;
  };

  return (
    <Link
      href={isInvite ? inviteLink : shareLink}
      className="flex flex-col items-end group cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 w-64 active:scale-95 transition-transform overflow-hidden relative">
        <div className="flex items-start gap-3 mb-3 relative z-10">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-gray-50 
            ${
              isInvite
                ? "bg-rose-100 text-rose-500"
                : "bg-blue-100 text-blue-500"
            }`}
          >
            {isInvite ? (
              <Timer className="w-6 h-6" />
            ) : (
              <Trophy className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] text-gray-900 font-bold leading-tight mb-1 line-clamp-2">
              {isInvite ? "该去专注学习啦！" : "我完成了专注挑战！"}
            </div>
            <div className="text-[11px] text-gray-500 truncate">
              {isInvite
                ? `建议专注 ${duration}min × ${cycles}轮`
                : `共专注 ${formatShareTime(duration || 0)}`}
            </div>
            {!isInvite && taskName && (
              <div className="text-[10px] text-gray-400 truncate mt-0.5">
                任务：{taskName}
              </div>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 pt-2 flex items-center justify-between text-[10px] text-gray-400 relative z-10">
          <div className="flex items-center gap-1.5">
            <div
              className={`p-0.5 rounded-full ${
                isInvite ? "bg-rose-50" : "bg-blue-50"
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full flex items-center justify-center font-bold text-[8px] ${
                  isInvite ? "text-rose-500" : "text-blue-500"
                }`}
              >
                M
              </div>
            </div>
            Meow Focus
          </div>
          {isInvite && (
            <div className="flex items-center gap-1 text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded-full">
              Start <PlayCircle className="w-3 h-3" />
            </div>
          )}
        </div>
        <div
          className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-xl pointer-events-none opacity-20
          ${isInvite ? "bg-rose-500" : "bg-blue-500"}`}
        ></div>
      </div>
    </Link>
  );
};

// --- 类型定义 ---
export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: Date | string;
  type?:
    | "text"
    | "image"
    | "audio"
    | "sticker"
    | "music_invite"
    | "system_notice"
    | "focus_invite"
    | "focus_share";
  duration?: number;
  audioUrl?: string;
  status?: "sending" | "sent" | "error";
  alt?: string;
  extra?: {
    songTitle?: string;
    songArtist?: string;
    accepted?: boolean;
    duration?: number;
    breakTime?: number;
    cycles?: number;
    taskName?: string;
    totalSeconds?: number;
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

const extractMarkdownImage = (content: string) => {
  const match = content.match(/^\s*!?\[(.*?)\]\((.*?)\)\s*$/);
  if (match) {
    return { alt: match[1], src: match[2] };
  }
  return null;
};

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

// 🔥🔥🔥 新增：解析旁白和对话的函数 🔥🔥🔥
// 匹配中文括号（）或英文括号()中的内容
const splitNarrativeContent = (text: string) => {
  // 正则：捕获带括号的内容 (包括全角和半角)
  // 1. ([（\(]) -> 开始括号
  // 2. [\s\S]*? -> 括号内的内容 (非贪婪)
  // 3. ([）\)]) -> 结束括号
  const regex = /([（\(][\s\S]*?[）\)])/g;
  const parts = text.split(regex).filter((p) => p.trim() !== "");

  return parts.map((part) => {
    const isNarration =
      /^([（\(])/.test(part.trim()) && /([）\)])$/.test(part.trim());
    return {
      text: part,
      isNarration,
    };
  });
};

export default function MessageList({
  messages,
  isLoading,
  contactAvatar,
  myAvatar,
  contactInfo,
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
      {messages.map((msg) => {
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
        const isInviteMode = msg.type === "music_invite";
        const isFocusMode =
          msg.type === "focus_invite" || msg.type === "focus_share";

        // 🔥🔥🔥 核心渲染逻辑：判断是否启用旁白模式 🔥🔥🔥
        const isAsideMode =
          contactInfo?.asideMode && // 在设置里开启了旁白模式
          !isUser && // 只有 AI 的消息生效
          msg.type === "text" &&
          !isStickerMode &&
          !isInviteMode &&
          !isFocusMode;

        // 如果开启了旁白模式，气泡样式需要在内部单独处理，外部容器只负责布局
        let bubbleClass = isUser
          ? "bg-[#95ec69] text-black rounded-[6px]"
          : "bg-white text-black rounded-[6px] border border-gray-100";

        // 特殊类型的透明气泡
        if (
          isStickerMode ||
          msg.type === "image" ||
          isInviteMode ||
          isFocusMode ||
          isAsideMode // 🔥 旁白模式下，父容器透明，样式在子元素里
        ) {
          bubbleClass = "bg-transparent shadow-none p-0 border-none";
        }

        return (
          <div
            key={msg.id}
            className={`flex w-full mb-2 items-start ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
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
                {/* 🔥🔥🔥 分支 1：旁白模式渲染 (Novel Style) 🔥🔥🔥 */}
                {isAsideMode ? (
                  <div className="flex flex-col items-start w-full gap-2">
                    {splitNarrativeContent(msg.content).map((part, idx) => {
                      if (part.isNarration) {
                        // 动作/旁白框样式：米色背景，类似便签
                        return (
                          <div
                            key={idx}
                            className="bg-[#fffdf5] text-[#7d7164] px-3 py-2 rounded-lg text-sm border border-[#e8e2d2] shadow-sm w-full font-normal italic"
                          >
                            {part.text.replace(/[（）()]/g, "")}{" "}
                            {/* 去掉括号显示 */}
                          </div>
                        );
                      } else {
                        // 对话气泡样式：标准白底黑字
                        return (
                          <div
                            key={idx}
                            className="bg-white text-black px-3 py-2 rounded-[6px] border border-gray-100 shadow-sm"
                          >
                            <RenderContentWithImages content={part.text} />
                          </div>
                        );
                      }
                    })}
                  </div>
                ) : (
                  /* 🔥🔥🔥 分支 2：普通模式渲染 (Standard Bubble) 🔥🔥🔥 */
                  <>
                    {msg.type === "focus_invite" && (
                      <FocusCard
                        type="invite"
                        duration={msg.extra?.duration}
                        breakTime={msg.extra?.breakTime}
                        cycles={msg.extra?.cycles}
                        taskName={msg.extra?.taskName}
                      />
                    )}

                    {msg.type === "focus_share" && (
                      <FocusCard
                        type="share"
                        duration={msg.extra?.totalSeconds}
                        taskName={msg.extra?.taskName}
                        isSelf={true}
                      />
                    )}

                    {isInviteMode && (
                      <div className="flex flex-col items-end">
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
                          <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-red-500/5 rounded-full blur-xl pointer-events-none"></div>
                        </div>
                        {msg.extra?.accepted && (
                          <div className="mt-1.5 text-[10px] text-white/60 bg-black/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-in fade-in slide-in-from-top-1 backdrop-blur-sm self-center">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {(contactInfo?.name || "对方") + " 已同意听歌"}
                          </div>
                        )}
                      </div>
                    )}

                    {markdownImage && (
                      <>
                        <img
                          src={markdownImage.src}
                          alt={markdownImage.alt}
                          className="w-32 h-32 object-contain cursor-zoom-in bg-white rounded-lg"
                          style={{ display: isImageFailed ? "none" : "block" }}
                          onClick={() =>
                            !isSelectionMode &&
                            setPreviewImage(markdownImage.src)
                          }
                          onError={() => {
                            setFailedImages((prev) =>
                              new Set(prev).add(msg.id)
                            );
                          }}
                        />
                        {isImageFailed && (
                          <div className="w-32 h-32 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 border border-gray-200 border-dashed">
                            <ImageOff className="w-8 h-8 mb-2 opacity-50" />
                            <span className="text-[10px] opacity-70">
                              图片失效
                            </span>
                          </div>
                        )}
                      </>
                    )}

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

                    {msg.type === "sticker" && (
                      <img
                        src={msg.content || msg.audioUrl}
                        className="w-32 h-32 object-contain"
                        alt="sticker"
                      />
                    )}

                    {!isStickerMode &&
                      !isInviteMode &&
                      !isFocusMode &&
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
                        <span>
                          {msg.duration ? `${msg.duration}"` : "语音"}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

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
                  selectedMsg.type !== "focus_invite" &&
                  selectedMsg.type !== "focus_share" &&
                  selectedMsg.type !== "system_notice" &&
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
