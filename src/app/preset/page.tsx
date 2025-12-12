"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Upload,
  Trash2,
  FileJson,
  Edit3,
  Link as LinkIcon,
  CheckCircle2,
  X,
  Settings2,
} from "lucide-react";
import { useRouter } from "next/navigation";

// --- 类型定义 (基于 Tavern/Janus 格式) ---

interface PromptItem {
  identifier: string;
  name: string;
  content: string;
  enabled: boolean;
  role: "system" | "user" | "assistant";
  // 其他字段我们暂时存着但不展示
  [key: string]: any;
}

interface PresetData {
  id: string; // 本地生成的ID，用于区分不同导入
  name: string; // 预设名称 (文件名或自定义)
  prompts: PromptItem[];
  // 保留根节点的其他设置 (temperature 等)
  [key: string]: any;
}

interface Contact {
  id: string;
  name: string;
  avatar: string;
  presetId?: string; // 绑定的预设ID
}

function PresetPageContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 状态 ---
  const [presets, setPresets] = useState<PresetData[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [editingPreset, setEditingPreset] = useState<PresetData | null>(null); // 进入某个预设内部
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null); // 编辑具体某条Prompt

  // 绑定模态框状态
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindingPresetId, setBindingPresetId] = useState<string | null>(null);

  // --- 初始化 ---
  useEffect(() => {
    // 加载预设库
    const savedPresets = localStorage.getItem("app_presets");
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("预设加载失败", e);
      }
    }

    // 加载联系人 (用于绑定)
    const savedContacts = localStorage.getItem("contacts");
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts));
      } catch (e) {
        console.error("联系人加载失败", e);
      }
    }
  }, []);

  // --- 持久化 ---
  const savePresetsToLocal = (newPresets: PresetData[]) => {
    setPresets(newPresets);
    localStorage.setItem("app_presets", JSON.stringify(newPresets));
  };

  const saveContactsToLocal = (newContacts: Contact[]) => {
    setContacts(newContacts);
    localStorage.setItem("contacts", JSON.stringify(newContacts));
  };

  // --- 导入功能 ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);

        // 简单的格式校验
        if (!Array.isArray(json.prompts)) {
          alert(
            "格式错误：未找到 prompts 数组，请确认是 Tavern/SillyTavern 格式的预设文件。"
          );
          return;
        }

        const newPreset: PresetData = {
          ...json,
          id: Date.now().toString(), // 生成唯一ID
          name: file.name.replace(".json", ""), // 使用文件名作为预设名
        };

        const updatedList = [newPreset, ...presets];
        savePresetsToLocal(updatedList);
        alert(`导入成功：《${newPreset.name}》`);
      } catch (error) {
        alert("JSON 解析失败");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // --- 绑定逻辑 ---
  const openBindModal = (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    setBindingPresetId(presetId);
    setShowBindModal(true);
  };

  const toggleBindContact = (contactId: string) => {
    if (!bindingPresetId) return;

    const newContacts = contacts.map((c) => {
      if (c.id === contactId) {
        // 如果当前已经绑定了这个预设，则解绑；否则绑定
        return {
          ...c,
          presetId:
            c.presetId === bindingPresetId ? undefined : bindingPresetId,
        };
      }
      // 如果要实现“一个角色只能绑定一个预设”，保持原样
      // 如果要实现“解绑该角色旧的预设并绑定新的”，逻辑也是对的，因为是覆盖
      return c;
    });

    saveContactsToLocal(newContacts);
  };

  // --- 预设内部操作 ---
  const handleTogglePrompt = (promptId: string) => {
    if (!editingPreset) return;
    const newPrompts = editingPreset.prompts.map((p) =>
      p.identifier === promptId ? { ...p, enabled: !p.enabled } : p
    );
    const newPreset = { ...editingPreset, prompts: newPrompts };
    setEditingPreset(newPreset);

    // 同时更新列表里的数据
    const newPresets = presets.map((p) =>
      p.id === newPreset.id ? newPreset : p
    );
    savePresetsToLocal(newPresets);
  };

  const handleDeletePreset = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("确定删除此预设吗？删除后所有绑定的角色将失去此预设效果。")) {
      const newPresets = presets.filter((p) => p.id !== id);
      savePresetsToLocal(newPresets);
      // 清理绑定关系
      const newContacts = contacts.map((c) =>
        c.presetId === id ? { ...c, presetId: undefined } : c
      );
      saveContactsToLocal(newContacts);
    }
  };

  const handleSavePromptEdit = () => {
    if (!editingPreset || !editingPrompt) return;
    const newPrompts = editingPreset.prompts.map((p) =>
      p.identifier === editingPrompt.identifier ? editingPrompt : p
    );
    const newPreset = { ...editingPreset, prompts: newPrompts };
    setEditingPreset(newPreset);
    const newPresets = presets.map((p) =>
      p.id === newPreset.id ? newPreset : p
    );
    savePresetsToLocal(newPresets);
    setEditingPrompt(null);
  };

  // --- 渲染：Prompt 编辑页 (Level 3) ---
  const renderPromptEditor = () => {
    if (!editingPrompt) return null;
    return (
      <div className="absolute inset-0 z-[60] bg-[#f2f4f8] flex flex-col h-full w-full">
        <header className="bg-white px-4 h-14 flex items-center justify-between shadow-sm shrink-0">
          <button
            onClick={() => setEditingPrompt(null)}
            className="p-2 -ml-2 text-blue-500 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-base font-bold text-gray-900 truncate max-w-[200px]">
            编辑指令
          </h1>
          <button
            onClick={handleSavePromptEdit}
            className="text-blue-600 font-bold px-3 py-1.5 bg-blue-50 rounded-lg text-sm"
          >
            保存
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-400 ml-1">
              指令名称
            </label>
            <input
              value={editingPrompt.name}
              onChange={(e) =>
                setEditingPrompt({ ...editingPrompt, name: e.target.value })
              }
              className="w-full mt-1 px-4 py-3 rounded-xl border-none shadow-sm focus:ring-2 ring-blue-500/20"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-400 ml-1">
              角色 (Role)
            </label>
            <div className="flex gap-2 mt-1">
              {["system", "user", "assistant"].map((role) => (
                <button
                  key={role}
                  onClick={() =>
                    setEditingPrompt({ ...editingPrompt, role: role as any })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    editingPrompt.role === role
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-600"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col min-h-[300px]">
            <label className="text-xs font-bold text-gray-400 ml-1">内容</label>
            <textarea
              value={editingPrompt.content}
              onChange={(e) =>
                setEditingPrompt({ ...editingPrompt, content: e.target.value })
              }
              className="w-full h-full mt-1 p-4 rounded-xl border-none shadow-sm resize-none font-mono text-sm leading-relaxed focus:ring-2 ring-blue-500/20"
              placeholder="输入指令内容..."
            />
          </div>
        </div>
      </div>
    );
  };

  // --- 渲染：预设详情页 (Level 2) ---
  const renderPresetDetail = () => {
    if (!editingPreset) return null;
    return (
      <div className="absolute inset-0 z-50 bg-[#f2f4f8] flex flex-col h-full w-full">
        {renderPromptEditor()}
        <header className="bg-white px-4 h-14 flex items-center justify-between shadow-sm shrink-0">
          <button
            onClick={() => setEditingPreset(null)}
            className="p-2 -ml-2 text-blue-500 rounded-full"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-base font-bold text-gray-900 truncate max-w-[180px]">
            {editingPreset.name}
          </h1>
          <div className="w-8"></div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20">
          {/* 根设置区域 (简略) */}
          <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Settings2 size={16} />
              <span className="text-xs font-bold uppercase">全局参数</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                Temp:{" "}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {editingPreset.temperature || 1.0}
                </span>
              </div>
              <div>
                Max Tokens:{" "}
                <span className="font-mono bg-gray-100 px-1 rounded">
                  {editingPreset.openai_max_tokens || 0}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-500 mb-2 px-1">
            <FileJson size={16} />
            <span className="text-xs font-bold uppercase">
              指令列表 ({editingPreset.prompts.length})
            </span>
          </div>

          <div className="space-y-3">
            {editingPreset.prompts.map((prompt, index) => (
              <div
                key={prompt.identifier || index}
                className={`bg-white p-3 rounded-xl shadow-sm border transition-all ${
                  prompt.enabled
                    ? "border-green-200"
                    : "border-gray-100 opacity-60"
                }`}
              >
                <div className="flex justify-between items-start gap-3">
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => setEditingPrompt(prompt)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          prompt.role === "system"
                            ? "bg-purple-100 text-purple-600"
                            : prompt.role === "user"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        {prompt.role}
                      </span>
                      <h3 className="font-bold text-gray-800 text-sm truncate">
                        {prompt.name}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 font-mono">
                      {prompt.content}
                    </p>
                  </div>

                  <div
                    onClick={() => handleTogglePrompt(prompt.identifier)}
                    className={`shrink-0 w-8 h-4.5 rounded-full p-0.5 cursor-pointer transition-colors mt-1 ${
                      prompt.enabled ? "bg-[#07c160]" : "bg-gray-300"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform ${
                        prompt.enabled ? "translate-x-3.5" : "translate-x-0"
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  };

  // --- 渲染：主列表 (Level 1) ---
  return (
    <div className="h-full flex flex-col bg-[#f2f4f8] text-gray-800 relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".json"
        className="hidden"
      />

      {/* 预设详情页 */}
      {renderPresetDetail()}

      {/* 绑定角色模态框 */}
      {showBindModal && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setShowBindModal(false)}
        >
          <div
            className="bg-white w-full sm:w-[320px] rounded-t-2xl sm:rounded-2xl overflow-hidden max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">选择要绑定的角色</h3>
              <button onClick={() => setShowBindModal(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {contacts.map((contact) => {
                const isBound = contact.presetId === bindingPresetId;
                return (
                  <div
                    key={contact.id}
                    onClick={() => toggleBindContact(contact.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
                      isBound
                        ? "bg-blue-50 border border-blue-100"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 text-xl flex items-center justify-center">
                      {contact.avatar?.startsWith("http") ||
                      contact.avatar?.startsWith("data:") ? (
                        <img
                          src={contact.avatar}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        contact.avatar
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm text-gray-800">
                        {contact.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {isBound
                          ? "已绑定此预设"
                          : contact.presetId
                          ? "已绑定其他预设"
                          : "未绑定"}
                      </div>
                    </div>
                    {isBound && (
                      <CheckCircle2 size={20} className="text-blue-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 主头部 */}
      <header className="flex-none bg-white/90 backdrop-blur-md shadow-sm px-4 h-14 flex items-center justify-between z-10">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-900">预设管理</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-blue-500 hover:bg-gray-100 rounded-full"
        >
          <Upload size={22} />
        </button>
      </header>

      {/* 主列表 */}
      <main className="flex-1 overflow-y-auto p-4 pb-20">
        {presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-gray-400 gap-4">
            <Settings2 size={48} className="text-gray-200" />
            <p>暂无预设</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-blue-500 text-white rounded-full shadow-md hover:bg-blue-600 transition"
            >
              导入 Tavern JSON
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {presets.map((preset) => {
              const boundCount = contacts.filter(
                (c) => c.presetId === preset.id
              ).length;
              return (
                <div
                  key={preset.id}
                  onClick={() => setEditingPreset(preset)}
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">
                        {preset.name}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {preset.prompts.filter((p) => p.enabled).length} /{" "}
                        {preset.prompts.length} 个指令已开启
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleDeletePreset(e, preset.id)}
                      className="text-gray-300 hover:text-red-500 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex -space-x-2">
                      {/* 显示绑定的小头像 */}
                      {contacts
                        .filter((c) => c.presetId === preset.id)
                        .slice(0, 5)
                        .map((c) => (
                          <div
                            key={c.id}
                            className="w-6 h-6 rounded-full border-2 border-white bg-gray-200 overflow-hidden text-xs flex items-center justify-center"
                          >
                            {c.avatar?.startsWith("http") ||
                            c.avatar?.startsWith("data:") ? (
                              <img
                                src={c.avatar}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              c.avatar
                            )}
                          </div>
                        ))}
                      {boundCount > 5 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 text-[10px] flex items-center justify-center text-gray-500">
                          +{boundCount - 5}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => openBindModal(e, preset.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        boundCount > 0
                          ? "bg-blue-50 text-blue-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <LinkIcon size={12} />
                      {boundCount > 0 ? `已绑定 ${boundCount} 人` : "绑定角色"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function PresetPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PresetPageContent />
    </Suspense>
  );
}
