"use client";

import React, { useState, useRef, TouchEvent } from "react";

interface SwipeableItemProps {
  children: React.ReactNode;
  onPin?: () => void;
  onRead?: () => void;
  onDelete?: () => void;
  isPinned?: boolean;
}

export const SwipeableItem = ({
  children,
  onPin,
  onRead,
  onDelete,
  isPinned,
}: SwipeableItemProps) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  // 记录触摸起始位置
  const startX = useRef(0);
  const startY = useRef(0);

  // 按钮总宽度 (80px * 3 = 240px)
  const maxSwipe = 240;

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // 1. 如果垂直滑动幅度 > 水平滑动，说明用户想滚屏，不拦截
    if (Math.abs(diffY) > Math.abs(diffX)) return;

    // 2. 向左滑 (diffX < 0)
    if (diffX < 0) {
      // 限制最大滑动距离，增加一点阻尼感
      const newOffset = Math.max(diffX, -maxSwipe - 20);
      setOffsetX(newOffset);
      setIsSwiping(true);
    }
    // 3. 如果已经打开了，允许向右滑回去
    else if (offsetX < 0 && diffX > 0) {
      setOffsetX(Math.min(0, -maxSwipe + diffX));
      setIsSwiping(true);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    // 滑动超过一半就展开，否则回弹
    if (offsetX < -maxSwipe / 2) {
      setOffsetX(-maxSwipe);
    } else {
      setOffsetX(0);
    }
    setTimeout(() => setIsSwiping(false), 100);
  };

  return (
    <div className="relative overflow-hidden w-full bg-white border-b border-gray-100 select-none">
      {/* --- 背景层：操作按钮 --- */}
      <div className="absolute top-0 right-0 bottom-0 flex h-full text-white text-[15px] font-medium">
        {/* 置顶 - 蓝色 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            onPin?.();
          }}
          className="w-[80px] bg-[#3b82f6] flex items-center justify-center active:bg-blue-600"
        >
          {isPinned ? "取消置顶" : "置顶"}
        </button>

        {/* 标为已读 - 橙色 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOffsetX(0);
            onRead?.();
          }}
          className="w-[80px] bg-[#f59e0b] flex items-center justify-center active:bg-amber-600"
        >
          标为已读
        </button>

        {/* 删除 - 红色 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(); // 删除不需要关闭动画，因为条目直接消失了
          }}
          className="w-[80px] bg-[#ef4444] flex items-center justify-center active:bg-red-600"
        >
          删除
        </button>
      </div>

      {/* --- 前景层：原本的聊天内容 --- */}
      <div
        className="relative bg-white transition-transform duration-300 ease-out z-10"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          // 如果菜单是打开的，点击内容只是为了关闭菜单，不跳转
          if (offsetX !== 0) {
            e.preventDefault();
            setOffsetX(0);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
};
