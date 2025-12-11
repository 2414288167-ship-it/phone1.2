"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
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

  // --- 初始化加载 (修复逻辑) ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      // 1. 加载未读数
      const savedCounts = localStorage.getItem("unread_counts");
      if (savedCounts) {
        try {
          setUnreadCounts(JSON.parse(savedCounts));
        } catch (e) {}
      }

      // 2. 加载铃声和当前选中项 (在一个流程里处理，防止状态不同步)
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

        // 检查保存的 ID 是否依然有效，如果无效则回退到 default
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

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // 自动保存未读数
  useEffect(() => {
    localStorage.setItem("unread_counts", JSON.stringify(unreadCounts));
  }, [unreadCounts]);

  // ❌ 核心修改：绝对不要在这里写 useEffect(() => save(currentRingtoneId))，会导致刷新页面时重置

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // --- 铃声操作 ---
  const addRingtone = async (name: string, file: File) => {
    // 限制文件大小 (例如 3MB)
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
          // 1. 先尝试保存到 localStorage，如果满了会报错
          const currentCustom = JSON.parse(
            localStorage.getItem("custom_ringtones") || "[]"
          );
          const newCustom = [...currentCustom, newRingtone];
          localStorage.setItem("custom_ringtones", JSON.stringify(newCustom));

          // 2. 如果保存成功，再更新 React 状态
          setRingtones((prev) => [...prev, newRingtone]);

          // 3. 自动选中并保存 ID
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
    // 🔥 手动保存，确保安全
    localStorage.setItem("current_ringtone_id", id);
  };

  const deleteRingtone = (id: string) => {
    if (id === "default") return;

    // 1. 更新 localStorage
    try {
      const currentCustom = JSON.parse(
        localStorage.getItem("custom_ringtones") || "[]"
      );
      const newCustom = currentCustom.filter((r: any) => r.id !== id);
      localStorage.setItem("custom_ringtones", JSON.stringify(newCustom));
    } catch (e) {}

    // 2. 更新状态
    setRingtones((prev) => prev.filter((r) => r.id !== id));

    // 3. 如果删的是当前选中的，回退到默认
    if (currentRingtoneId === id) {
      selectRingtone("default");
    }
  };

  const playCurrentRingtone = () => {
    try {
      const ringtone =
        ringtones.find((r) => r.id === currentRingtoneId) || DEFAULT_RINGTONE;
      if (ringtone && ringtone.url) {
        const audio = new Audio(ringtone.url);
        audio.volume = 0.8;
        audio.play().catch((e) => console.error("播放失败", e));
      }
    } catch (e) {}
  };

  const incrementUnread = (id: string, content: string, count: number = 1) => {
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
      console.error(e);
    }

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("新消息", { body: content, tag: chatId, silent: true });
    }
  };

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
