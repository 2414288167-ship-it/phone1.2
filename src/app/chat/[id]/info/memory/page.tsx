"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Trash2,
  ChevronRight,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
} from "lucide-react";

interface PageProps {
  params: { id: string };
}

// --- 组件：白色圆角卡片块 ---
const Section = ({ title, children, action }: any) => (
  <div className="mb-3">
    {title && (
      <div className="px-4 py-2 text-xs text-gray-500 flex justify-between items-center">
        <span>{title}</span>
        {action}
      </div>
    )}
    <div className="bg-white border-y border-gray-100 sm:border sm:rounded-lg sm:mx-2 overflow-hidden">
      {children}
    </div>
  </div>
);

// --- 组件：简单日历 ---
const MiniCalendar = ({
  year,
  month,
  periodDays,
}: {
  year: number;
  month: number;
  periodDays: Set<number>;
}) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="p-4 bg-white">
      <div className="flex justify-between mb-4 font-bold text-gray-800">
        <span>
          {year}年 {month + 1}月
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-400">
        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((d) => {
          const isPeriod = periodDays.has(d);
          return (
            <div
              key={d}
              className={`h-8 w-8 flex items-center justify-center rounded-full mx-auto ${
                isPeriod ? "bg-red-100 text-red-500 font-bold" : "text-gray-700"
              }`}
            >
              {d}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400 justify-end">
        <div className="w-3 h-3 bg-red-100 rounded-full"></div>
        <span>预测经期</span>
      </div>
    </div>
  );
};

// --- 类型定义 ---
interface MemoryItem {
  id: string;
  content: string;
  date: string;
}

interface MemoryGroup {
  id: string;
  title: string;
  items: MemoryItem[];
}

export default function MemoryPage({ params }: PageProps) {
  const router = useRouter();
  const conversationId = params?.id || "";

  // --- 数据状态 ---
  const [contact, setContact] = useState<any>(null);
  const [stats, setStats] = useState({
    wordCount: 0,
    dayCount: 0,
    userMsgCount: 0,
    aiMsgCount: 0,
  });

  // 1. 记忆类别
  const [userPreferences, setUserPreferences] = useState("");
  const [memoryGroups, setMemoryGroups] = useState<MemoryGroup[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    new Set()
  );

  // 2. 总结设置
  const [autoSummary, setAutoSummary] = useState(false);
  const [summaryThreshold, setSummaryThreshold] = useState(50);
  const [customSummaryPrompt, setCustomSummaryPrompt] = useState("");

  // 3. 生理周期
  const [menstrualData, setMenstrualData] = useState({
    lastDate: new Date().toISOString().split("T")[0],
    duration: 5,
    cycle: 28,
  });

  // --- 初始化加载 ---
  useEffect(() => {
    if (typeof window !== "undefined" && conversationId) {
      // 1. 加载聊天记录统计
      const msgsStr = localStorage.getItem(`chat_${conversationId}`);
      if (msgsStr) {
        const msgs = JSON.parse(msgsStr);
        let userC = 0,
          aiC = 0,
          words = 0;
        const uniqueDays = new Set();
        msgs.forEach((m: any) => {
          if (m.role === "user") userC++;
          else aiC++;
          if (m.content) words += m.content.length;
          uniqueDays.add(new Date(m.timestamp).toDateString());
        });
        setStats({
          wordCount: words,
          dayCount: uniqueDays.size,
          userMsgCount: userC,
          aiMsgCount: aiC,
        });
      }

      // 2. 加载联系人设置
      const contactsStr = localStorage.getItem("contacts");
      if (contactsStr) {
        const contacts = JSON.parse(contactsStr);
        const current = contacts.find(
          (c: any) => String(c.id) === String(conversationId)
        );
        if (current) {
          setContact(current);
          setUserPreferences(current.userPreferences || "");

          let rawMemories = current.permanentMemory || [];
          let processedGroups: MemoryGroup[] = [];

          if (
            Array.isArray(rawMemories) &&
            rawMemories.length > 0 &&
            !rawMemories[0].items
          ) {
            processedGroups = [
              {
                id: "default_group",
                title: "默认分组",
                items: rawMemories,
              },
            ];
            saveData({ permanentMemory: processedGroups }, current.id);
          } else {
            processedGroups = rawMemories;
          }

          if (processedGroups.length === 0) {
            processedGroups = [
              { id: "default_group", title: "未分类收藏", items: [] },
            ];
          }

          setMemoryGroups(processedGroups);
          if (processedGroups.length > 0) {
            setExpandedGroupIds(new Set([processedGroups[0].id]));
          }

          setAutoSummary(current.autoSummary || false);
          setSummaryThreshold(current.summaryThreshold || 50);
          setCustomSummaryPrompt(current.customSummaryPrompt || "");

          if (current.menstrualData) {
            setMenstrualData(current.menstrualData);
          }
        }
      }
    }
  }, [conversationId]);

  // --- 保存逻辑 ---
  const saveData = (updatedFields: any, targetId = conversationId) => {
    if (typeof window !== "undefined") {
      const contactsStr = localStorage.getItem("contacts");
      if (contactsStr) {
        const contacts = JSON.parse(contactsStr);
        const updatedContacts = contacts.map((c: any) =>
          String(c.id) === String(targetId) ? { ...c, ...updatedFields } : c
        );
        localStorage.setItem("contacts", JSON.stringify(updatedContacts));
      }
    }
  };

  const updateMenstrual = (key: string, val: any) => {
    const newData = { ...menstrualData, [key]: val };
    setMenstrualData(newData);
    saveData({ menstrualData: newData });
  };

  const calculatePeriodDays = () => {
    const start = new Date(menstrualData.lastDate);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const daysSet = new Set<number>();
    let tempDate = new Date(start);
    while (
      tempDate.getFullYear() < currentYear ||
      (tempDate.getFullYear() === currentYear &&
        tempDate.getMonth() <= currentMonth + 1)
    ) {
      if (
        tempDate.getMonth() === currentMonth &&
        tempDate.getFullYear() === currentYear
      ) {
        for (let i = 0; i < menstrualData.duration; i++) {
          daysSet.add(tempDate.getDate() + i);
        }
      }
      tempDate.setDate(
        tempDate.getDate() + parseInt(String(menstrualData.cycle))
      );
    }
    return daysSet;
  };

  // --- 记忆分组操作 ---
  const toggleGroup = (groupId: string) => {
    const newSet = new Set(expandedGroupIds);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setExpandedGroupIds(newSet);
  };

  const addGroup = () => {
    const name = prompt("请输入新分组名称：", "新分组");
    if (name) {
      const newGroup: MemoryGroup = {
        id: Date.now().toString(),
        title: name,
        items: [],
      };
      const newGroups = [...memoryGroups, newGroup];
      setMemoryGroups(newGroups);
      saveData({ permanentMemory: newGroups });
      setExpandedGroupIds((prev) => new Set(prev).add(newGroup.id));
    }
  };

  const deleteGroup = (groupId: string) => {
    if (confirm("确定删除该分组及其所有记忆吗？")) {
      const newGroups = memoryGroups.filter((g) => g.id !== groupId);
      setMemoryGroups(newGroups);
      saveData({ permanentMemory: newGroups });
    }
  };

  const addItemToGroup = (groupId: string) => {
    const content = prompt("添加一条记忆：");
    if (content) {
      const newGroups = memoryGroups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            items: [
              ...g.items,
              {
                id: Date.now().toString(),
                content,
                date: new Date().toISOString(),
              },
            ],
          };
        }
        return g;
      });
      setMemoryGroups(newGroups);
      saveData({ permanentMemory: newGroups });
    }
  };

  const deleteItemFromGroup = (groupId: string, itemId: string) => {
    if (confirm("删除这条记忆？")) {
      const newGroups = memoryGroups.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            items: g.items.filter((i) => i.id !== itemId),
          };
        }
        return g;
      });
      setMemoryGroups(newGroups);
      saveData({ permanentMemory: newGroups });
    }
  };

  // 🔥🔥🔥 核心修改：手动触发/模拟自动总结 🔥🔥🔥
  const handleManualSummarize = () => {
    if (!contact?.worldBook) {
      alert("该角色未关联世界书，无法生成总结。");
      return;
    }
    const worldBookId = contact.worldBook;
    const summaryBookId = `${worldBookId}_summary_auto`; // 👈 必须与导入时一致

    // 1. 获取世界书数据
    const wbStr = localStorage.getItem("worldbook_data");
    if (!wbStr) return;
    const wbData = JSON.parse(wbStr);

    // 2. 查找目标条目
    const bookIndex = wbData.books.findIndex(
      (b: any) => b.id === summaryBookId
    );

    if (bookIndex === -1) {
      alert("未找到‘前情概要’条目，可能是旧数据或已被删除。");
      return;
    }

    // 3. 模拟生成总结 (实际应调用 LLM)
    const newSummary = `[${new Date().toLocaleDateString()} 自动总结]\n根据最近的聊天记录，${
      contact.name
    } 与用户的关系更进了一步... (此为模拟生成的总结内容)`;

    // 4. 更新内容
    const oldContent = wbData.books[bookIndex].content[0].content;
    wbData.books[bookIndex].content[0].content =
      oldContent + "\n\n" + newSummary;

    localStorage.setItem("worldbook_data", JSON.stringify(wbData));
    alert("已根据当前设定，生成了一段新总结并写入世界书！");
  };

  // 🔥🔥🔥 核心修改：跳转到世界书前情概要 🔥🔥🔥
  const handleViewHistory = () => {
    if (contact && contact.worldBook) {
      // 构造目标 URL：携带分类 ID 和 书籍 ID
      const summaryBookId = `${contact.worldBook}_summary_auto`;
      router.push(`/notes?catId=${contact.worldBook}&bookId=${summaryBookId}`);
    } else {
      alert("该角色暂未关联世界书或前情概要模块。");
    }
  };

  if (!contact) return <div className="bg-[#f5f5f5] h-screen"></div>;

  return (
    <div className="flex flex-col min-h-screen bg-[#ededed] text-gray-900 pb-10">
      <header className="h-14 flex items-center justify-between px-2 bg-[#ededed] border-b border-gray-200 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-900 flex items-center gap-1"
        >
          <ChevronLeft className="w-5 h-5" />
          <span>返回</span>
        </button>
        <h1 className="text-base font-medium">记忆管理</h1>
        <div className="w-10"></div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* 头像与统计 */}
        <div className="flex flex-col items-center py-6 bg-[#ededed]">
          <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shadow-sm mb-2">
            <img
              src={contact.avatar || "🐱"}
              className="w-full h-full object-cover"
              alt="avatar"
            />
          </div>
          <h2 className="font-bold text-lg mb-4">{contact.name}</h2>

          <div className="grid grid-cols-2 gap-3 w-full px-4">
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <div className="text-xl font-bold text-gray-800">
                {stats.wordCount}
              </div>
              <div className="text-xs text-gray-400">聊天字数</div>
            </div>
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <div className="text-xl font-bold text-gray-800">
                {stats.dayCount}
              </div>
              <div className="text-xs text-gray-400">相伴天数</div>
            </div>
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <div className="text-xl font-bold text-blue-500">
                {stats.userMsgCount}
              </div>
              <div className="text-xs text-gray-400">我发送</div>
            </div>
            <div className="bg-white p-3 rounded-lg text-center shadow-sm">
              <div className="text-xl font-bold text-green-500">
                {stats.aiMsgCount}
              </div>
              <div className="text-xs text-gray-400">{contact.name}发送</div>
            </div>
          </div>
        </div>

        {/* 1. 用户喜好 */}
        <Section title="用户画像 (喜好与雷点)">
          <textarea
            className="w-full h-32 p-4 text-sm bg-white outline-none resize-none"
            placeholder="在此输入你的喜好、讨厌的事物，或希望AI记住的关于你的设定..."
            value={userPreferences}
            onChange={(e) => {
              setUserPreferences(e.target.value);
              saveData({ userPreferences: e.target.value });
            }}
          />
        </Section>

        {/* 2. 永久记忆分组 */}
        <Section
          title={`永久记忆分组 (${memoryGroups.length})`}
          action={
            <button
              onClick={addGroup}
              className="text-[#07c160] text-xs font-medium flex items-center gap-0.5 px-2 py-1 bg-green-50 rounded"
            >
              <FolderPlus className="w-3.5 h-3.5" /> 新建分组
            </button>
          }
        >
          {memoryGroups.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              暂无记忆，请点击右上角新建分组
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {memoryGroups.map((group) => {
                const isExpanded = expandedGroupIds.has(group.id);
                return (
                  <div key={group.id} className="bg-white">
                    {/* 分组标题栏 */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-sm font-medium text-gray-800">
                          {group.title}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 rounded-full">
                          {group.items.length}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => addItemToGroup(group.id)}
                          className="p-1.5 text-gray-400 hover:text-[#07c160]"
                          title="添加条目"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteGroup(group.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500"
                          title="删除分组"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 分组内容列表 */}
                    {isExpanded && (
                      <div className="bg-gray-50/50 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                        {group.items.length === 0 ? (
                          <div className="p-3 pl-9 text-xs text-gray-400">
                            该分组下暂无记忆
                          </div>
                        ) : (
                          group.items.map((item) => (
                            <div
                              key={item.id}
                              className="flex justify-between items-start py-2.5 pr-3 pl-9 border-b border-gray-100 last:border-0 hover:bg-gray-100/50 group/item"
                            >
                              <div className="flex gap-2 items-start">
                                <FileText className="w-3 h-3 text-gray-300 mt-1 shrink-0" />
                                <span className="text-sm text-gray-700 leading-relaxed">
                                  {item.content}
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  deleteItemFromGroup(group.id, item.id)
                                }
                                className="text-gray-300 hover:text-red-500 p-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* 3. 剧情总结 */}
        <Section title="剧情总结管理">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm">自动总结</span>
            <div
              onClick={() => {
                setAutoSummary(!autoSummary);
                saveData({ autoSummary: !autoSummary });
              }}
              className={`w-10 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                autoSummary ? "bg-[#07c160]" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  autoSummary ? "translate-x-4" : ""
                }`}
              />
            </div>
          </div>

          {autoSummary && (
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <span className="text-sm">触发阈值 (条消息)</span>
              <input
                type="number"
                className="w-16 text-right bg-gray-100 rounded px-1 outline-none text-sm"
                value={summaryThreshold}
                onChange={(e) => {
                  setSummaryThreshold(Number(e.target.value));
                  saveData({ summaryThreshold: Number(e.target.value) });
                }}
              />
            </div>
          )}

          <div className="px-4 py-3 border-b border-gray-100">
            <div className="text-sm mb-2">总结提示词 (System Prompt)</div>
            <textarea
              className="w-full h-20 bg-gray-50 rounded p-2 text-xs outline-none resize-none border border-gray-200"
              placeholder="例如：请总结以上对话的重点剧情，注意人物的情感变化..."
              value={customSummaryPrompt}
              onChange={(e) => {
                setCustomSummaryPrompt(e.target.value);
                saveData({ customSummaryPrompt: e.target.value });
              }}
            />
          </div>

          {/* 🔥 模拟手动触发总结（演示用） */}
          {autoSummary && (
            <div
              className="px-4 py-3 border-b border-gray-100 flex justify-between items-center active:bg-gray-50 cursor-pointer"
              onClick={handleManualSummarize}
            >
              <span className="text-sm text-blue-500">⚡ 立即执行一次总结</span>
              <Sparkles className="w-4 h-4 text-blue-500" />
            </div>
          )}

          <div
            className="px-4 py-3 flex justify-between items-center active:bg-gray-50 cursor-pointer"
            onClick={handleViewHistory}
          >
            <span className="text-sm">查看历史总结 (跳转至世界书)</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        </Section>

        {/* 4. 生理周期 */}
        <Section title="生理周期 (AI将主动关怀)">
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-600">上次开始时间</span>
            <input
              type="date"
              className="text-sm bg-transparent outline-none text-right font-medium"
              value={menstrualData.lastDate}
              onChange={(e) => updateMenstrual("lastDate", e.target.value)}
            />
          </div>
          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm text-gray-600">持续天数</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-12 text-right text-sm bg-transparent outline-none font-medium"
                value={menstrualData.duration}
                onChange={(e) =>
                  updateMenstrual("duration", Number(e.target.value))
                }
              />
              <span className="text-xs text-gray-400">天</span>
            </div>
          </div>
          <div className="px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-gray-600">周期长度</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="w-12 text-right text-sm bg-transparent outline-none font-medium"
                value={menstrualData.cycle}
                onChange={(e) =>
                  updateMenstrual("cycle", Number(e.target.value))
                }
              />
              <span className="text-xs text-gray-400">天</span>
            </div>
          </div>

          <div className="border-t border-gray-100">
            <MiniCalendar
              year={new Date().getFullYear()}
              month={new Date().getMonth()}
              periodDays={calculatePeriodDays()}
            />
          </div>

          <div className="px-4 py-2 bg-yellow-50 text-[10px] text-yellow-600 leading-tight">
            *
            开启后，AI会在预测经期前后主动询问身体状况，并在回复中增加安抚性内容。
          </div>
        </Section>

        <div className="h-10 text-center text-xs text-gray-400 mt-4">
          记忆模块运行中
        </div>
      </div>
    </div>
  );
}
