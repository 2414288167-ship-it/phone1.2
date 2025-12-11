/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 基础配置 (来自 ts 文件)
  reactStrictMode: true,
  swcMinify: true,

  // 2. 图片配置 (来自 ts 文件)
  // 如果你部署在静态环境或不使用 Vercel 图片优化，这个很重要
  images: {
    unoptimized: true,
  },

  // 关键配置：将 NeteaseCloudMusicApi 排除在打包之外
  experimental: {
    serverComponentsExternalPackages: ["NeteaseCloudMusicApi"],
  },

  // 3. 忽略检查配置 (来自 js 文件)
  // 这能防止因为一点小语法错误导致 Vercel 部署失败
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 4. 安全头部配置 (来自 ts 文件)
  headers: async () => {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
