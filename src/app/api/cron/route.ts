import { NextResponse } from "next/server";
import webPush from "web-push";

// ... webPush 配置代码保持不变 ...

// ✅ 1. 新增：定义数据结构类型
interface UserData {
  subscription: webPush.PushSubscription; // 或者用 any，但推荐用官方类型
  settings: {
    nextTriggerTime: number;
    // 这里可以加其他你需要的设置字段
  };
}

export async function GET() {
  // 1. 从数据库拉取所有用户的订阅和设置
  // const allUsers = await kv.keys("user_sub_*");

  // ✅ 2. 修改：给 users 加上类型注解 ": UserData[]"
  // 这样 TypeScript 就知道这个数组里装的是 UserData 对象了
  const users: UserData[] = [
    /* 这里将来放从数据库查出来的真实数据 */
  ];

  for (const user of users) {
    // ✅ 现在 TypeScript 知道 user 里一定有 subscription 和 settings 了，报错消失
    const { subscription, settings } = user;

    const now = Date.now();

    if (now > settings.nextTriggerTime) {
      // ... 后续逻辑 ...
    }
  }

  return NextResponse.json({ ok: true });
}
