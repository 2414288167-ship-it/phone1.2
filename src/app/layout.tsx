import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 引入你的所有 Provider 和根布局组件
import { UnreadProvider } from "@/context/UnreadContext";
import { AIProvider } from "@/context/AIContext";
import { MusicProvider } from "@/context/MusicContext"; // 确保路径正确
import ClientLayout from "@/components/ClientLayout"; // 确保路径正确
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

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
              🔥🔥🔥 核心修复：正确的嵌套顺序 🔥🔥🔥
              1. 先把所有的数据提供者 (Provider) 从外到内包好。
              2. 然后把 ClientLayout 放在最内层，因为它需要使用这些数据。
              3. 最后，把 {children} (你的页面内容) 只放一次，放在 ClientLayout 内部。
            */}
            <UnreadProvider>
              <AIProvider>
                <MusicProvider>
                  <ClientLayout>
                    {/* 👇 你的所有页面内容都将在这里渲染，并且只渲染一次 */}
                    {children}
                  </ClientLayout>
                </MusicProvider>
              </AIProvider>
            </UnreadProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
