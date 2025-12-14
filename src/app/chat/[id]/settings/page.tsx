"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";

// --- 类型定义 ---
interface PageProps {
  params: Promise<{ id: string }>;
}

interface ScheduleTask {
  id: string;
  time: string;
  type: "once" | "daily";
  enabled: boolean;
}

interface WorldBookCategory {
  id: number;
  name: string;
}

// 对应个人主页的数据结构
interface UserProfile {
  personas: {
    id: string;
    name: string;
    description: string;
  }[];
}

// --- 辅助组件 ---
const Section = ({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) => (
  <div className="mb-4">
    {title && <div className="px-4 py-2 text-xs text-gray-500">{title}</div>}
    <div className="bg-white px-4 py-1 rounded-xl overflow-hidden shadow-sm">
      {children}
    </div>
  </div>
);

const SwitchItem = ({ label, desc, value, onChange }: any) => (
  <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-none">
    <div className="flex flex-col">
      <span className="text-base text-gray-900">{label}</span>
      {desc && <span className="text-xs text-gray-400 mt-0.5">{desc}</span>}
    </div>
    <div
      onClick={() => onChange(!value)}
      className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
        value ? "bg-[#07c160]" : "bg-gray-300"
      }`}
    >
      <div
        className={`w-6 h-6 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </div>
  </div>
);

