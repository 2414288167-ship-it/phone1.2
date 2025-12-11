"use client";

import React from "react";
import { AIProvider } from "@/context/AIContext";
import { MyThemeProvider } from "@/lib/MyTheme";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AIProvider>
      <MyThemeProvider>
        {/* 👇👇👇 修改重点 👇👇👇 */}

        {/* 1. 外层：使用 fixed inset-0 强制占满整个屏幕，不留缝隙 */}
        {/* z-0 确保它是背景 */}
        <div className="fixed inset-0 z-0 bg-[#f3f4f6] md:bg-[#050a1f] overflow-hidden">
          {/* 2. 中间层：居中容器 (适配电脑端，手机端自动全屏) */}
          <div className="relative w-full h-full max-w-[500px] mx-auto bg-[#f3f4f6] shadow-2xl flex flex-col">
            {/* 3. 内层：处理安全区域的垫片 */}
            {/* 这里的 style 会自动把顶部状态栏和底部小黑条的位置“让出来” */}
            <div
              className="flex-1 flex flex-col w-full h-full overflow-hidden"
              style={{
                paddingTop: "env(safe-area-inset-top)", // 让出顶部刘海
                paddingBottom: "env(safe-area-inset-bottom)", // 让出底部黑条
              }}
            >
              {children}
            </div>
          </div>
        </div>

        {/* 👆👆👆 修改结束 👆👆👆 */}
      </MyThemeProvider>
    </AIProvider>
  );
}
