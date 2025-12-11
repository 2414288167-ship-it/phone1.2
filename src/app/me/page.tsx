"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ChevronRight,
  QrCode,
  Box,
  Circle,
  CreditCard,
  Smile,
  Settings,
  MessageSquare,
  Users,
  Compass,
  User,
  X,
  ChevronLeft,
  Check,
  MoreHorizontal,
  XCircle,
} from "lucide-react";

// --- 类型定义 ---
type ViewState =
  | "MAIN"
  | "PROFILE_INFO"
  | "PERSONA_LIST"
  | "PERSONA_EDIT"
  | "EDIT_NAME"
  | "EDIT_WECHAT_ID";

interface Persona {
  id: string;
  name: string;
  description: string;
  avatar: string;
}

interface UserProfile {
  name: string;
  wechatId: string;
  avatar: string;
  status: string;
  statusIcon: string;
  currentPersonaId: string;
  personas: Persona[];
}

export default function MePage() {
  // --- 1. 状态管理 ---
  const [currentView, setCurrentView] = useState<ViewState>("MAIN");
  const [showStatusModal, setShowStatusModal] = useState(false);

  // 临时状态：用于编辑名字和微信号时的输入缓存
  const [tempInput, setTempInput] = useState("");

  const DEFAULT_AVATAR =
    "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwBHdRmej0fViacg/0";

  // 用户信息初始状态
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: "辰祈",
    wechatId: "qq54777777777",
    avatar: "https://i.postimg.cc/KjW6Wdqc/Image-1759377378918.gif",
    status: "",
    statusIcon: "",
    currentPersonaId: "default",
    personas: [
      {
        id: "default",
        name: "默认自己",
        description: "保持我真实的性格，无需扮演。",
        avatar: "https://i.postimg.cc/KjW6Wdqc/Image-1759377378918.gif",
      },
    ],
  });

  // 正在编辑的人设
  const [editingPersona, setEditingPersona] = useState<Persona>({
    id: "",
    name: "",
    description: "",
    avatar: "",
  });

  // Refs
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const personaFileInputRef = useRef<HTMLInputElement>(null);

  const STATUS_OPTIONS = [
    { icon: "😀", label: "心情好" },
    { icon: "😞", label: "emo了" },
    { icon: "💼", label: "搬砖中" },
    { icon: "☕", label: "喝咖啡" },
    { icon: "🏠", label: "宅家" },
    { icon: "💤", label: "睡觉" },
    { icon: "🎮", label: "打游戏中" },
    { icon: "🐟", label: "摸鱼" },
  ];

  // --- 2. 初始化与持久化 ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user_profile_v4");
      if (saved) {
        setUserProfile(JSON.parse(saved));
      } else {
        localStorage.setItem("user_profile_v4", JSON.stringify(userProfile));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    localStorage.setItem("user_profile_v4", JSON.stringify(newProfile));
  };

  // --- 3. 核心功能函数 (必须定义在 render 函数之前) ---

  const getCurrentPersona = () => {
    return (
      userProfile.personas.find((p) => p.id === userProfile.currentPersonaId) ||
      userProfile.personas[0]
    );
  };

  // 设置状态
  const handleSetStatus = (item: { icon: string; label: string }) => {
    saveProfile({ ...userProfile, status: item.label, statusIcon: item.icon });
    setShowStatusModal(false);
  };

  // 清除状态
  const clearStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveProfile({ ...userProfile, status: "", statusIcon: "" });
  };

  // 切换人设 (同时更新主头像)
  const selectPersona = (id: string) => {
    const targetPersona = userProfile.personas.find((p) => p.id === id);
    saveProfile({
      ...userProfile,
      currentPersonaId: id,
      avatar: targetPersona ? targetPersona.avatar : userProfile.avatar,
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 1. 修改主头像上传逻辑
  const handleMainAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // 之前是 URL.createObjectURL(file)，现在改成 await fileToBase64(file)
      const base64 = await fileToBase64(file);

      // 更新当前人设列表中的头像
      const updatedPersonas = userProfile.personas.map((p) => {
        if (p.id === userProfile.currentPersonaId) {
          return { ...p, avatar: base64 };
        }
        return p;
      });

      saveProfile({
        ...userProfile,
        avatar: base64,
        personas: updatedPersonas,
      });
    }
  };

  // 编辑人设时的头像上传
  const handlePersonaAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setEditingPersona({ ...editingPersona, avatar: base64 });
    }
  };

  // 保存人设
  const handleSavePersona = () => {
    let newPersonas = [...userProfile.personas];
    const personaToSave = {
      ...editingPersona,
      avatar: editingPersona.avatar || DEFAULT_AVATAR,
    };

    let isEditingCurrent = false;

    if (personaToSave.id) {
      // 编辑
      if (personaToSave.id === userProfile.currentPersonaId)
        isEditingCurrent = true;
      newPersonas = newPersonas.map((p) =>
        p.id === personaToSave.id ? personaToSave : p
      );
    } else {
      // 新建
      const newId = Date.now().toString();
      const newPersonaWithId = { ...personaToSave, id: newId };
      newPersonas.push(newPersonaWithId);
      if (newPersonas.length === 1) {
        saveProfile({
          ...userProfile,
          currentPersonaId: newId,
          avatar: newPersonaWithId.avatar,
        });
        setCurrentView("PERSONA_LIST");
        return;
      }
    }

    // 如果编辑的是当前正在使用的人设，同步更新主头像
    const newMainAvatar = isEditingCurrent
      ? personaToSave.avatar
      : userProfile.avatar;

    saveProfile({
      ...userProfile,
      personas: newPersonas,
      avatar: newMainAvatar,
    });
    setCurrentView("PERSONA_LIST");
  };

  // 删除人设
  const handleDeletePersona = (id: string) => {
    const newPersonas = userProfile.personas.filter((p) => p.id !== id);
    let newCurrentId = userProfile.currentPersonaId;
    let newAvatar = userProfile.avatar;

    // 如果删除了当前选中的，回退到默认
    if (userProfile.currentPersonaId === id) {
      const fallback = newPersonas[0];
      if (fallback) {
        newCurrentId = fallback.id;
        newAvatar = fallback.avatar;
      }
    }
    saveProfile({
      ...userProfile,
      personas: newPersonas,
      currentPersonaId: newCurrentId,
      avatar: newAvatar,
    });
    setCurrentView("PERSONA_LIST");
  };

  // 保存名字
  const saveName = () => {
    if (tempInput.trim()) {
      saveProfile({ ...userProfile, name: tempInput });
    }
    setCurrentView("PROFILE_INFO");
  };

  // 保存微信号
  const saveWechatId = () => {
    if (tempInput.trim()) {
      saveProfile({ ...userProfile, wechatId: tempInput });
    }
    setCurrentView("PROFILE_INFO");
  };

  // --- 4. 视图渲染函数 (Render Functions) ---

  const renderEditNameView = () => (
    <div className="flex flex-col h-screen bg-[#F3F3F3]">
      <div className="bg-[#EDEDED] h-12 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
        <button
          onClick={() => setCurrentView("PROFILE_INFO")}
          className="text-[16px] text-black"
        >
          取消
        </button>
        <span className="font-semibold text-[17px]">设置名字</span>
        <button
          onClick={saveName}
          disabled={!tempInput.trim()}
          className={`px-3 py-1.5 rounded-[4px] text-sm text-white font-medium ${
            !tempInput.trim() ? "bg-[#07c160]/50" : "bg-[#07c160]"
          }`}
        >
          完成
        </button>
      </div>
      <div className="mt-4 px-4">
        <div className="bg-white rounded-lg px-4 py-2 flex items-center">
          <input
            type="text"
            value={tempInput}
            onChange={(e) => setTempInput(e.target.value)}
            className="flex-1 outline-none text-[16px] h-10 bg-transparent text-black"
            placeholder="请输入名字"
            autoFocus
          />
          {tempInput && (
            <button onClick={() => setTempInput("")}>
              <XCircle className="w-5 h-5 text-gray-300 fill-gray-100" />
            </button>
          )}
        </div>
        <p className="text-gray-400 text-xs mt-2 px-2">
          好名字可以让朋友更容易记住你。
        </p>
      </div>
    </div>
  );

  const renderEditWechatIdView = () => (
    <div className="flex flex-col h-screen bg-[#F3F3F3]">
      <div className="bg-[#EDEDED] h-12 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
        <button
          onClick={() => setCurrentView("PROFILE_INFO")}
          className="text-[16px] text-black"
        >
          取消
        </button>
        <span className="font-semibold text-[17px]">设置微信号</span>
        <button
          onClick={saveWechatId}
          disabled={!tempInput.trim()}
          className={`px-3 py-1.5 rounded-[4px] text-sm text-white font-medium ${
            !tempInput.trim() ? "bg-[#07c160]/50" : "bg-[#07c160]"
          }`}
        >
          完成
        </button>
      </div>
      <div className="mt-4 px-4">
        <div className="bg-white rounded-lg px-4 py-2 flex items-center">
          <input
            type="text"
            value={tempInput}
            onChange={(e) => setTempInput(e.target.value)}
            className="flex-1 outline-none text-[16px] h-10 bg-transparent text-black"
            placeholder="请输入微信号"
            autoFocus
          />
          {tempInput && (
            <button onClick={() => setTempInput("")}>
              <XCircle className="w-5 h-5 text-gray-300 fill-gray-100" />
            </button>
          )}
        </div>
        <p className="text-gray-400 text-xs mt-2 px-2">
          微信号是账号的唯一凭证，只能修改一次。
        </p>
      </div>
    </div>
  );

  const renderProfileInfoView = () => (
    <div className="flex flex-col h-screen bg-[#F3F3F3]">
      <Header title="个人信息" onBack={() => setCurrentView("MAIN")} />
      <div className="flex-1 overflow-y-auto">
        <div className="mt-2">
          <div
            onClick={() => mainFileInputRef.current?.click()}
            className="bg-white p-4 h-20 flex items-center justify-between border-b border-gray-100 active:bg-gray-50 cursor-pointer"
          >
            <span className="text-[16px] text-black">头像</span>
            <div className="flex items-center gap-3">
              <img
                src={userProfile.avatar}
                alt="avatar"
                className="w-14 h-14 rounded-[6px] object-cover"
              />
              <ChevronRight className="w-4 h-4 text-gray-300 stroke-[2]" />
            </div>
            <input
              type="file"
              ref={mainFileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleMainAvatarChange}
            />
          </div>

          <div
            onClick={() => {
              setTempInput(userProfile.name);
              setCurrentView("EDIT_NAME");
            }}
            className="bg-white p-4 h-14 flex items-center justify-between border-b border-gray-100 active:bg-gray-50 cursor-pointer"
          >
            <span className="text-[16px] text-black">名字</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">{userProfile.name}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 stroke-[2]" />
            </div>
          </div>

          <div
            onClick={() => {
              setTempInput(userProfile.wechatId);
              setCurrentView("EDIT_WECHAT_ID");
            }}
            className="bg-white p-4 h-14 flex items-center justify-between active:bg-gray-50 mb-2 cursor-pointer"
          >
            <span className="text-[16px] text-black">微信号</span>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">{userProfile.wechatId}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 stroke-[2]" />
            </div>
          </div>

          <div
            onClick={() => setCurrentView("PERSONA_LIST")}
            className="bg-white p-4 h-14 flex items-center justify-between active:bg-gray-50 cursor-pointer"
          >
            <span className="text-[16px] text-black">我的 AI 人设</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-50/60 pl-1 pr-2 py-1 rounded-full border border-blue-100">
                <img
                  src={getCurrentPersona().avatar}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs text-[#576b95] font-medium">
                  {getCurrentPersona().name}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 stroke-[2]" />
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="text-[12px] text-gray-400 text-center leading-relaxed">
              当前头像是你【{getCurrentPersona().name}】人设的头像。
              <br />
              上传新头像将会自动更新当前人设的配置。
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPersonaListView = () => (
    <div className="flex flex-col h-screen bg-[#F3F3F3]">
      <div className="bg-[#EDEDED] h-12 flex items-center justify-between px-4 sticky top-0 z-10 border-b border-gray-200/50 shrink-0">
        <button
          onClick={() => setCurrentView("PROFILE_INFO")}
          className="flex items-center -ml-2 py-2 pr-2"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
          <span className="text-[16px] text-black font-normal">个人信息</span>
        </button>
        <span className="font-semibold text-[17px]">选择人设</span>
        <button
          onClick={() => {
            setEditingPersona({
              id: "",
              name: "",
              description: "",
              avatar: "",
            });
            setCurrentView("PERSONA_EDIT");
          }}
          className="bg-[#07c160] text-white text-xs px-3 py-1.5 rounded-[4px] font-medium hover:bg-[#06ad56] transition-colors"
        >
          新建
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mt-2">
          {userProfile.personas.map((persona, index) => (
            <div
              key={persona.id}
              onClick={() => selectPersona(persona.id)}
              className={`bg-white p-4 flex items-center justify-between active:bg-gray-50 cursor-pointer ${
                index !== userProfile.personas.length - 1
                  ? "border-b border-gray-100"
                  : ""
              }`}
            >
              <div className="flex items-center gap-4 flex-1 overflow-hidden">
                <div className="w-12 h-12 rounded-[6px] bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                  <img
                    src={persona.avatar}
                    alt={persona.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[16px] font-medium text-black truncate">
                      {persona.name}
                    </span>
                    {persona.id === "default" && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-[2px] shrink-0">
                        默认
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-gray-400 truncate w-full">
                    {persona.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-4 shrink-0">
                {userProfile.currentPersonaId === persona.id && (
                  <Check className="w-5 h-5 text-[#07c160]" strokeWidth={2.5} />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPersona(persona);
                    setCurrentView("PERSONA_EDIT");
                  }}
                  className="p-2 -mr-2 text-gray-300 hover:text-gray-500"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPersonaEditView = () => (
    <div className="flex flex-col h-screen bg-[#F3F3F3] absolute inset-0 z-50">
      <div className="bg-[#EDEDED] h-12 flex items-center justify-between px-4 sticky top-0 z-10 shrink-0">
        <button
          onClick={() => setCurrentView("PERSONA_LIST")}
          className="text-[16px] text-black hover:bg-black/5 px-2 py-1 rounded transition-colors"
        >
          取消
        </button>
        <span className="font-semibold text-[17px]">
          {editingPersona.id ? "编辑人设" : "新建人设"}
        </span>
        <button
          onClick={handleSavePersona}
          disabled={!editingPersona.name || !editingPersona.description}
          className={`px-3 py-1.5 rounded-[4px] text-sm text-white font-medium ${
            !editingPersona.name || !editingPersona.description
              ? "bg-[#07c160]/50"
              : "bg-[#07c160]"
          }`}
        >
          完成
        </button>
      </div>

      <div className="mt-4 px-4 flex-1 overflow-y-auto">
        <div className="bg-white rounded-lg overflow-hidden">
          <div
            onClick={() => personaFileInputRef.current?.click()}
            className="px-4 py-4 border-b border-gray-100 flex items-center justify-between active:bg-gray-50 cursor-pointer"
          >
            <span className="text-[16px] text-black">头像</span>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-[6px] bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center">
                {editingPersona.avatar ? (
                  <img
                    src={editingPersona.avatar}
                    className="w-full h-full object-cover"
                    alt="avatar"
                  />
                ) : (
                  <User className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 stroke-[2]" />
            </div>
            <input
              type="file"
              ref={personaFileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handlePersonaAvatarChange}
            />
          </div>

          <div className="px-4 py-3 border-b border-gray-100 flex items-center bg-white">
            <span className="w-16 text-[16px] text-black shrink-0">名称</span>
            <input
              type="text"
              placeholder="例如：高冷学霸"
              className="flex-1 outline-none text-[16px] text-black placeholder:text-gray-300 h-8 bg-transparent"
              value={editingPersona.name}
              onChange={(e) =>
                setEditingPersona({ ...editingPersona, name: e.target.value })
              }
              autoFocus
            />
          </div>

          <div className="px-4 py-3 bg-white">
            <div className="text-[16px] text-black mb-2">人设描述</div>
            <textarea
              placeholder="请输入AI扮演的性格描述..."
              className="w-full h-40 outline-none text-[16px] text-black resize-none placeholder:text-gray-300 leading-relaxed bg-transparent"
              value={editingPersona.description}
              onChange={(e) =>
                setEditingPersona({
                  ...editingPersona,
                  description: e.target.value,
                })
              }
            />
          </div>
        </div>

        {editingPersona.id && editingPersona.id !== "default" && (
          <button
            onClick={() => handleDeletePersona(editingPersona.id)}
            className="mt-6 w-full bg-white text-[#fa5151] text-[16px] py-3 rounded-lg font-medium active:bg-gray-50 border border-black/5"
          >
            删除该人设
          </button>
        )}
      </div>
    </div>
  );

  // --- 5. 最终视图渲染路由 ---
  if (currentView === "PROFILE_INFO") return renderProfileInfoView();
  if (currentView === "PERSONA_LIST") return renderPersonaListView();
  if (currentView === "PERSONA_EDIT") return renderPersonaEditView();
  if (currentView === "EDIT_NAME") return renderEditNameView();
  if (currentView === "EDIT_WECHAT_ID") return renderEditWechatIdView();

  // MAIN VIEW
  return (
    <div className="flex flex-col h-screen bg-[#F3F3F3] text-gray-900 overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto pb-4 custom-scrollbar">
        {/* 1. 个人信息卡片 */}
        <div
          onClick={() => setCurrentView("PROFILE_INFO")}
          className="bg-white pt-16 pb-8 px-6 mb-2 flex items-start gap-4 active:bg-gray-50 cursor-pointer transition-colors"
        >
          <div className="w-16 h-16 rounded-[6px] overflow-hidden shrink-0 border border-black/5">
            <img
              src={userProfile.avatar}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col justify-between h-16 py-0.5">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-semibold text-gray-900 leading-none">
                {userProfile.name}
              </h2>
              <div className="flex items-center gap-4 text-gray-400">
                <QrCode className="w-5 h-5" />
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
            <div className="flex justify-between items-center w-full">
              <span className="text-sm text-gray-500">
                微信号：{userProfile.wechatId}
              </span>
            </div>
          </div>
        </div>

        {/* 2. 状态栏 */}
        <div className="bg-white px-6 pb-4 mb-2 -mt-2">
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowStatusModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-full border border-gray-200 text-sm text-gray-600 bg-white active:bg-gray-50"
            >
              {userProfile.status ? (
                <>
                  <span className="mr-1">{userProfile.statusIcon}</span>
                  <span>{userProfile.status}</span>
                  <div
                    onClick={clearStatus}
                    className="ml-1.5 p-0.5 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300"
                  >
                    <X className="w-3 h-3" />
                  </div>
                </>
              ) : (
                <>
                  <span className="text-gray-400 text-lg leading-none mb-0.5">
                    +
                  </span>
                  <span>状态</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-200 text-xs bg-white">
              <span className="text-gray-400">当前人设:</span>
              <img
                src={getCurrentPersona().avatar}
                alt=""
                className="w-3.5 h-3.5 rounded-full object-cover"
              />
              <span className="text-[#07c160] font-medium">
                {getCurrentPersona().name}
              </span>
            </div>
          </div>
        </div>

        {/* 菜单列表 */}
        <div className="bg-white mb-2">
          <MenuItem
            icon={<span className="text-[#07c160] font-bold text-lg">S</span>}
            label="服务"
            isFirst
          />
        </div>
        <div className="bg-white mb-2 flex flex-col">
          <MenuItem
            icon={<Box className="w-6 h-6 text-orange-400 stroke-[1.5]" />}
            label="收藏"
            isFirst
          />
          <MenuItem
            icon={<Circle className="w-6 h-6 text-blue-500 stroke-[1.5]" />}
            label="朋友圈"
          />
          <MenuItem
            icon={<CreditCard className="w-6 h-6 text-blue-400 stroke-[1.5]" />}
            label="卡包"
          />
          <Link href="/me/stickers">
            <MenuItem
              icon={<Smile className="w-6 h-6 text-yellow-500 stroke-[1.5]" />}
              label="角色表情"
            />
          </Link>
        </div>
        <div className="bg-white mb-6">
          <MenuItem
            icon={<Settings className="w-6 h-6 text-blue-600 stroke-[1.5]" />}
            label="设置"
            isFirst
          />
        </div>
      </div>

      <BottomNav />

      {/* 状态弹窗 */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center animate-in fade-in">
          <div className="bg-white w-full sm:w-96 rounded-t-xl sm:rounded-xl p-6 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">设置我的状态</h3>
              <button onClick={() => setShowStatusModal(false)}>
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {STATUS_OPTIONS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleSetStatus(item)}
                  className="flex flex-col items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-xs text-gray-600">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 辅助组件 ---
function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="bg-[#EDEDED] h-12 flex items-center justify-between px-2 sticky top-0 z-10 shrink-0">
      <button onClick={onBack} className="flex items-center py-2 pr-4">
        <ChevronLeft className="w-6 h-6 text-black" />
      </button>
      <span className="font-semibold text-[17px] absolute left-1/2 -translate-x-1/2">
        {title}
      </span>
      <div className="w-10"></div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  isFirst = false,
}: {
  icon: React.ReactNode;
  label: string;
  isFirst?: boolean;
}) {
  return (
    <div className="active:bg-gray-100 flex items-center h-14 pl-6 pr-4 cursor-pointer">
      <div className="w-6 h-6 mr-4 flex items-center justify-center">
        {icon}
      </div>
      <div
        className={`flex-1 h-full flex items-center justify-between ${
          !isFirst ? "border-t border-gray-100" : ""
        }`}
      >
        <span className="text-[16px] text-[#181818] tracking-wide">
          {label}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-300 stroke-[2]" />
      </div>
    </div>
  );
}

function BottomNav() {
  return (
    <div className="h-16 bg-[#f7f7f7] border-t border-gray-200 flex items-center justify-around text-[11px] shrink-0 fixed bottom-0 w-full z-30 pb-1 safe-area-bottom">
      <Link
        href="/chat"
        className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
      >
        <MessageSquare className="w-7 h-7 mb-0.5" strokeWidth={1.5} />
        <span>微信</span>
      </Link>
      <Link
        href="/contacts"
        className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
      >
        <Users className="w-7 h-7 mb-0.5" strokeWidth={1.5} />
        <span>通讯录</span>
      </Link>
      <Link
        href="/discover"
        className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
      >
        <Compass className="w-7 h-7 mb-0.5" strokeWidth={1.5} />
        <span>发现</span>
      </Link>
      <div className="flex flex-col items-center justify-center h-full w-1/4 text-[#07c160] cursor-default">
        <User className="w-7 h-7 mb-0.5 fill-current" strokeWidth={1.5} />
        <span>我</span>
      </div>
    </div>
  );
}
