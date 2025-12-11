// TypeScript/JavaScript 工具函数
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
