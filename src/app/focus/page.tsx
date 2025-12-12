"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Settings2,
  Plus,
  Trash2,
  Check,
  Trophy,
  Hourglass,
  CalendarDays,
  List,
  Share2,
  X, // 🔥 新增关闭图标
  User, // 🔥 新增默认头像图标
} from "lucide-react";

// --- 类型定义 ---
type TaskType = "u-i" | "u-ni" | "nu-i" | "nu-ni";
type TimerMode = "countdown" | "countup";
type TabType = "timer" | "tasks" | "summary";

interface Task {
  id: string;
  text: string;
  done: boolean;
  type: TaskType;
  completedAt?: number;
}

// 🔥 新增联系人接口
interface Contact {
  id: string;
  name: string;
  avatar: string;
  remark?: string;
}

// --- 存储 Key ---
const STORAGE_KEY_TASKS = "my_focus_tasks";
const STORAGE_KEY_TODAY = "my_focus_today_record";
const STORAGE_KEY_TOTAL = "my_focus_total_time";

// --- 🎨 图标组件 ---
const CatEarIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path
      d="M20,60 Q10,20 40,30 L60,30 Q90,20 80,60"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const PawPrint = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className || "w-6 h-6 fill-current"}>
    <path d="M50 45c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14zm-28 8c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14zm56 0c-8 0-14-6-14-14s6-14 14-14 14 6 14 14-6 14-14 14zm-13 18c-5 0-18 6-18 20 0 5 8 10 13 10s18-12 25-20c-5-8-15-10-20-10zm-30 0c-5 0-15 2-20 10 7 8 20 20 25 20s13-5 13-10c0-14-13-20-18-20z" />
  </svg>
);

// 四象限配置
const TYPE_CONFIG = {
  "u-i": {
    label: "🔥 马上做 (紧急重要)",
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-600",
    bar: "bg-rose-400",
  },
  "nu-i": {
    label: "📅 计划做 (重要不紧急)",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-600",
    bar: "bg-blue-400",
  },
  "u-ni": {
    label: "⚡ 授权做 (紧急不重要)",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-600",
    bar: "bg-orange-400",
  },
  "nu-ni": {
    label: "☕ 以后做 (不重要不紧急)",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-600",
    bar: "bg-emerald-400",
  },
};

// 关键修复：标记为动态路由，解决 useSearchParams 预渲染报错
export const dynamic = "force-dynamic";

