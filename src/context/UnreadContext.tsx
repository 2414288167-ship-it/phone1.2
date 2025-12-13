"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { usePathname } from "next/navigation";

// 提示音 Base64
const SHORT_DING =
  "data:audio/mp3;base64,SUQzBAAAAAABAFRYWFgAAAASAAADbWFqb3JfYnJhbmQAbXA0MgRYWFgAAAALAAADYW1pbm9yX3ZlcnNpb24AMABUWFhYAAAAEAAAA2NvbXBhdGlibGVfYnJhbmRzAGlzb21tcDQy//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAZAAABxwADBQoMDxETFhcZGx4hIyUnKSwuMTM2ODs9P0JERkdJS0xOUVJTVldeYWNjZmhpbG5xc3Z4ent9foCDhIWIio2OkJOVl5mbnp+goqOmqKqsrrCztLm7vb/CxMbHycvMz9HT1dfZ3N3f4OLj5efp7O3v8PHy9Pf5+/0AAAAATGF2YzU4LjkxLjEwMAAAAAAAAAAAAAAA//uQZAAP8AAAaQAAAADgAAA0gAAAAABAAABpAAAABAAAADSAAAAENuCngAAAAAAABMAJBNwF/wAAAAAAD/8zM/jQngAAAAA//7kGQAD/AAAGkAAAAEAAAANIAAAAAAQAAAaQAAAAQAAAA0gAAABAAAAEAAAAAAABAAAAAAAAAAAAAAH/4AAQSkZGROhEUkL/8zM/jQngAAAAA//7kGQAD/AAAGkAAAAEAAAANIAAAAAAQAAAaQAAAAQAAAA0gAAABAAAAEAAAAAAABAAAAAAAAAAAAAAH/4AAQSkZGROhEUkL/8zM/jQngAAAAA//7kGQAD/AAAGkAAAAEAAAANIAAAAAAQAAAaQAAAAQAAAA0gAAABAAAAEAAAAAAABAAAAAAAAAAAAAAH/4AAQSkZGROhEUkL/8zM/jQngAAAAA";

const DEFAULT_RINGTONE: Ringtone = {
  id: "default",
  name: "默认提示音 (叮)",
  url: SHORT_DING,
};

interface Ringtone {
  id: string;
  name: string;
  url: string;
}

interface UnreadContextType {
  unreadCounts: { [key: string]: number };
  totalUnread: number;
  incrementUnread: (id: string, content: string, count?: number) => void;
  clearUnread: (id: string) => void;

  ringtones: Ringtone[];
  currentRingtoneId: string;
  addRingtone: (name: string, file: File) => Promise<void>;
  selectRingtone: (id: string) => void;
  deleteRingtone: (id: string) => void;
  playCurrentRingtone: () => void;
}

const UnreadContext = createContext<UnreadContextType | null>(null);

// --- 🔥 PWA 通知辅助函数 (新增) ---
const sendMobileNotification = async (
  title: string,
  body: string,
  tag: string
) => {
  if (typeof window === "undefined") return;

  // 1. 尝试请求权限
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.warn("请求通知权限失败:", e);
    }
  }

  if (Notification.permission !== "granted") return;

  try {
    // 2. 优先尝试 Service Worker (手机端必备)
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body: body,
          icon: "/icon.png", // 确保 public 目录下有这个图标，没有也不影响
          badge: "/icon.png",
          vibrate: [200, 100, 200],
          tag: tag, // 防止刷屏，相同tag覆盖
          renotify: true, // 新消息重新震动
        } as any);
        return; // 发送成功，直接返回
      }
    }
  } catch (e) {
    console.warn("[Unread] SW通知发送失败，尝试降级:", e);
  }

  // 3. 降级方案 (PC端 / SW不可用时)
  try {
    new Notification(title, { body, tag, silent: true }); // silent: true 因为我们要手动播声音
  } catch (e) {
    console.error("[Unread] 所有通知方式均失败:", e);
  }
};

