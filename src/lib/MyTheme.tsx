"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface ThemeSettings {
  homeWallpaper: string;
  chatWallpaper: string;
  nightMode: boolean;
  showStatusBar: boolean;
  immersiveFrame: boolean;
  dynamicIsland: boolean;
  messageSoundUrl: string;
  customCss: string;
}

const defaultSettings: ThemeSettings = {
  homeWallpaper:
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80",
  chatWallpaper: "",
  nightMode: false,
  showStatusBar: true,
  immersiveFrame: false,
  dynamicIsland: false,
  messageSoundUrl: "",
  customCss: "",
};

interface ThemeContextType {
  settings: ThemeSettings;
  updateSetting: (key: keyof ThemeSettings, value: any) => void;
  resetSettings: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function MyThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(defaultSettings);
  // const [isLoaded, setIsLoaded] = useState(false); // ❌ 删掉这个状态，不再阻断渲染

  useEffect(() => {
    const saved = localStorage.getItem("my_theme_settings");
    if (saved) {
      try {
        setSettings((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error(e);
      }
    }
    // setIsLoaded(true); // ❌ 不需要了
  }, []);

  const updateSetting = (key: keyof ThemeSettings, value: any) => {
    setSettings((prev) => {
      const newS = { ...prev, [key]: value };
      localStorage.setItem("my_theme_settings", JSON.stringify(newS));
      return newS;
    });
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem("my_theme_settings");
  };

  return (
    <ThemeContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {/* 
         注入自定义 CSS
         如果有自定义壁纸，我们可以用简单的 opacity 动画来缓解加载闪烁，
         而不是粗暴地不渲染 Provider。
      */}
      {settings.customCss && (
        <style dangerouslySetInnerHTML={{ __html: settings.customCss }} />
      )}

      {/* 始终包裹 Provider，绝对不能返回裸的 children */}
      {children}
    </ThemeContext.Provider>
  );
}

export const useMyTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useMyTheme must be used within MyThemeProvider");
  }
  return context;
};
