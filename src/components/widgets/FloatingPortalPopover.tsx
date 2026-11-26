// src/components/widgets/FloatingPortalPopover.tsx
// 🌟 共用 Portal 懸浮定位容器（掛載至 document.body，徹底解決表格 overflow-x-auto / modal overflow-y-auto 裁切下拉選單問題）

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FloatingPopoverCoords } from '../../utils/floatingPopover';

export interface FloatingPortalPopoverProps {
  isOpen: boolean;
  coords: FloatingPopoverCoords | null;
  onClose: () => void;
  children: React.ReactNode;
  id?: string;
  className?: string;
  zIndex?: number;
  /** 外部觸發器 ref，避免點擊觸發器本身誤觸外部關閉 */
  triggerRef?: React.RefObject<HTMLElement | null>;
  /** 額外忽略外部點擊的 selector（例如 [data-dropdown-trigger]） */
  ignoreOutsideSelector?: string;
  /** 外部捲動時的處置模式：REPOSITION（重新對齊）或 CLOSE（自動關閉） */
  onScrollOutside?: 'REPOSITION' | 'CLOSE';
  onReposition?: () => void;
  closeOnEscape?: boolean;
}

export const FloatingPortalPopover: React.FC<FloatingPortalPopoverProps> = ({
  isOpen,
  coords,
  onClose,
  children,
  id,
  className = '',
  zIndex = 99999,
  triggerRef,
  ignoreOutsideSelector,
  onScrollOutside = 'CLOSE',
  onReposition,
  closeOnEscape = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (triggerRef?.current && triggerRef.current.contains(target)) return;
      if (ignoreOutsideSelector && target.closest(ignoreOutsideSelector)) return;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && containerRef.current && containerRef.current.contains(target)) {
        return;
      }
      if (onScrollOutside === 'REPOSITION') {
        onReposition?.();
      } else {
        onClose();
      }
    };

    const handleResize = () => {
      if (onScrollOutside === 'REPOSITION') {
        onReposition?.();
      } else {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    if (closeOnEscape) window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      if (closeOnEscape) window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onClose, triggerRef, ignoreOutsideSelector, onScrollOutside, onReposition, closeOnEscape]);

  if (!isOpen || !coords || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={containerRef}
      id={id}
      data-dropdown-container
      style={{
        position: 'fixed',
        top: coords.openUpward ? 'auto' : `${coords.top}px`,
        bottom: coords.openUpward ? `${window.innerHeight - coords.top}px` : 'auto',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex
      }}
      className={className}
    >
      {children}
    </div>,
    document.body
  );
};