export function UnreadProvider({ children }: { children: React.ReactNode }) {
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>(
    {}
  );

  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // 铃声状态
  const [ringtones, setRingtones] = useState<Ringtone[]>([DEFAULT_RINGTONE]);
  const [currentRingtoneId, setCurrentRingtoneId] = useState<string>("default");

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // --- 初始化加载 ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. 加载未读数
      const savedCounts = localStorage.getItem("unread_counts");
      if (savedCounts) {
        try {
          setUnreadCounts(JSON.parse(savedCounts));
        } catch (e) {}
      }

      // 2. 加载铃声和当前选中项
      try {
        const savedRingtonesStr = localStorage.getItem("custom_ringtones");
        const savedCurrentId = localStorage.getItem("current_ringtone_id");

        let loadedRingtones = [DEFAULT_RINGTONE];

        if (savedRingtonesStr) {
          const parsed = JSON.parse(savedRingtonesStr);
          // 过滤掉重复的 default
          const customOnly = parsed.filter((r: any) => r.id !== "default");
          loadedRingtones = [DEFAULT_RINGTONE, ...customOnly];
        }

        setRingtones(loadedRingtones);

        // 检查保存的 ID 是否依然有效
        if (savedCurrentId) {
          const exists = loadedRingtones.some((r) => r.id === savedCurrentId);
          if (exists) {
            setCurrentRingtoneId(savedCurrentId);
          } else {
            setCurrentRingtoneId("default");
            localStorage.setItem("current_ringtone_id", "default");
          }
        }
      } catch (e) {
        console.error("初始化铃声失败", e);
      }

      // 请求通知权限
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  // 自动保存未读数
  useEffect(() => {
    localStorage.setItem("unread_counts", JSON.stringify(unreadCounts));
  }, [unreadCounts]);

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // --- 铃声操作 ---
  const addRingtone = async (name: string, file: File) => {
    if (file.size > 3 * 1024 * 1024) {
      alert(
        "铃声文件过大(超过3MB)，无法保存到浏览器缓存中，请使用更小的文件。"
      );
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const newRingtone = {
          id: Date.now().toString(),
          name,
          url: base64,
        };

        try {
          const currentCustom = JSON.parse(
            localStorage.getItem("custom_ringtones") || "[]"
          );
          const newCustom = [...currentCustom, newRingtone];
          localStorage.setItem("custom_ringtones", JSON.stringify(newCustom));

          setRingtones((prev) => [...prev, newRingtone]);
          selectRingtone(newRingtone.id);

          resolve();
        } catch (err) {
          console.error(err);
          alert(
            "存储空间已满！浏览器无法保存更多铃声，请删除一些旧铃声后再试。"
          );
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const selectRingtone = (id: string) => {
    setCurrentRingtoneId(id);
    localStorage.setItem("current_ringtone_id", id);
  };

  const deleteRingtone = (id: string) => {
    if (id === "default") return;

    try {
      const currentCustom = JSON.parse(
        localStorage.getItem("custom_ringtones") || "[]"
      );
      const newCustom = currentCustom.filter((r: any) => r.id !== id);
      localStorage.setItem("custom_ringtones", JSON.stringify(newCustom));
    } catch (e) {}

    setRingtones((prev) => prev.filter((r) => r.id !== id));

    if (currentRingtoneId === id) {
      selectRingtone("default");
    }
  };

  const playCurrentRingtone = useCallback(() => {
    try {
      // 这里的 ringtones 和 currentRingtoneId 可能闭包过时，
      // 但对于简单的播放功能，直接从 state 读通常没问题。
      // 为了安全，我们再次尝试从 localStorage 兜底读一下 ID
      let targetId = currentRingtoneId;
      if (typeof window !== "undefined") {
        targetId = localStorage.getItem("current_ringtone_id") || "default";
      }

      const ringtone =
        ringtones.find((r) => r.id === targetId) || DEFAULT_RINGTONE;

      if (ringtone && ringtone.url) {
        const audio = new Audio(ringtone.url);
        audio.volume = 0.8;
        // 手机上必须用户交互才能播放音频，这在后台可能被阻塞
        // 加个 catch 防止红屏
        audio.play().catch((e) => console.warn("后台播放音频被拦截", e));
      }
    } catch (e) {
      console.warn("播放逻辑错误", e);
    }
  }, [ringtones, currentRingtoneId]);

  // --- 核心方法 ---
  const incrementUnread = useCallback(
    (id: string, content: string, count: number = 1) => {
      const chatId = String(id);
      const currentPath = pathnameRef.current;

      if (currentPath === `/chat/${chatId}`) {
        console.log(`[Unread] 正处于聊天窗口 ${chatId}，不显示红点`);
        return;
      }

      setUnreadCounts((prev) => {
        const newCount = (prev[chatId] || 0) + count;
        return { ...prev, [chatId]: newCount };
      });

      // 播放声音 (带容错)
      try {
        const contactsStr = localStorage.getItem("contacts");
        if (contactsStr) {
          const contacts = JSON.parse(contactsStr);
          const contact = contacts.find((c: any) => String(c.id) === chatId);
          const isAlertOn = contact ? contact.alertEnabled !== false : true;
          if (isAlertOn) {
            playCurrentRingtone();
          }
        }
      } catch (e) {
        console.error("读取联系人设置失败", e);
      }

      // 🔥 发送通知 (使用增强版函数，兼容手机)
      sendMobileNotification("新消息", content, chatId);
    },
    [playCurrentRingtone]
  );

  const clearUnread = (id: string) => {
    const chatId = String(id);
    setUnreadCounts((prev) => {
      if (!prev[chatId]) return prev;
      const newCounts = { ...prev };
      delete newCounts[chatId];
      return newCounts;
    });
  };

  return (
    <UnreadContext.Provider
      value={{
        unreadCounts,
        totalUnread,
        incrementUnread,
        clearUnread,
        ringtones,
        currentRingtoneId,
        addRingtone,
        selectRingtone,
        deleteRingtone,
        playCurrentRingtone,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
}

export const useUnread = () => {
  const context = useContext(UnreadContext);
  if (!context) throw new Error("useUnread error");
  return context;
};
