import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 引入你的所有 Provider 和根布局组件
import { UnreadProvider } from "@/context/UnreadContext";
import { AIProvider } from "@/context/AIContext";
import { MusicProvider } from "@/context/MusicContext";
import ClientLayout from "@/components/ClientLayout";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

// 🔥🔥🔥 核心修复：引入 MyThemeProvider 🔥🔥🔥
// (请确保路径正确，通常是 @/lib/MyTheme 或 @/context/ThemeContext)
import { MyThemeProvider } from "@/lib/MyTheme"; 

const inter = Inter({ subsets: ["latin"] });

// 视口设置，禁止用户缩放，保持不变
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "AI Chat App",
  description: "Your AI Chat Companion",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={`${inter.className} antialiased bg-black`}>
        <ServiceWorkerRegister />

        {/* 强制全屏容器 */}
        <div className="flex justify-center w-full h-[100dvh] overflow-hidden bg-[#050a1f]">
          {/* 限制最大宽度 */}
          <div className="w-full max-w-[500px] h-full flex flex-col relative shadow-2xl">
            
            {/* 
              🔥🔥🔥 核心修复：添加 MyThemeProvider 🔥🔥🔥 
              必须包裹在 ClientLayout 外面，最好放在最外层
            */}
            <MyThemeProvider>
              <UnreadProvider>
                <AIProvider>
                  <MusicProvider>
                    <ClientLayout>
                      {/* 👇 你的所有页面内容都将在这里渲染 */}
                      {children}
                    </ClientLayout>
                  </MusicProvider>
                </AIProvider>
              </UnreadProvider>
            </MyThemeProvider>
            
          </div>
        </div>
      </body>
    </html>
  );
}
