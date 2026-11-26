// src/utils/floatingPopover.ts
// Portal 懸浮座標定位引擎：計算觸發元素相對視窗的安全顯示位置（防上下/左右裁切）

export interface FloatingPopoverCoords {
  top: number;
  bottom: number;
  left: number;
  width: number;
  openUpward: boolean;
}

export interface ComputeFloatingCoordsOptions {
  /** 預估選單最大高度（預設 320px），不足時自動向上翻轉 */
  estimatedHeight?: number;
  /** 最小寬度（預設跟隨觸發元素寬度） */
  minWidth?: number;
  /** 距離螢幕邊緣的保留間距（預設 12px） */
  viewportMargin?: number;
  /** 觸發框與浮層之間的垂直間距（預設 6px） */
  gap?: number;
}

export function computeFloatingPopoverCoords(
  triggerEl: HTMLElement,
  options: ComputeFloatingCoordsOptions = {}
): FloatingPopoverCoords {
  const {
    estimatedHeight = 320,
    minWidth = 0,
    viewportMargin = 12,
    gap = 6
  } = options;

  const rect = triggerEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUpward = spaceBelow < estimatedHeight && rect.top > estimatedHeight;
  const width = Math.max(minWidth, rect.width);

  let left = rect.left;
  if (left + width > window.innerWidth - viewportMargin) {
    left = Math.max(viewportMargin, window.innerWidth - width - viewportMargin);
  }
  left = Math.max(viewportMargin, left);

  return {
    top: openUpward ? rect.top - gap : rect.bottom + gap,
    bottom: rect.bottom,
    left,
    width,
    openUpward
  };
}
