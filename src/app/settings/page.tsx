"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function SettingsPage() {
  // 1. 状态管理 (保留原有的，新增惩罚值)
  const [temp, setTemp] = useState(0.8);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0.4); // 新增：重复惩罚

  const [enableBgActivity, setEnableBgActivity] = useState(true);
  const [enableAiImages, setEnableAiImages] = useState(true);

  const [proxyUrl, setProxyUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const [fetching, setFetching] = React.useState(false);
  const [modelsList, setModelsList] = React.useState<string[]>([]);
  const [showModelsModal, setShowModelsModal] = React.useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = React.useState<
    number | null
  >(null);
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false);
  const saveConfirmTimerRef = React.useRef<number | null>(null);

  // 2. 初始化读取 (新增读取惩罚值)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setProxyUrl(localStorage.getItem("ai_proxy_url") || "");
      setApiKey(localStorage.getItem("ai_api_key") || "");
      setModel(localStorage.getItem("ai_model") || "gpt-3.5-turbo");

      const t = localStorage.getItem("ai_temperature");
      if (t) setTemp(parseFloat(t));

      const fp = localStorage.getItem("ai_frequency_penalty"); // 读取
      if (fp) setFrequencyPenalty(parseFloat(fp));
    }
  }, []);

  // 3. 保存逻辑 (新增保存参数)
  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ai_proxy_url", proxyUrl);
      localStorage.setItem("ai_api_key", apiKey);
      localStorage.setItem("ai_model", model);

      // 🌟 保存这俩参数供 AIContext 读取
      localStorage.setItem("ai_temperature", temp.toString());
      localStorage.setItem("ai_frequency_penalty", frequencyPenalty.toString());

      // 触发 UI 提示
      setShowSaveConfirm(true);
      if (saveConfirmTimerRef.current) {
        clearTimeout(saveConfirmTimerRef.current);
      }
      saveConfirmTimerRef.current = window.setTimeout(() => {
        setShowSaveConfirm(false);
        saveConfirmTimerRef.current = null;
      }, 1500);
    }
  };

  // 模型拉取逻辑 (保持原样不变，省略部分细节)
  const handleFetchModels = async () => {
    if (!proxyUrl || !proxyUrl.trim()) {
      alert('请先在"反代地址"中填写代理 URL 并保存后再尝试拉取模型');
      return;
    }
    setFetching(true);
    setSelectedModelIndex(null);
    try {
      const urlBase = proxyUrl.replace(/\/+$/, "");
      const tryUrls = [urlBase + "/models", urlBase + "/v1/models", urlBase];
      let res = null;
      let lastError = "";
      for (const u of tryUrls) {
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
          res = await fetch(u, { method: "GET", headers });
          if (!res.ok) {
            lastError = `请求 ${u} 返回 ${res.status}`;
            res = null;
            continue;
          }
          break;
        } catch (err: any) {
          lastError = String(err?.message || err);
          res = null;
        }
      }

      if (!res) {
        alert("拉取模型失败: " + lastError);
        return;
      }

      const data = await res.json().catch(() => null);
      if (!data) {
        alert("拉取模型失败：无法解析JSON");
        return;
      }

      // 你的原版解析逻辑 (保持不变)
      const seen = new Set<any>();
      function findArray(obj: any): any[] | null {
        if (!obj || seen.has(obj)) return null;
        seen.add(obj);
        if (Array.isArray(obj) && obj.length > 0) return obj;
        if (typeof obj === "object") {
          for (const key of Object.keys(obj)) {
            try {
              const val = (obj as any)[key];
              if (Array.isArray(val) && val.length > 0) return val;
              if (typeof val === "object") {
                const found = findArray(val);
                if (found) return found;
              }
            } catch (e) {}
          }
        }
        return null;
      }

      const candidate = findArray(data) || [];
      if (candidate.length > 0) {
        const normalized = candidate.map((it: any) => {
          if (typeof it === "string") return it;
          if (!it) return JSON.stringify(it);
          return it.id || it.name || it.model || it.title || JSON.stringify(it);
        });
        const first = normalized[0];
        // 如果没选过模型，才覆盖
        if (!model) setModel(first);
        setModelsList(normalized);
        const idx = normalized.findIndex((m) => m === model) ?? 0;
        setSelectedModelIndex(idx >= 0 ? idx : 0);
        setShowModelsModal(true);
      } else {
        alert("拉取成功但未找到模型列表");
      }
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 pb-20">
      <header className="h-14 flex items-center justify-between px-4 border-b bg-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-blue-500 p-2 text-lg font-bold">
            &lt;
          </Link>
          <h1 className="text-lg font-medium">API 设置</h1>
        </div>
        <button
          onClick={handleSave}
          className="mr-2 px-3 py-1 bg-green-500 text-white rounded-lg text-sm active:bg-green-600 transition-colors"
        >
          保存
        </button>
      </header>

      <main className="p-4 space-y-6">
        <section>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center">
              <div className="font-medium">界面语言</div>
              <div className="text-gray-500 text-sm">简体中文</div>
            </div>
          </div>
        </section>

        <section>
          <div className="text-xs text-gray-500 mb-2 pl-2">
            主接口 (Chat API)
          </div>
          <div className="bg-white rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  反代地址 (Proxy URL)
                </label>
                <input
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  placeholder="https://your-proxy.example.com/api/chat"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  API Key
                </label>
                <input
                  value={apiKey}
                  type="password"
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  模型名称
                </label>
                <div className="flex gap-2">
                  <input
                    value={model}
                    readOnly
                    onClick={() =>
                      modelsList.length > 0
                        ? setShowModelsModal(true)
                        : handleFetchModels()
                    }
                    placeholder="例如: gpt-3.5-turbo"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50 cursor-pointer text-gray-700"
                  />
                  <button
                    onClick={handleFetchModels}
                    disabled={fetching}
                    className="px-3 py-2 bg-blue-500 text-white text-xs rounded-lg active:bg-blue-600"
                  >
                    {fetching ? "拉取中..." : "获取列表"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 🌟 核心修改：参数调节区域 (合并了原有的参数设置块) */}
        <section>
          <div className="text-xs text-gray-500 mb-2 pl-2">性格参数调节</div>
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-6">
            {/* 温度 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">创造力 (温度)</div>
                <div className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                  {temp.toFixed(1)}
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={temp}
                onChange={(e) => setTemp(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                值越高越活泼(0.8+)，越低越严谨(0.2)。建议 0.7~1.0。
              </p>
            </div>

            <hr className="border-gray-100" />

            {/* 惩罚 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium">防复读 (惩罚)</div>
                <div className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                  {frequencyPenalty.toFixed(1)}
                </div>
              </div>
              <input
                type="range"
                min={-2}
                max={2}
                step={0.1}
                value={frequencyPenalty}
                onChange={(e) => setFrequencyPenalty(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                防止AI车轱辘话。如果AI一直重复，请调高此值(0.1~0.5)。
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between"></div>
            <div className="flex items-center justify-between">
              <div className="text-sm">AI 生图 (DALL·E 3)</div>
              <input
                type="checkbox"
                checked={enableAiImages}
                onChange={(e) => setEnableAiImages(e.target.checked)}
                className="toggle-checkbox"
              />
            </div>
          </div>
        </section>

        {/* 下面是一些占位的高级设置，保留 UI */}
        <section>
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-3 opacity-60 pointer-events-none">
            <div className="text-xs font-bold text-gray-400">
              高级 (暂不可用)
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>GitHub 备份</span> <span>关</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>图床服务</span> <span>ImgBB</span>
            </div>
          </div>
        </section>
      </main>

      {/* 提示弹窗 */}
      {showSaveConfirm && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-fade-in-up">
            <span className="text-xl">✅</span> 配置已保存
          </div>
        </div>
      )}

      {/* 模型选择弹窗 (保持原样，修正遮罩点击) */}
      {showModelsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModelsModal(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
            <div className="p-4 border-b font-bold text-center">选择模型</div>
            <div className="flex-1 overflow-y-auto p-2">
              {modelsList.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedModelIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg text-sm mb-1 ${
                    selectedModelIndex === idx
                      ? "bg-blue-50 text-blue-600 font-bold"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setShowModelsModal(false)}
                className="flex-1 py-2.5 bg-gray-100 rounded-lg text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (selectedModelIndex !== null)
                    setModel(modelsList[selectedModelIndex]);
                  setShowModelsModal(false);
                }}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
