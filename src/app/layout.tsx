import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// 引入你的 Provider 和 Layout
import { UnreadProvider } from "@/context/UnreadContext";
import { AIProvider } from "@/context/AIContext";
import { MusicProvider } from "@/context/MusicContext"; // [新增] 导入 Music Provider
import ClientLayout from "@/components/ClientLayout";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({ subsets: ["latin"] });

// 1. 这一步很重要：禁止用户缩放，锁定视口
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 禁止双指缩放
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "AI Chat App",
  description: "Chat App",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      {/* 2. 在 body 上直接加这些类名 */}
      <body className={`${inter.className} antialiased bg-black`}>
        <ServiceWorkerRegister />

        {/* 3. 【核心代码】创建一个强制全屏的容器 */}
        {/* h-[100dvh] = 自动适配浏览器的高度（包括地址栏） */}
        {/* overflow-hidden = 禁止整个页面上下晃动 */}
        <div className="flex justify-center w-full h-[100dvh] overflow-hidden bg-[#050a1f]">
          {/* 4. 限制最大宽度，保证在电脑上看也是手机形状，在手机上看则是全屏 */}
          <div className="w-full max-w-[500px] h-full flex flex-col relative shadow-2xl">
            {/* [修改] 用 MusicPlayerProvider 包裹住现有的 Provider */}
            <MusicProvider>
              <UnreadProvider>
                <AIProvider>
                  <ClientLayout>
                    {/* 这里面的内容如果长，它自己会滚动，不会带着整个页面滚 */}
                    {children}
                  </ClientLayout>
                </AIProvider>
              </UnreadProvider>
            </MusicProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