const InputItem = ({
  label,
  value,
  onChange,
  type = "text",
  options = [],
  placeholder = "",
  suffix = "",
}: any) => (
  <div className="flex items-center justify-between py-3.5 border-b border-gray-100 last:border-none">
    <span className="text-base text-gray-900 flex-shrink-0">{label}</span>
    {type === "select" ? (
      <div className="flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-gray-500 bg-transparent outline-none text-right dir-rtl appearance-none pr-1 max-w-[200px] cursor-pointer"
        >
          {options.map((opt: any) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="text-right text-gray-900 outline-none bg-transparent w-24 placeholder-gray-400"
        />
        {suffix && <span className="text-gray-900 text-sm">{suffix}</span>}
      </div>
    )}
  </div>
);

const BasicInputRow = ({ label, value, onChange }: any) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-none">
    <span className="text-base text-gray-900 font-medium">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-right text-gray-900 outline-none bg-transparent w-2/3"
    />
  </div>
);

const AvatarRow = ({ label, imgUrl, onTriggerUpload }: any) => (
  <div className="py-4 border-b border-gray-100 last:border-none">
    <div className="text-base text-gray-900 font-medium mb-3">{label}</div>
    <div className="flex items-center justify-between">
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
        {imgUrl?.startsWith("data:") || imgUrl?.startsWith("http") ? (
          <img src={imgUrl} className="w-full h-full object-cover" />
        ) : (
          <span className={imgUrl?.length > 2 ? "text-base" : "text-xl"}>
            {imgUrl}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onTriggerUpload}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md hover:bg-gray-200 transition-colors"
        >
          更换
        </button>
      </div>
    </div>
  </div>
);

const ScheduleRow = ({
  task,
  onDelete,
}: {
  task: ScheduleTask;
  onDelete: () => void;
}) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-none">
    <div className="flex flex-col">
      <div className="text-lg font-medium text-gray-900">{task.time}</div>
      <div className="text-xs text-gray-500">
        {task.type === "daily" ? "每天" : "仅一次"} · 自动发消息
      </div>
    </div>
    <div className="flex items-center gap-3">
      <div
        className={`w-2 h-2 rounded-full ${
          task.enabled ? "bg-green-500" : "bg-gray-300"
        }`}
      />
      <button
        onClick={onDelete}
        className="p-2 bg-gray-100 rounded-full text-red-500"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  </div>
);

// ==========================================
// 主页面组件
// ==========================================

export default function ChatSettingsPage({ params }: PageProps) {
  const router = useRouter();
  const [id, setId] = useState<string>("");

  // 基础信息
  const [remarkName, setRemarkName] = useState("");
  const [aiName, setAiName] = useState("");
  const [contactAvatar, setContactAvatar] = useState("🐱");
  const [friendGroup, setFriendGroup] = useState("未分组");

  // 角色设定与世界书
  const [worldBook, setWorldBook] = useState("default");
  const [aiPersona, setAiPersona] = useState("");

  const [userPersonaId, setUserPersonaId] = useState("default");

  const [myPersonasOptions, setMyPersonasOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [currentPersonaDesc, setCurrentPersonaDesc] = useState("");

  // 世界书分类列表状态
  const [wbCategories, setWbCategories] = useState<WorldBookCategory[]>([]);

  // --- 主动消息 ---
  const [bgActivity, setBgActivity] = useState(false);
  const [idleMin, setIdleMin] = useState(30);
  const [idleMax, setIdleMax] = useState(120);

  // 夜间模式
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState("23:00");
  const [dndEnd, setDndEnd] = useState("08:00");

  const [realNextTime, setRealNextTime] = useState<string>("--:--:--");
  const [schedules, setSchedules] = useState<ScheduleTask[]>([]);
  const [batchEnabled, setBatchEnabled] = useState(false);

  // 弹窗状态
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newScheduleTime, setNewScheduleTime] = useState("08:00");
  const [newScheduleType, setNewScheduleType] = useState<"once" | "daily">(
    "once"
  );

  // 其他设置
  const [weatherSync, setWeatherSync] = useState(false);
  const [location, setLocation] = useState("");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [voiceId, setVoiceId] = useState("minimax_voice_id");
  const [voiceLang, setVoiceLang] = useState("auto");
  const [asideMode, setAsideMode] = useState(false);
  const [todoSync, setTodoSync] = useState(false); // ✨ 待办事项同步
  const [descMode, setDescMode] = useState(false);
  const [timeSense, setTimeSense] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [lyricsPos, setLyricsPos] = useState("top");
  const [absoluteOnlineMode, setAbsoluteOnlineMode] = useState(false);
  const contactAvatarInputRef = useRef<HTMLInputElement>(null);

  // ✨ 新增：线下模式的子选项
  const [offlineStyle, setOfflineStyle] = useState<"normal" | "novel">(
    "normal"
  );
  const [novelWordCount, setNovelWordCount] = useState<number>(500); // 默认500字

  const groupOptions = [
    "特别关心",
    "同学",
    "朋友",
    "家人",
    "网友",
    "宠物",
    "未分组",
  ];

  useEffect(() => {
    const userProfileStr = localStorage.getItem("user_profile_v4");
    if (userProfileStr) {
      try {
        const profile: UserProfile = JSON.parse(userProfileStr);
        if (profile.personas && Array.isArray(profile.personas)) {
          const options = profile.personas.map((p) => ({
            value: p.id,
            label: p.name,
            desc: p.description,
          }));
          setMyPersonasOptions(options);
        }
      } catch (e) {
        console.error("加载个人信息失败", e);
      }
    }
  }, []);

  useEffect(() => {
    const userProfileStr = localStorage.getItem("user_profile_v4");
    if (userProfileStr) {
      const profile: UserProfile = JSON.parse(userProfileStr);
      const selected = profile.personas.find((p) => p.id === userPersonaId);
      if (selected) {
        setCurrentPersonaDesc(selected.description);
      } else {
        setCurrentPersonaDesc("");
      }
    }
  }, [userPersonaId]);

  useEffect(() => {
    const savedData = localStorage.getItem("worldbook_data");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.categories && Array.isArray(parsed.categories)) {
          setWbCategories(parsed.categories);
        }
      } catch (e) {
        console.error("加载世界书数据失败", e);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);

      if (typeof window !== "undefined") {
        const contactsStr = localStorage.getItem("contacts");
        if (contactsStr) {
          const contacts = JSON.parse(contactsStr);
          const contact = contacts.find(
            (c: any) => String(c.id) === String(resolvedParams.id)
          );
          if (contact) {
            setRemarkName(contact.remark || "");
            setAiName(contact.name || "");
            setContactAvatar(contact.avatar || "🐱");
            setFriendGroup(contact.group || "未分组");

            setAiPersona(contact.aiPersona || "");
            setUserPersonaId(contact.userPersonaId || "default");
            if (contact.worldBook) setWorldBook(contact.worldBook);

            if (contact.bgActivity !== undefined)
              setBgActivity(contact.bgActivity);
            if (contact.idleMin) setIdleMin(contact.idleMin);
            if (contact.idleMax) setIdleMax(contact.idleMax);

            if (contact.dndEnabled !== undefined)
              setDndEnabled(contact.dndEnabled);
            if (contact.dndStart) setDndStart(contact.dndStart);
            if (contact.dndEnd) setDndEnd(contact.dndEnd);

            if (contact.batchEnabled !== undefined)
              setBatchEnabled(contact.batchEnabled);

            if (contact.schedules) setSchedules(contact.schedules);

            if (contact.weatherSync !== undefined)
              setWeatherSync(contact.weatherSync);
            if (contact.location) setLocation(contact.location);
            if (contact.ttsEnabled !== undefined)
              setTtsEnabled(contact.ttsEnabled);
            if (contact.voiceId) setVoiceId(contact.voiceId);
            if (contact.voiceLang) setVoiceLang(contact.voiceLang);
            if (contact.asideMode !== undefined)
              setAsideMode(contact.asideMode);
            if (contact.absoluteOnlineMode !== undefined)
              setAbsoluteOnlineMode(contact.absoluteOnlineMode);
            if (contact.syncTasks !== undefined) setTodoSync(contact.syncTasks); // ✨ 加载同步设置
            if (contact.descMode !== undefined) setDescMode(contact.descMode);
            if (contact.timeSense !== undefined)
              setTimeSense(contact.timeSense);
            if (contact.offlineStyle) setOfflineStyle(contact.offlineStyle);
            if (contact.novelWordCount)
              setNovelWordCount(contact.novelWordCount);
            if (contact.timezone) setTimezone(contact.timezone);
            if (contact.lyricsPos) setLyricsPos(contact.lyricsPos);
          }
        }
      }
    })();
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const checkRealTime = () => {
      const targetStr = localStorage.getItem(`ai_target_time_${id}`);
      if (targetStr) {
        const date = new Date(Number(targetStr));
        const timeStr = date.toLocaleTimeString("zh-CN", { hour12: false });
        setRealNextTime(timeStr);
      } else {
        setRealNextTime("计算中 / 等待触发");
      }
    };
    checkRealTime();
    const interval = setInterval(checkRealTime, 1000);
    return () => clearInterval(interval);
  }, [id]);

  const handleAddSchedule = () => {
    const newTask: ScheduleTask = {
      id: Date.now().toString(),
      time: newScheduleTime,
      type: newScheduleType,
      enabled: true,
    };
    setSchedules([...schedules, newTask]);
    setShowScheduleModal(false);
  };

  const handleDeleteSchedule = (taskId: string) => {
    setSchedules(schedules.filter((t) => t.id !== taskId));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setContactAvatar(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (typeof window !== "undefined") {
      const contactsStr = localStorage.getItem("contacts");
      if (contactsStr) {
        const contacts = JSON.parse(contactsStr);
        const updatedContacts = contacts.map((c: any) => {
          if (String(c.id) === String(id)) {
            return {
              ...c,
              remark: remarkName,
              name: aiName,
              avatar: contactAvatar,
              group: friendGroup,
              aiPersona: aiPersona,
              userPersonaId: userPersonaId,
              worldBook: worldBook,
              bgActivity,
              idleMin,
              idleMax,
              dndEnabled,
              dndStart,
              dndEnd,
              batchEnabled,
              schedules,
              weatherSync,
              location,
              ttsEnabled,
              voiceId,
              voiceLang,
              asideMode,
              syncTasks: todoSync, // ✨ 保存同步设置
              descMode,
              timeSense,
              timezone,
              lyricsPos,
              absoluteOnlineMode,
              offlineStyle,
              novelWordCount,
            };
          }
          return c;
        });
        localStorage.setItem("contacts", JSON.stringify(updatedContacts));

        localStorage.removeItem(`ai_target_time_${id}`);
        console.log(`[设置] 已重置角色 ${id} 的后台计时器`);

        alert("设置已保存！");
        router.back();
      }
    }
  };

  const worldBookOptions = [
    { value: "default", label: "默认世界观" },
    ...wbCategories.map((cat) => ({
      value: String(cat.id),
      label: cat.name,
    })),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#f5f5f5] text-gray-900">
      <input
        type="file"
        ref={contactAvatarInputRef}
        hidden
        accept="image/*"
        onChange={handleAvatarChange}
      />

      <header className="h-14 flex items-center justify-between px-2 bg-white border-b border-gray-200 sticky top-0 z-20">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-1 text-gray-900"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-medium">聊天设置</h1>
        <button
          onClick={handleSave}
          className="px-3 py-1.5 bg-[#07c160] text-white text-sm rounded-md mr-2 active:opacity-80"
        >
          保存
        </button>
      </header>

      <div className="flex-1 overflow-y-auto pt-4 pb-10 px-3">
        {/* 基础信息 */}
        <Section>
          <BasicInputRow
            label="备注名 / 群名"
            value={remarkName}
            onChange={setRemarkName}
          />
          <BasicInputRow label="对方本名" value={aiName} onChange={setAiName} />

          <AvatarRow
            label="对方头像"
            imgUrl={contactAvatar}
            onTriggerUpload={() => contactAvatarInputRef.current?.click()}
          />

          <div className="flex items-center justify-between py-4">
            <span className="text-base text-gray-900 font-medium">
              好友分组
            </span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={friendGroup}
                  onChange={(e) => setFriendGroup(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                >
                  {groupOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <div className="px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-700 min-w-[80px] text-center flex justify-between items-center cursor-pointer hover:bg-gray-200 transition-colors">
                  <span>{friendGroup}</span>
                  <ChevronRight className="w-3 h-3 text-gray-400 rotate-90 ml-2" />
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* 角色设定与世界书 */}
        <Section title="角色设定 (World Book Setting)">
          <InputItem
            label="关联世界书"
            type="select"
            value={worldBook}
            onChange={setWorldBook}
            options={worldBookOptions}
          />

          <div className="border-t border-gray-100 my-2"></div>

          <div className="py-3">
            <div className="text-base text-gray-900 mb-2 font-medium">
              对方人设 (AI Persona)
            </div>
            <textarea
              value={aiPersona}
              onChange={(e) => setAiPersona(e.target.value)}
              placeholder="输入AI的角色设定、性格、背景..."
              className="w-full h-24 bg-gray-50 rounded-lg p-3 text-sm text-gray-700 outline-none border border-gray-200 resize-none focus:border-green-500 transition-colors"
            />
          </div>

          <div className="border-t border-gray-100 my-2"></div>

          <InputItem
            label="我的设定 (User Persona)"
            type="select"
            value={userPersonaId}
            onChange={setUserPersonaId}
            options={myPersonasOptions}
          />

          {currentPersonaDesc && (
            <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="text-xs text-gray-400 mb-1">设定预览:</div>
              <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                {currentPersonaDesc}
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            *
            请在「我」的页面创建和管理人设。在此处选择人设后，AI将使用该人设的头像、名称和性格与你互动。
          </p>
        </Section>

        {/* --- 主动消息与记忆 --- */}
        <Section title="主动消息">
          <SwitchItem
            label="启用独立后台活动"
            desc="允许角色在后台主动发消息"
            value={bgActivity}
            onChange={setBgActivity}
          />

          {bgActivity && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <InputItem
                label="最短闲置时长"
                type="number"
                value={idleMin}
                onChange={(v: string) => setIdleMin(Number(v))}
                suffix="分钟"
              />
              <InputItem
                label="最长闲置时长"
                type="number"
                value={idleMax}
                onChange={(v: string) => setIdleMax(Number(v))}
                suffix="分钟"
              />

              <div className="border-t border-gray-100 mt-2 pt-2">
                <SwitchItem
                  label="夜间免打扰"
                  desc="指定时间段内AI不主动发消息"
                  value={dndEnabled}
                  onChange={setDndEnabled}
                />
                {dndEnabled && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 text-sm ml-4">
                        开始时间 (睡觉)
                      </span>
                      <input
                        type="time"
                        value={dndStart}
                        onChange={(e) => setDndStart(e.target.value)}
                        className="bg-gray-100 rounded p-1 text-sm outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 text-sm ml-4">
                        结束时间 (起床)
                      </span>
                      <input
                        type="time"
                        value={dndEnd}
                        onChange={(e) => setDndEnd(e.target.value)}
                        className="bg-gray-100 rounded p-1 text-sm outline-none"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-gray-100 mt-2 pt-2">
                <SwitchItem
                  label="启用消息连发 (Batch)"
                  desc="闲置触发时，AI可能会连续发送多条消息"
                  value={batchEnabled}
                  onChange={setBatchEnabled}
                />
              </div>

              <div className="flex items-center justify-between py-3.5 border-b border-gray-100 mt-2">
                <span className="text-base text-gray-900 font-medium">
                  预计触发时间
                </span>
                <span className="text-green-600 font-bold font-mono text-base">
                  {realNextTime}
                </span>
              </div>

              <div className="mt-2 pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 font-medium ml-1">
                    定时主动发消息 (闹钟)
                  </span>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex items-center gap-1 text-[#07c160] text-xs px-2 py-1 bg-green-50 rounded-md active:bg-green-100"
                  >
                    <Plus className="w-3 h-3" /> 添加
                  </button>
                </div>
                {schedules.length === 0 && (
                  <div className="text-center py-4 text-gray-400 text-sm bg-gray-50 rounded-lg mb-2 border border-dashed border-gray-200">
                    暂无定时任务
                  </div>
                )}
                {schedules.map((task) => (
                  <ScheduleRow
                    key={task.id}
                    task={task}
                    onDelete={() => handleDeleteSchedule(task.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* ... 其他 Sections ... */}
        <Section>
          {/* ✨✨✨ 新增：待办事项同步 ✨✨✨ */}
          <SwitchItem
            label="同步待办事项"
            desc="允许 AI 读取清单并监督学习"
            value={todoSync}
            onChange={setTodoSync}
          />

          <SwitchItem
            label="启用实时天气同步"
            value={weatherSync}
            onChange={setWeatherSync}
          />
          {weatherSync && (
            <InputItem
              label="所在地区"
              value={location}
              onChange={setLocation}
            />
          )}
          <SwitchItem
            label="启用语音合成 (TTS)"
            value={ttsEnabled}
            onChange={setTtsEnabled}
          />
          {ttsEnabled && (
            <>
              <InputItem
                label="语音 ID"
                value={voiceId}
                onChange={setVoiceId}
              />
              <InputItem
                label="语言"
                type="select"
                value={voiceLang}
                onChange={setVoiceLang}
                options={[{ value: "auto", label: "自动" }]}
              />
            </>
          )}
        </Section>

        <Section>
          <SwitchItem
            label="启用旁白模式"
            value={asideMode}
            onChange={setAsideMode}
          />
          {/* ✨ 绝对线上模式开关 */}
          <SwitchItem
            label="绝对线上模式"
            desc="强制保持网聊风格，禁止任何动作描写和括号"
            value={absoluteOnlineMode}
            onChange={(val: boolean) => {
              setAbsoluteOnlineMode(val);
              if (val) {
                setDescMode(false);
              }
            }}
          />
          {/* ✨ 线下模式 */}
          <SwitchItem
            label="线下模式 (物理接触)"
            value={descMode}
            onChange={(val: boolean) => {
              setDescMode(val);
              if (val) setAbsoluteOnlineMode(false);
            }}
          />

          {descMode && (
            <div className="bg-gray-50 rounded-lg p-3 mt-[-10px] mb-4 mx-4 border border-gray-100 animate-in slide-in-from-top-2">
              <div className="text-xs text-gray-500 mb-2 font-medium">
                回复风格设置
              </div>

              <div className="flex bg-gray-200 rounded-lg p-1 mb-3">
                <button
                  onClick={() => setOfflineStyle("normal")}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                    offlineStyle === "normal"
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  💬 普通闲聊
                </button>
                <button
                  onClick={() => setOfflineStyle("novel")}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                    offlineStyle === "novel"
                      ? "bg-white text-black shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📖 沉浸小说
                </button>
              </div>

              {offlineStyle === "novel" && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-gray-600">目标字数</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={novelWordCount}
                      onChange={(e) =>
                        setNovelWordCount(Number(e.target.value))
                      }
                      className="w-16 text-center bg-white border border-gray-200 rounded px-1 py-1 text-sm outline-none focus:border-green-500"
                      min={100}
                      max={2000}
                      step={50}
                    />
                    <span className="text-xs text-gray-400">字左右</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                {offlineStyle === "normal"
                  ? "模拟日常面对面相处，对话简短自然，包含少量肢体动作。"
                  : "类似酒馆AI体验，大量描写环境、感官、心理活动和肢体细节，适合沉浸式剧情推进。"}
              </p>
            </div>
          )}

          <SwitchItem
            label="时间感知"
            value={timeSense}
            onChange={setTimeSense}
          />
          <InputItem
            label="时区"
            type="select"
            value={timezone}
            onChange={setTimezone}
            options={[{ value: "Asia/Shanghai", label: "中国" }]}
          />
          <InputItem
            label="歌词栏"
            type="select"
            value={lyricsPos}
            onChange={setLyricsPos}
            options={[{ value: "top", label: "顶部" }]}
          />
        </Section>
      </div>

      {/* 定时任务 Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                添加定时消息
              </h3>
              <button onClick={() => setShowScheduleModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">发送时间</label>
                <input
                  type="time"
                  value={newScheduleTime}
                  onChange={(e) => setNewScheduleTime(e.target.value)}
                  className="bg-gray-100 rounded-lg p-3 text-xl font-bold text-center outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewScheduleType("once")}
                  className={`flex-1 py-2 text-sm rounded-lg border ${
                    newScheduleType === "once"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "border-gray-200"
                  }`}
                >
                  仅一次
                </button>
                <button
                  onClick={() => setNewScheduleType("daily")}
                  className={`flex-1 py-2 text-sm rounded-lg border ${
                    newScheduleType === "daily"
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "border-gray-200"
                  }`}
                >
                  每天
                </button>
              </div>
              <button
                onClick={handleAddSchedule}
                className="w-full bg-[#07c160] text-white py-3 rounded-xl font-medium mt-2"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
