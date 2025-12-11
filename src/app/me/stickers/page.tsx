"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Trash2,
  FolderInput,
  CheckCircle2,
  Circle,
  X,
} from "lucide-react";

// --- 类型定义 (保持与 InputArea 一致) ---
interface CustomSticker {
  id: string;
  url: string;
  desc: string;
  category: string;
}

const DEFAULT_STICKERS: CustomSticker[] = [
  {
    id: "s1",
    url: "https://i.postimg.cc/KjW6Wdqc/Image-1759377378918.gif",
    desc: "猫咪震惊",
    category: "默认",
  },
];

export default function StickerManagePage() {
  const router = useRouter();

  // --- 状态管理 ---
  const [stickers, setStickers] = useState<CustomSticker[]>([]);

  // 筛选与管理状态
  const [currentCategory, setCurrentCategory] = useState<string>("全部");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 模态框状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "batch">("single");
  const [showMoveModal, setShowMoveModal] = useState(false);

  // 输入缓存
  const [newStickerUrl, setNewStickerUrl] = useState("");
  const [newStickerDesc, setNewStickerDesc] = useState("");
  const [batchText, setBatchText] = useState("");
  const [targetCategoryInput, setTargetCategoryInput] = useState("");

  // --- 初始化加载 ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("custom_stickers");
      if (saved) {
        let parsed = JSON.parse(saved);
        // 数据清洗：确保有 category
        parsed = parsed.map((s: any) => ({
          ...s,
          category: s.category || "默认",
        }));
        setStickers(parsed);
      } else {
        setStickers(DEFAULT_STICKERS);
        localStorage.setItem(
          "custom_stickers",
          JSON.stringify(DEFAULT_STICKERS)
        );
      }
    }
  }, []);

  // --- 计算属性 ---
  const categories = useMemo(() => {
    const cats = new Set(stickers.map((s) => s.category || "默认"));
    return ["全部", ...Array.from(cats)];
  }, [stickers]);

  const filteredStickers = useMemo(() => {
    if (currentCategory === "全部") return stickers;
    return stickers.filter((s) => s.category === currentCategory);
  }, [stickers, currentCategory]);

  // --- 核心操作 ---

  // 1. 保存到本地存储
  const saveToStorage = (newData: CustomSticker[]) => {
    setStickers(newData);
    localStorage.setItem("custom_stickers", JSON.stringify(newData));
  };

  // 2. 添加表情 (复用 InputArea 逻辑)
  const handleConfirmAdd = () => {
    let newItems: CustomSticker[] = [];
    // 默认分类：当前选中的分类，如果是全部则归为默认
    const defaultCat = currentCategory === "全部" ? "默认" : currentCategory;

    if (addMode === "single") {
      if (!newStickerUrl.trim()) return;
      newItems.push({
        id: Date.now().toString(),
        url: newStickerUrl,
        desc: newStickerDesc || "自定义表情",
        category: defaultCat,
      });
    } else {
      // 批量解析逻辑
      if (!batchText.trim()) return;
      const lines = batchText.split("\n");
      lines.forEach((line, index) => {
        const cleanLine = line.trim();
        if (!cleanLine) return;
        let url = "";
        let desc = "自定义表情";

        // 解析格式: "描述：http://..." 或直接 "http://..."
        const httpIndex = cleanLine.indexOf("http");
        if (httpIndex > 0) {
          url = cleanLine.substring(httpIndex).trim();
          const prefix = cleanLine.substring(0, httpIndex).trim();
          if (prefix.endsWith("：") || prefix.endsWith(":")) {
            desc = prefix.slice(0, -1).trim();
          } else {
            desc = prefix;
          }
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
      saveToStorage([...stickers, ...newItems]);
      setShowAddModal(false);
      setNewStickerUrl("");
      setNewStickerDesc("");
      setBatchText("");
    }
  };

  // 3. 删除选中
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.length} 个表情吗？`)) return;

    const updated = stickers.filter((s) => !selectedIds.includes(s.id));
    saveToStorage(updated);
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  // 4. 移动分类
  const handleMoveCategory = () => {
    if (!targetCategoryInput.trim()) return;

    const updated = stickers.map((s) => {
      if (selectedIds.includes(s.id)) {
        return { ...s, category: targetCategoryInput.trim() };
      }
      return s;
    });

    saveToStorage(updated);
    setSelectedIds([]);
    setIsSelectionMode(false);
    setShowMoveModal(false);
    // 自动跳转到新分类
    setCurrentCategory(targetCategoryInput.trim());
    setTargetCategoryInput("");
  };

  // 5. 点击卡片逻辑
  const handleCardClick = (id: string) => {
    if (isSelectionMode) {
      if (selectedIds.includes(id)) {
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        setSelectedIds((prev) => [...prev, id]);
      }
    } else {
      // 非选择模式下可以做预览，这里暂时只做切换选择模式
      // 或者点击进入大图预览（可扩展）
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F3F3F3]">
      {/* --- Header --- */}
      <div className="h-12 bg-[#EDEDED] flex items-center justify-between px-2 sticky top-0 z-10 shrink-0 border-b border-gray-200">
        <button onClick={() => router.back()} className="p-2 -ml-1">
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <span className="font-semibold text-[17px] text-black">表情管理</span>
        <button
          onClick={() => {
            setIsSelectionMode(!isSelectionMode);
            setSelectedIds([]);
          }}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            isSelectionMode
              ? "text-[#07c160] bg-green-50"
              : "text-gray-900 hover:bg-black/5"
          }`}
        >
          {isSelectionMode ? "完成" : "管理"}
        </button>
      </div>

      {/* --- Category Bar --- */}
      <div className="bg-white px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-b border-gray-100 shrink-0">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCurrentCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              currentCategory === cat
                ? "bg-[#07c160] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* --- Sticker Grid --- */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {filteredStickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <div className="text-4xl">📭</div>
            <div className="text-sm">暂无表情，快去添加吧</div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {/* Add Button (Only in normal mode) */}
            {!isSelectionMode && (
              <button
                onClick={() => setShowAddModal(true)}
                className="aspect-square bg-gray-200/50 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors border-2 border-dashed border-gray-300"
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs mt-1">添加</span>
              </button>
            )}

            {filteredStickers.map((sticker) => {
              const isSelected = selectedIds.includes(sticker.id);
              return (
                <div
                  key={sticker.id}
                  onClick={() => handleCardClick(sticker.id)}
                  className={`relative aspect-square bg-white rounded-lg p-2 flex items-center justify-center cursor-pointer border transition-all ${
                    isSelected
                      ? "border-[#07c160] bg-green-50"
                      : "border-gray-200"
                  }`}
                >
                  <img
                    src={sticker.url}
                    alt={sticker.desc}
                    className="w-full h-full object-contain"
                  />
                  {/* Selection Indicator */}
                  {isSelectionMode && (
                    <div className="absolute top-1 right-1">
                      {isSelected ? (
                        <CheckCircle2 className="w-5 h-5 text-[#07c160] fill-white" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300 fill-white/80" />
                      )}
                    </div>
                  )}
                  {/* Desc Label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] text-center py-0.5 rounded-b-[7px] truncate px-1 backdrop-blur-[2px]">
                    {sticker.desc}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Bottom Action Bar (Selection Mode) --- */}
      {isSelectionMode && (
        <div className="bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom flex items-center justify-between animate-in slide-in-from-bottom-10">
          <div className="text-sm text-gray-500">
            已选 {selectedIds.length} 项
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowMoveModal(true)}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-50 hover:bg-gray-200"
            >
              <FolderInput className="w-4 h-4" />
              <span className="text-sm">移动分类</span>
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-1 px-4 py-2 rounded-lg bg-red-50 text-red-600 disabled:opacity-50 hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">删除</span>
            </button>
          </div>
        </div>
      )}

      {/* --- Add Modal --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
              <span className="font-semibold text-gray-700">添加表情</span>
              <button onClick={() => setShowAddModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4">
              {/* Mode Switch */}
              <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                <button
                  onClick={() => setAddMode("single")}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                    addMode === "single"
                      ? "bg-white shadow-sm text-black"
                      : "text-gray-500"
                  }`}
                >
                  单张上传
                </button>
                <button
                  onClick={() => setAddMode("batch")}
                  className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                    addMode === "batch"
                      ? "bg-white shadow-sm text-black"
                      : "text-gray-500"
                  }`}
                >
                  批量导入
                </button>
              </div>

              {addMode === "single" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      图片链接 (URL)
                    </label>
                    <input
                      value={newStickerUrl}
                      onChange={(e) => setNewStickerUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#07c160]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">
                      描述 (AI将根据此描述使用表情)
                    </label>
                    <input
                      value={newStickerDesc}
                      onChange={(e) => setNewStickerDesc(e.target.value)}
                      placeholder="例如：开心、震惊..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#07c160]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    批量文本 (每行一个)
                  </label>
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={`格式1: 描述：图片链接\n格式2: 图片链接 (自动描述)\n\n例如：\n开心：https://example.com/1.gif\nhttps://example.com/2.png`}
                    className="w-full h-32 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#07c160] resize-none"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
              >
                取消
              </button>
              <button
                onClick={handleConfirmAdd}
                className="px-4 py-2 rounded-lg text-sm bg-[#07c160] text-white hover:bg-[#06ad56]"
              >
                确定添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Move Category Modal --- */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xs rounded-xl p-5 animate-in zoom-in-95">
            <h3 className="text-lg font-semibold mb-1">移动到分类</h3>
            <p className="text-xs text-gray-500 mb-4">
              将选中的 {selectedIds.length} 个表情移动到：
            </p>

            <input
              value={targetCategoryInput}
              onChange={(e) => setTargetCategoryInput(e.target.value)}
              placeholder="输入分类名称 (例如：日常)"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#07c160]"
              autoFocus
            />

            {/* 快速选择现有分类 */}
            <div className="flex flex-wrap gap-2 mb-4 mt-2">
              {categories
                .filter((c) => c !== "全部")
                .map((c) => (
                  <button
                    key={c}
                    onClick={() => setTargetCategoryInput(c)}
                    className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 hover:bg-gray-200"
                  >
                    {c}
                  </button>
                ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowMoveModal(false)}
                className="px-3 py-1.5 text-sm text-gray-500"
              >
                取消
              </button>
              <button
                onClick={handleMoveCategory}
                disabled={!targetCategoryInput.trim()}
                className="px-3 py-1.5 text-sm bg-[#07c160] text-white rounded-lg disabled:opacity-50"
              >
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