export default function FocusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- 状态 ---
  const [activeTab, setActiveTab] = useState<TabType>("timer");
  const [tasks, setTasks] = useState<Task[]>([]);

  // 🔥 新增：分享备注文字状态
  const [shareNote, setShareNote] = useState("");

  // 计时器设置
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [cycles, setCycles] = useState(4);
  const [timerMode, setTimerMode] = useState<TimerMode>("countdown");

  // 计时器运行
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [countUpTime, setCountUpTime] = useState(0);

  // 统计
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [todayDateStr, setTodayDateStr] = useState("");

  // UI 状态
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskType, setNewTaskType] = useState<TaskType>("u-i");
  const [showSettingModal, setShowSettingModal] = useState(false);

  // 🔥 新增：联系人选择弹窗状态
  const [showShareModal, setShowShareModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // 提取已完成任务
  const finishedTasks = tasks.filter((t) => t.done);
  const unfinishedTasks = tasks.filter((t) => !t.done);
  const tasksByType = {
    "u-i": tasks.filter((t) => t.type === "u-i" && !t.done),
    "nu-i": tasks.filter((t) => t.type === "nu-i" && !t.done),
    "u-ni": tasks.filter((t) => t.type === "u-ni" && !t.done),
    "nu-ni": tasks.filter((t) => t.type === "nu-ni" && !t.done),
  };

  // 🔥 新增：仅筛选【今天】完成的任务
  const todayFinishedTasks = tasks.filter((t) => {
    if (!t.done || !t.completedAt) return false;
    const taskDate = new Date(t.completedAt).toDateString();
    const todayDate = new Date().toDateString();
    return taskDate === todayDate;
  });

  // --- 加载与保存 ---
  useEffect(() => {
    const loadedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
    if (loadedTasks) setTasks(JSON.parse(loadedTasks));

    const loadedTotal = localStorage.getItem(STORAGE_KEY_TOTAL);
    if (loadedTotal) setTotalSeconds(Number(loadedTotal));

    const nowStr = new Date().toDateString();
    setTodayDateStr(nowStr);
    const loadedToday = localStorage.getItem(STORAGE_KEY_TODAY);
    if (loadedToday) {
      const { date, seconds } = JSON.parse(loadedToday);
      if (date === nowStr) setTodaySeconds(seconds);
      else setTodaySeconds(0);
    }

    // 🔥 加载联系人列表
    const contactsStr = localStorage.getItem("contacts");
    if (contactsStr) {
      try {
        setContacts(JSON.parse(contactsStr));
      } catch (e) {
        console.error("加载联系人失败", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    window.dispatchEvent(new Event("local-storage-update"));
  }, [tasks]);

  useEffect(() => {
    if (todayDateStr)
      localStorage.setItem(
        STORAGE_KEY_TODAY,
        JSON.stringify({ date: todayDateStr, seconds: todaySeconds })
      );
  }, [todaySeconds, todayDateStr]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOTAL, String(totalSeconds));
  }, [totalSeconds]);

  // 处理 URL 自动开始参数
  useEffect(() => {
    const auto = searchParams.get("auto");
    if (auto === "1") {
      const pWork = Number(searchParams.get("work")) || 25;
      const pBreak = Number(searchParams.get("break")) || 5;
      const pCycles = Number(searchParams.get("cycles")) || 4;
      const pTask = searchParams.get("task");

      setWorkDuration(pWork);
      setBreakDuration(pBreak);
      setCycles(pCycles);

      if (pTask && !tasks.some((t) => t.text === pTask)) {
        const newTask = {
          id: Date.now().toString(),
          text: decodeURIComponent(pTask),
          done: false,
          type: "u-i" as TaskType,
        };
        setTasks((prev) => [...prev, newTask]);
      }

      setActiveTab("timer");
      setTimeLeft(pWork * 60);
      setIsActive(true);
      router.replace("/focus");
    }
  }, [searchParams]);

  // --- 计时器逻辑 ---
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        if (!isBreak) {
          setTodaySeconds((s) => s + 1);
          setTotalSeconds((s) => s + 1);
        }
        if (timerMode === "countup") {
          setCountUpTime((t) => t + 1);
        } else {
          setTimeLeft((time) => {
            if (time <= 0) {
              if (isBreak) {
                setIsBreak(false);
                if (currentCycle < cycles) {
                  setCurrentCycle((c) => c + 1);
                  return workDuration * 60;
                } else {
                  setIsActive(false);
                  return 0;
                }
              } else {
                setIsBreak(true);
                return breakDuration * 60;
              }
            }
            return time - 1;
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [
    isActive,
    isBreak,
    currentCycle,
    cycles,
    workDuration,
    breakDuration,
    timerMode,
  ]);

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setCurrentCycle(1);
    setTimeLeft(workDuration * 60);
    setCountUpTime(0);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // 🔥 修改：点击分享按钮只打开弹窗
  const handleShareClick = () => {
    setShowShareModal(true);
  };

  // 🔥 新增：确认分享给指定联系人
  const confirmShare = (contactId: string) => {
    const shareData = {
      type: "focus_share",
      totalSeconds: totalSeconds,
      taskName:
        // 记得这里建议用上次修复后的 todayFinishedTasks
        finishedTasks.length > 0
          ? `完成了 ${finishedTasks.length} 个任务`
          : "进行了深度专注",
      timestamp: Date.now(),
      remark: shareNote, // 🔥 这里把备注带上！
    };

    // 1. 存入待发送数据
    localStorage.setItem("pending_share_message", JSON.stringify(shareData));

    // 2. 跳转到选定的聊天
    router.push(`/chat/${contactId}`);

    // 3. (可选) 清空备注，防止下次打开还在
    setShareNote("");
  };
  // --- 任务操作 ---
  const addTask = () => {
    if (!newTaskText.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      text: newTaskText,
      done: false,
      type: newTaskType,
    };
    setTasks([...tasks, newTask]);
    setNewTaskText("");
    setShowTaskModal(false);
  };

  const toggleTask = (id: string) => {
    setTasks(
      tasks.map((t) => {
        if (t.id === id) {
          const isDone = !t.done;
          return {
            ...t,
            done: isDone,
            // 🔥如果是标记完成，记录当前时间；如果是取消完成，清空时间
            completedAt: isDone ? Date.now() : undefined,
          };
        }
        return t;
      })
    );
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-slate-700 pb-28 relative overflow-hidden font-sans selection:bg-rose-200">
      {/* 🌈 背景光晕 */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 bg-rose-200/40 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-[10%] right-[-10%] w-80 h-80 bg-blue-200/40 rounded-full blur-3xl animate-pulse-slow delay-700" />
      <div className="absolute top-[20%] right-[10%] w-40 h-40 bg-yellow-200/40 rounded-full blur-3xl" />

      {/* 顶部导航 */}
      <div className="flex items-center justify-between p-6 relative z-10">
        <Link
          href="/"
          className="w-10 h-10 bg-white shadow-sm rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-lg font-bold text-slate-700 tracking-tight flex items-center gap-2">
          <PawPrint className="w-5 h-5 fill-slate-700" />
          <span>Meow Focus</span>
        </div>
        <button
          onClick={() => setShowSettingModal(true)}
          className="w-10 h-10 bg-white shadow-sm rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all text-slate-500"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 relative z-10">
        {/* === Tab 1: 计时器 === */}
        {activeTab === "timer" && (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
            <div
              className={`mt-2 px-6 py-2 rounded-full border-2 text-sm font-bold shadow-sm transition-colors duration-500 flex items-center gap-2 ${
                isActive
                  ? "bg-rose-50 border-rose-200 text-rose-500"
                  : "bg-white border-slate-100 text-slate-400"
              }`}
            >
              {timerMode === "countup"
                ? "⏱️ 正计时"
                : isBreak
                ? "💤 休息一下"
                : "🍅 专注中..."}
            </div>

            <div className="relative w-72 h-72 mt-8 flex items-center justify-center">
              <div className="absolute -top-6 w-full text-slate-200">
                <CatEarIcon className="w-full h-24" />
              </div>
              <div className="absolute inset-0 rounded-full bg-white shadow-[0_10px_40px_rgba(0,0,0,0.05)]" />
              <div
                className={`absolute inset-4 rounded-full border-[12px] border-slate-100 transition-all duration-700 ${
                  isActive
                    ? "border-t-rose-300 border-r-rose-200 rotate-180"
                    : ""
                }`}
              />
              <div className="relative z-10 flex flex-col items-center">
                <span className="text-6xl font-black text-slate-700 tracking-tighter tabular-nums drop-shadow-sm">
                  {timerMode === "countup"
                    ? formatTime(countUpTime)
                    : formatTime(timeLeft)}
                </span>
                <span className="text-slate-400 text-sm font-medium mt-2 bg-slate-100 px-3 py-1 rounded-full">
                  第 {currentCycle} / {cycles} 轮
                </span>
              </div>
            </div>

            <div className="flex items-center gap-8 mt-12">
              <button
                onClick={toggleTimer}
                className={`w-20 h-20 rounded-[2.5rem] flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-90 active:rotate-3 ${
                  isActive
                    ? "bg-amber-100 text-amber-500"
                    : "bg-gradient-to-tr from-rose-400 to-pink-400 text-white"
                }`}
              >
                {isActive ? (
                  <div className="flex gap-1 h-6">
                    <div className="w-2 bg-amber-500 rounded-full animate-bounce" />
                    <div className="w-2 bg-amber-500 rounded-full animate-bounce delay-75" />
                  </div>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-8 h-8 fill-current ml-1"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                onClick={resetTimer}
                className="w-14 h-14 bg-white text-slate-400 rounded-full shadow-lg flex items-center justify-center hover:text-slate-600 active:scale-90 transition"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>

            <div
              className="mt-12 text-center"
              onClick={() => setActiveTab("summary")}
            >
              <div className="inline-flex items-center gap-2 bg-white/50 backdrop-blur px-4 py-2 rounded-2xl text-xs text-slate-400 cursor-pointer hover:bg-white transition">
                <Trophy className="w-3 h-3 text-yellow-500" />
                今日已专注 {formatDuration(todaySeconds)}
              </div>
            </div>
          </div>
        )}

        {/* === Tab 2: 任务四象限 === */}
        {activeTab === "tasks" && (
          <div className="animate-in slide-in-from-right-8 duration-300 pb-10">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-3xl font-black text-slate-700">My Plans</h2>
                <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                  <span>✨ 每一件小事都重要</span>
                </div>
              </div>
              <button
                onClick={() => setShowTaskModal(true)}
                className="bg-slate-800 text-white w-12 h-12 rounded-2xl shadow-lg shadow-slate-200 flex items-center justify-center active:scale-90 transition hover:rotate-90 duration-300"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {(Object.keys(TYPE_CONFIG) as TaskType[]).map((typeKey) => {
                const config = TYPE_CONFIG[typeKey];
                const typeTasks = tasksByType[typeKey];
                return (
                  <div
                    key={typeKey}
                    className={`rounded-[1.5rem] overflow-hidden border ${config.border} bg-white shadow-sm`}
                  >
                    <div
                      className={`${config.bg} px-4 py-3 flex justify-between items-center border-b ${config.border}`}
                    >
                      <div
                        className={`font-bold text-sm ${config.text} flex items-center gap-2`}
                      >
                        {config.label}
                      </div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/50 ${config.text}`}
                      >
                        {typeTasks.length}
                      </span>
                    </div>
                    <div className="p-2">
                      {typeTasks.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-300">
                          暂无任务
                        </div>
                      ) : (
                        typeTasks.map((task) => (
                          <div
                            key={task.id}
                            className="group flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"
                          >
                            <button
                              onClick={() => toggleTask(task.id)}
                              className={`w-5 h-5 rounded-md border-[2px] flex items-center justify-center transition-colors ${config.border} hover:bg-slate-100`}
                            >
                              <div className="w-0 h-0" />
                            </button>
                            <span className="flex-1 text-sm text-slate-600 font-medium truncate">
                              {task.text}
                            </span>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="text-slate-200 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}

              {/* 已完成任务 */}
              {finishedTasks.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                    <span className="text-xs font-bold text-slate-300">
                      已完成 ({finishedTasks.length})
                    </span>
                    <div className="h-[1px] bg-slate-200 flex-1"></div>
                  </div>
                  <div className="space-y-2 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300">
                    {finishedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-slate-100 rounded-xl p-3 flex items-center gap-3"
                      >
                        <Check className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-400 line-through text-xs flex-1 truncate">
                          {task.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Tab 3: 战报 === */}
        {activeTab === "summary" && (
          <div className="animate-in slide-in-from-right-8 duration-300">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-3xl font-black text-slate-700">Summary</h2>
                <p className="text-slate-400 text-sm mb-6">
                  查看你的成就记录 🐾
                </p>
              </div>
              <button
                onClick={handleShareClick}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-transform"
              >
                <Share2 className="w-4 h-4" />
                分享给 AI
              </button>
            </div>

            <div className="bg-gradient-to-br from-rose-400 to-pink-500 rounded-[2rem] p-6 text-white shadow-xl shadow-rose-200 mb-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <Hourglass className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-rose-100 text-sm font-bold mb-1">
                  <CalendarDays className="w-4 h-4" />
                  <span>今日专注时长</span>
                </div>
                <div className="text-5xl font-black tracking-tight mb-2">
                  {Math.floor(todaySeconds / 3600)}
                  <span className="text-2xl font-medium opacity-80">h</span>
                  {Math.floor((todaySeconds % 3600) / 60)}
                  <span className="text-2xl font-medium opacity-80">m</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between h-40">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center mb-2">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-700">
                    {Math.floor(totalSeconds / 3600)}h
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    累计专注
                  </div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-50 flex flex-col justify-between h-40">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-500 flex items-center justify-center mb-2">
                  <Check className="w-6 h-6 stroke-[3px]" />
                </div>
                <div>
                  {/* 🔥 修改这里：使用 todayFinishedTasks.length */}
                  <div className="text-2xl font-black text-slate-700">
                    {todayFinishedTasks.length}个
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    今日完成
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部导航栏 */}
      <div className="fixed bottom-6 w-full max-w-sm left-1/2 -translate-x-1/2 px-4 z-40">
        <div className="bg-white/90 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgba(0,0,0,0.1)] rounded-[2rem] h-16 flex items-center justify-evenly">
          <button
            onClick={() => setActiveTab("timer")}
            className={`flex flex-col items-center gap-0.5 w-16 transition-colors ${
              activeTab === "timer" ? "text-slate-800" : "text-slate-300"
            }`}
          >
            <PawPrint className="w-6 h-6" />
            <span className="text-[10px] font-bold">计时</span>
          </button>
          <div className="w-[1px] h-8 bg-slate-100"></div>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex flex-col items-center gap-0.5 w-16 transition-colors ${
              activeTab === "tasks" ? "text-slate-800" : "text-slate-300"
            }`}
          >
            <List className="w-6 h-6" />
            <span className="text-[10px] font-bold">清单</span>
          </button>
          <div className="w-[1px] h-8 bg-slate-100"></div>
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex flex-col items-center gap-0.5 w-16 transition-colors ${
              activeTab === "summary" ? "text-slate-800" : "text-slate-300"
            }`}
          >
            <Trophy className="w-6 h-6" />
            <span className="text-[10px] font-bold">战报</span>
          </button>
        </div>
      </div>

      {/* 弹窗：新建任务 */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom-20 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-700">新任务 ✨</h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="bg-slate-100 p-2 rounded-full text-slate-400 hover:bg-slate-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 stroke-current stroke-2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              className="w-full bg-slate-50 text-slate-700 font-bold text-lg rounded-2xl px-4 py-4 mb-6 outline-none border-2 border-transparent focus:border-rose-200 focus:bg-white transition-all placeholder:text-slate-300"
              placeholder="写下要做的事..."
              autoFocus
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
            />
            <div className="grid grid-cols-1 gap-2 mb-6">
              {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setNewTaskType(key as TaskType)}
                  className={`text-sm py-3 px-4 rounded-xl border transition-all flex items-center justify-between
                  ${
                    newTaskType === key
                      ? `${config.bg} ${config.border} ${config.text} font-bold ring-2 ring-offset-1 ring-slate-200`
                      : "bg-white border-slate-100 text-slate-400"
                  }`}
                >
                  <span>{config.label}</span>
                  {newTaskType === key && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <button
              onClick={addTask}
              className="w-full py-4 bg-slate-800 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 active:scale-95 transition-transform"
            >
              确认添加
            </button>
          </div>
        </div>
      )}

      {/* 弹窗：设置 */}
      {showSettingModal && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-700 mb-6 text-center">
              专注设置 ⚙️
            </h3>
            <div className="bg-slate-50 rounded-2xl p-1 flex mb-6">
              <button
                onClick={() => setTimerMode("countdown")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  timerMode === "countdown"
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-400"
                }`}
              >
                倒计时
              </button>
              <button
                onClick={() => setTimerMode("countup")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                  timerMode === "countup"
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-400"
                }`}
              >
                正计时
              </button>
            </div>
            {timerMode === "countdown" && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                    <span>专注时长</span>
                    <span className="text-rose-400">{workDuration} min</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={workDuration}
                    onChange={(e) => setWorkDuration(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                    <span>休息时长</span>
                    <span className="text-blue-400">{breakDuration} min</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={breakDuration}
                    onChange={(e) => setBreakDuration(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm font-bold text-slate-600 mb-2">
                    <span>循环轮数</span>
                    <span className="text-purple-400">{cycles} 轮</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={cycles}
                    onChange={(e) => setCycles(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-400"
                  />
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setShowSettingModal(false);
                resetTimer();
              }}
              className="w-full mt-8 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-200"
            >
              好啦
            </button>
          </div>
        </div>
      )}

      {/* 🔥 新增：分享联系人选择弹窗 */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col max-h-[80vh]">
            {" "}
            {/* 注意 max-h 改稍微大一点 */}
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-xl font-black text-slate-700">
                分享给谁? 💌
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="bg-slate-100 p-2 rounded-full text-slate-400 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* 🔥🔥🔥 新增：备注输入框开始 🔥🔥🔥 */}
            <div className="mb-4 shrink-0">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 focus-within:border-rose-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-rose-100 transition-all">
                <textarea
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                  placeholder="写句备注一起发给 AI 吧..."
                  className="w-full bg-transparent text-sm font-medium text-slate-700 placeholder:text-slate-400 outline-none resize-none h-16"
                />
              </div>
            </div>
            {/* 🔥🔥🔥 新增：备注输入框结束 🔥🔥🔥 */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {contacts.length === 0 ? (
                // ... (保持原有代码不变)
                <div className="text-center py-10 text-slate-400 text-sm">
                  没有找到联系人...
                </div>
              ) : (
                contacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => confirmShare(contact.id)}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 active:scale-98 transition cursor-pointer border border-transparent hover:border-slate-100 group"
                  >
                    {/* ... (头像部分保持不变) ... */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 shrink-0 border border-slate-100">
                      {contact.avatar ? (
                        <img
                          src={contact.avatar}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-700 truncate">
                        {contact.remark || contact.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate group-hover:text-rose-400 transition-colors">
                        {shareNote ? "点击发送带备注的战报" : "点击分享战报"}
                      </div>
                    </div>

                    {/* ... (箭头图标保持不变) ... */}
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-500 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
