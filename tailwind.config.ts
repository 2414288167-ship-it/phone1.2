import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      // 👇👇👇 在这里添加 animation 配置 👇👇👇
      animation: {
        "spin-slow": "spin 10s linear infinite", // 10秒转一圈
      },
      // 👆👆👆 添加结束 👆👆👆
    },
  },
  plugins: [],
};
export default config;
