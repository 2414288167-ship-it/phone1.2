"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Plus,
  UserPlus,
  Users,
  Tag,
  Newspaper,
  MessageSquare,
  Compass,
  User,
  ChevronRight,
} from "lucide-react";
// 👇 1. 引入未读消息 Hook
import { useUnread } from "@/context/UnreadContext";

interface Contact {
  id: string;
  name: string;
  avatar: string;
  remark?: string;
  group?: string;
  status?: "online" | "offline";
}

interface ContactGroup {
  name: string;
  totalCount: number;
  onlineCount: number;
  contacts: Contact[];
}

export default function ContactsPage() {
  // 默认选中 "好友"
  const [activeTab, setActiveTab] = useState("好友");

  // 存储所有联系人
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  // 存储分组后的联系人
  const [dynamicGroups, setDynamicGroups] = useState<ContactGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // 👇 2. 获取未读消息数据
  const { unreadCounts } = useUnread();

  const groupNames = [
    "特别关心",
    "同学",
    "朋友",
    "家人",
    "网友",
    "宠物",
    "未分组",
  ];

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const contactsStr = localStorage.getItem("contacts");
        if (contactsStr) {
          const parsedContacts: Contact[] = JSON.parse(contactsStr);

          // 1. 设置所有联系人 (按中文拼音排序)
          const sorted = [...parsedContacts].sort((a, b) =>
            (a.remark || a.name).localeCompare(b.remark || b.name, "zh-CN")
          );
          setAllContacts(sorted);

          // 2. 计算分组数据
          const computedGroups = groupNames.map((groupName) => {
            const contactsInGroup = parsedContacts.filter((c) => {
              if (groupName === "未分组") {
                return !c.group || c.group === "未分组";
              }
              return c.group === groupName;
            });

            return {
              name: groupName,
              totalCount: contactsInGroup.length,
              onlineCount: contactsInGroup.filter(
                (c) => parseInt(c.id) % 2 !== 0
              ).length,
              contacts: contactsInGroup,
            };
          });

          setDynamicGroups(computedGroups);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) =>
      prev.includes(groupName)
        ? prev.filter((n) => n !== groupName)
        : [...prev, groupName]
    );
  };

  const FunctionalItem = ({
    icon,
    color,
    title,
  }: {
    icon: React.ReactNode;
    color: string;
    title: string;
  }) => (
    <div className="flex items-center gap-3 px-4 py-3 bg-white active:bg-gray-100 border-b border-gray-100">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${color}`}
      >
        {icon}
      </div>
      <span className="text-base font-medium text-gray-900">{title}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900 overflow-hidden">
      {/* 顶部 Header */}
      <header className="px-4 h-14 flex items-center justify-between bg-[#ededed] border-b border-gray-200 shrink-0 z-20 relative">
        <h1 className="text-lg font-medium text-gray-900 w-full text-center mr-[-40px]">
          通讯录
        </h1>
        <div className="flex gap-4 absolute right-4">
          <button className="text-gray-900 p-1">
            <Search className="w-5 h-5" />
          </button>
          <button className="text-gray-900 p-1">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-gray-100 pb-14 custom-scrollbar">
        {/* 四大功能入口 */}
        <div className="mb-2 border-b border-gray-200">
          <FunctionalItem
            icon={<UserPlus className="w-6 h-6" />}
            color="bg-[#fa9d3b]"
            title="新的朋友"
          />
          <FunctionalItem
            icon={<Users className="w-6 h-6" />}
            color="bg-[#07c160]"
            title="群聊"
          />
          <FunctionalItem
            icon={<Tag className="w-6 h-6" />}
            color="bg-[#2782d7]"
            title="标签"
          />
          <FunctionalItem
            icon={<Newspaper className="w-6 h-6" />}
            color="bg-[#2782d7]"
            title="公众号"
          />
        </div>

        {/* Tab 切换栏 */}
        <div className="flex items-center justify-around px-4 py-3 bg-white border-b border-gray-100 text-[15px] sticky top-0 z-10 mb-2">
          {["好友", "分组", "群聊"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap transition-colors font-medium ${
                activeTab === tab ? "text-[#07c160] font-bold" : "text-gray-900"
              } relative px-4`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#07c160] rounded-full"></div>
              )}
            </button>
          ))}
        </div>

        <div className="bg-white min-h-[300px]">
          {/* --- 场景 1: "好友" Tab (平铺直显) --- */}
          {activeTab === "好友" && (
            <div className="flex flex-col">
              {allContacts.length > 0 ? (
                allContacts.map((contact) => {
                  const unreadCount = unreadCounts[String(contact.id)] || 0;

                  return (
                    <Link
                      key={contact.id}
                      href={`/chat/${contact.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 border-b border-gray-100 last:border-none"
                    >
                      {/* 🔥🔥🔥 头像容器 + 红点 🔥🔥🔥 */}
                      <div className="relative">
                        <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                          {contact.avatar?.startsWith("data:") ||
                          contact.avatar?.startsWith("http") ? (
                            <img
                              src={contact.avatar}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>{contact.avatar}</span>
                          )}
                        </div>
                        {/* 🔴 红点 */}
                        {unreadCount > 0 && (
                          <div className="absolute -top-1.5 -right-1.5 z-50 min-w-[1rem] h-4 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full flex items-center justify-center border-2 border-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[16px] text-gray-900 font-medium">
                          {contact.remark || contact.name}
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="py-10 text-center text-gray-400 text-sm">
                  暂无好友
                </div>
              )}
              {/* 底部数量统计 */}
              {allContacts.length > 0 && (
                <div className="py-4 text-center text-gray-400 text-sm bg-gray-100">
                  {allContacts.length} 位联系人
                </div>
              )}
            </div>
          )}

          {/* --- 场景 2: "分组" Tab --- */}
          {activeTab === "分组" && (
            <div>
              {dynamicGroups.map((group) => {
                const isExpanded = expandedGroups.includes(group.name);
                return (
                  <div key={group.name}>
                    <div
                      onClick={() => toggleGroup(group.name)}
                      className="flex items-center justify-between px-4 py-3.5 active:bg-gray-50 cursor-pointer select-none border-b border-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                        <span className="text-base text-gray-900">
                          {group.name}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {group.onlineCount}/{group.totalCount}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="bg-gray-50/30">
                        {group.contacts.length > 0 ? (
                          group.contacts.map((contact) => {
                            const unreadCount =
                              unreadCounts[String(contact.id)] || 0;

                            return (
                              <Link
                                key={contact.id}
                                href={`/chat/${contact.id}`}
                                className="flex items-center gap-3 px-4 py-3 pl-11 hover:bg-gray-100 border-b border-gray-100 last:border-none"
                              >
                                {/* 🔥🔥🔥 分组列表里的头像 + 红点 🔥🔥🔥 */}
                                <div className="relative">
                                  <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-lg overflow-hidden">
                                    {contact.avatar?.startsWith("data:") ||
                                    contact.avatar?.startsWith("http") ? (
                                      <img
                                        src={contact.avatar}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span>{contact.avatar}</span>
                                    )}
                                  </div>
                                  {/* 🔴 红点 */}
                                  {unreadCount > 0 && (
                                    <div className="absolute -top-1.5 -right-1.5 z-50 min-w-[1rem] h-4 bg-red-500 text-white text-[10px] font-bold px-1 rounded-full flex items-center justify-center border-2 border-white">
                                      {unreadCount > 99 ? "99+" : unreadCount}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col">
                                  <span className="text-[15px] text-gray-900">
                                    {contact.remark || contact.name}
                                  </span>
                                  <span className="text-[10px] text-green-500">
                                    [在线] 4G
                                  </span>
                                </div>
                              </Link>
                            );
                          })
                        ) : (
                          <div className="py-3 pl-11 text-xs text-gray-400">
                            暂无联系人
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* --- 场景 3: "群聊" Tab --- */}
          {activeTab === "群聊" && (
            <div className="py-20 text-center text-gray-400 text-sm">
              暂无群聊
            </div>
          )}
        </div>

        <div className="h-10"></div>
      </div>

      {/* --- 底部导航栏 --- */}
      <div className="h-16 bg-[#f7f7f7] border-t border-gray-200 flex items-center justify-around text-[11px] shrink-0 fixed bottom-0 w-full z-30 pb-1 safe-area-bottom">
        <Link
          href="/chat"
          className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
        >
          <MessageSquare className="w-7 h-7 mb-0.5" />
          <span>微信</span>
        </Link>

        {/* 当前页面是通讯录，高亮显示 */}
        <div className="flex flex-col items-center justify-center h-full w-1/4 text-[#07c160] cursor-pointer">
          <Users className="w-7 h-7 mb-0.5 fill-current" />
          <span>通讯录</span>
        </div>

        <Link
          href="/discover"
          className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
        >
          <Compass className="w-7 h-7 mb-0.5" />
          <span>发现</span>
        </Link>

        <Link
          href="/me"
          className="flex flex-col items-center justify-center h-full w-1/4 text-gray-900 hover:text-[#07c160] transition-colors"
        >
          <User className="w-7 h-7 mb-0.5" />
          <span>我</span>
        </Link>
      </div>
    </div>
  );
}
